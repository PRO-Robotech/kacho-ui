// SubnetCidrManager — отдельный UI-flow для управления v4_cidr_blocks /
// v6_cidr_blocks подсети через verbs `:add-cidr-blocks` / `:remove-cidr-blocks`.
//
// Backend (kacho-vpc/internal/service/subnet.go) запрещает менять CIDR-блоки
// через обычный PATCH (`v4_cidr_blocks is immutable after Subnet.Create`;
// UpdateSubnet.v6_cidr_blocks — soft-immutable / no-op). Для этого выделены
// отдельные RPC, которые UI вызывает через api.action(): для IPv4 — с телом
// {v4_cidr_blocks:[...]}, для IPv6 — {v6_cidr_blocks:[...]}; оба возвращают
// Operation (поллим до done).

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/api/client";
import { OperationToastWatcher } from "@/components/OperationToastWatcher";
import { extractOperationId } from "@/components/OperationDialog";
import { toast } from "@/lib/toast";

interface Props {
  subnetId: string;
  // Текущие IPv4 CIDR-блоки (из data.v4_cidr_blocks).
  v4Blocks: string[];
  // Текущие IPv6 CIDR-блоки (из data.v6_cidr_blocks).
  v6Blocks: string[];
}

type Kind = "v4" | "v6";

const KIND_META: Record<
  Kind,
  { title: string; field: "v4_cidr_blocks" | "v6_cidr_blocks"; placeholder: string }
> = {
  v4: { title: "IPv4 CIDR blocks", field: "v4_cidr_blocks", placeholder: "10.0.1.0/24" },
  v6: { title: "IPv6 CIDR blocks", field: "v6_cidr_blocks", placeholder: "fd00:1234::/64" },
};

function isPlausibleCidr(kind: Kind, cidr: string): boolean {
  if (!cidr) return false;
  if (!cidr.includes("/")) return false;
  if (kind === "v6" && !cidr.includes(":")) return false;
  if (kind === "v4" && !cidr.includes(".")) return false;
  return true;
}

export function SubnetCidrManager({ subnetId, v4Blocks, v6Blocks }: Props) {
  return (
    <div className="space-y-3">
      <CidrBlockSection subnetId={subnetId} kind="v4" blocks={v4Blocks} />
      <CidrBlockSection subnetId={subnetId} kind="v6" blocks={v6Blocks} />
    </div>
  );
}

function CidrBlockSection({
  subnetId,
  kind,
  blocks,
}: {
  subnetId: string;
  kind: Kind;
  blocks: string[];
}) {
  const meta = KIND_META[kind];
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [opId, setOpId] = useState<string | null>(null);
  const [opTitle, setOpTitle] = useState("");
  const [pendingCidr, setPendingCidr] = useState<string | null>(null);

  const mutate = useMutation({
    mutationFn: async (params: { verb: "add" | "remove"; cidr: string }) => {
      const path = `/vpc/v1/subnets/${subnetId}:${params.verb}-cidr-blocks`;
      return api.action(path, { [meta.field]: [params.cidr] });
    },
    onSuccess: (resp, vars) => {
      const id = extractOperationId(resp);
      if (id) {
        setOpTitle(`${vars.verb === "add" ? "Adding" : "Removing"} CIDR ${vars.cidr}`);
        setOpId(id);
        setPendingCidr(vars.cidr);
      } else {
        // Sync-ответ (на всякий случай) — сразу инвалидируем detail.
        qc.invalidateQueries({ queryKey: ["subnets", "detail", subnetId] });
        setPendingCidr(null);
      }
    },
    onError: (err, vars) => {
      const m = err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
      toast.error(`CIDR ${vars.verb}: ${m}`);
      setPendingCidr(null);
    },
  });

  const onAdd = () => {
    const cidr = draft.trim();
    if (!cidr) return;
    if (!isPlausibleCidr(kind, cidr)) {
      toast.error(`Некорректный ${kind === "v6" ? "IPv6" : "IPv4"} CIDR: ${cidr}`);
      return;
    }
    setPendingCidr(cidr);
    mutate.mutate({ verb: "add", cidr });
    setDraft("");
  };

  const onRemove = (cidr: string) => {
    if (blocks.length === 1) {
      toast.error("Нельзя удалить последний CIDR — у subnet должен быть хотя бы один.");
      return;
    }
    setPendingCidr(cidr);
    mutate.mutate({ verb: "remove", cidr });
  };

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{meta.title}</h3>
        <span className="text-xs text-muted-foreground">{blocks.length} блок(ов)</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {blocks.length === 0 && (
          <span className="text-xs text-muted-foreground italic">— пусто —</span>
        )}
        {blocks.map((cidr) => {
          const busy = pendingCidr === cidr && (mutate.isPending || opId !== null);
          return (
            <span
              key={cidr}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs font-mono"
            >
              {cidr}
              <button
                type="button"
                onClick={() => onRemove(cidr)}
                disabled={busy || mutate.isPending}
                className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-rose-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Remove this CIDR"
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </button>
            </span>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={meta.placeholder}
          className="font-mono text-xs h-8"
          disabled={mutate.isPending || opId !== null}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAdd}
          disabled={!draft.trim() || mutate.isPending || opId !== null}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      <OperationToastWatcher
        opId={opId}
        title={opTitle}
        onDone={() => {
          setOpId(null);
          setPendingCidr(null);
          qc.invalidateQueries({ queryKey: ["subnets", "detail", subnetId] });
          qc.invalidateQueries({ queryKey: ["subnets", "list"] });
        }}
      />
    </div>
  );
}
