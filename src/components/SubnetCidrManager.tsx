// SubnetCidrManager — управление v4_cidr_blocks / v6_cidr_blocks подсети через
// verbs `:add-cidr-blocks` / `:remove-cidr-blocks`. Визуально — AntD Card+Tag
// (parity с controlled-вариантом SubnetCidrChips в Create-форме).
//
// Backend (kacho-vpc/internal/service/subnet.go) запрещает менять CIDR-блоки
// через обычный PATCH (`v4_cidr_blocks is immutable after Subnet.Create`; то же
// для v6 — UpdateSubnet.v6_cidr_blocks no-op). Для этого выделены отдельные RPC,
// которые UI вызывает через api.action(). Оба verb'а принимают v4_cidr_blocks
// и/или v6_cidr_blocks и возвращают Operation (поллим до done).

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Space, Spin } from "antd";
import { DeleteOutlined, LoadingOutlined, PlusOutlined } from "@ant-design/icons";
import { ApiError, api } from "@/api/client";
import { OperationToastWatcher } from "@/components/OperationToastWatcher";
import { extractOperationId } from "@/components/OperationDialog";
import { toast } from "@/lib/toast";

type CidrKind = "v4" | "v6";

interface Props {
  subnetId: string;
  v4Blocks: string[];
  v6Blocks?: string[];
}

const FIELD_BY_KIND: Record<CidrKind, "v4_cidr_blocks" | "v6_cidr_blocks"> = {
  v4: "v4_cidr_blocks",
  v6: "v6_cidr_blocks",
};

function validateCidr(kind: CidrKind, cidr: string): string | null {
  if (!cidr) return "Введите CIDR.";
  if (!cidr.includes("/")) return "CIDR должен содержать префикс (например /24).";
  if (kind === "v6" && !cidr.includes(":")) return "Похоже не на IPv6-адрес.";
  return null;
}

interface SectionProps {
  subnetId: string;
  kind: CidrKind;
  blocks: string[];
}

const ROW_H = 40;

export function CidrSection({ subnetId, kind, blocks }: SectionProps) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [opId, setOpId] = useState<string | null>(null);
  const [opTitle, setOpTitle] = useState("");
  const [pendingCidr, setPendingCidr] = useState<string | null>(null);

  const placeholder = kind === "v4" ? "10.0.1.0/24" : "fd00:1234::/64";

  const mutate = useMutation({
    mutationFn: async (params: { verb: "add" | "remove"; cidr: string }) => {
      const path = `/vpc/v1/subnets/${subnetId}:${params.verb}-cidr-blocks`;
      return api.action(path, { [FIELD_BY_KIND[kind]]: [params.cidr] });
    },
    onSuccess: (resp, vars) => {
      const id = extractOperationId(resp);
      if (id) {
        setOpTitle(`${vars.verb === "add" ? "Adding" : "Removing"} CIDR ${vars.cidr}`);
        setOpId(id);
        setPendingCidr(vars.cidr);
      } else {
        qc.invalidateQueries({ queryKey: ["subnets", "detail", subnetId] });
        setPendingCidr(null);
      }
    },
    onError: (err, vars) => {
      const m =
        err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
      toast.error(`CIDR ${vars.verb}: ${m}`);
      setPendingCidr(null);
    },
  });

  const onAdd = () => {
    const cidr = draft.trim();
    const v = validateCidr(kind, cidr);
    if (v) {
      toast.error(v);
      return;
    }
    if (blocks.includes(cidr)) {
      toast.error("Этот CIDR уже добавлен.");
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

  const inputDisabled = mutate.isPending || opId !== null;

  return (
    <div
      style={{
        width: "100%",
        minWidth: 0,
        border: "1px solid var(--kc-border)",
        borderRadius: 8,
        overflow: "hidden",
        background: "var(--kc-page)",
      }}
    >
      {/* header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 44px",
          background: "var(--kc-container)",
        }}
      >
        <div
          style={{
            padding: "7px 12px",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: "var(--kc-text-tertiary)",
            borderRight: "1px solid var(--kc-border-secondary)",
          }}
        >
          CIDR-блок
        </div>
        <div />
      </div>

      {/* rows */}
      {blocks.length === 0 && (
        <div
          style={{
            height: ROW_H,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            color: "var(--kc-text-tertiary)",
            borderTop: "1px solid var(--kc-border-secondary)",
          }}
        >
          CIDR-блоков нет
        </div>
      )}
      {blocks.map((cidr) => {
        const busy = pendingCidr === cidr && (mutate.isPending || opId !== null);
        return (
          <div
            key={cidr}
            className="kc-kv-row"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 44px",
              alignItems: "stretch",
              minWidth: 0,
              borderTop: "1px solid var(--kc-border-secondary)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 12px",
                minWidth: 0,
                minHeight: ROW_H,
                fontFamily: "ui-monospace, monospace",
                fontSize: 12.5,
                color: "var(--kc-text)",
                borderRight: "1px solid var(--kc-border-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {cidr}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              {busy ? (
                <Spin indicator={<LoadingOutlined style={{ fontSize: 12 }} spin />} />
              ) : (
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  aria-label="Удалить CIDR"
                  onClick={() => onRemove(cidr)}
                  disabled={inputDisabled}
                />
              )}
            </div>
          </div>
        );
      })}

      {/* footer — input + add */}
      <div style={{ borderTop: "1px solid var(--kc-border-secondary)", padding: "8px 10px" }}>
        <Space.Compact style={{ width: "100%" }}>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            disabled={inputDisabled}
            style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
          />
          <Button
            type="dashed"
            onClick={onAdd}
            disabled={!draft.trim() || inputDisabled}
            icon={<PlusOutlined />}
          >
            Добавить
          </Button>
        </Space.Compact>
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

export function SubnetCidrManager({ subnetId, v4Blocks, v6Blocks }: Props) {
  return (
    <div className="space-y-3">
      <CidrSection subnetId={subnetId} kind="v4" blocks={v4Blocks} />
      <CidrSection subnetId={subnetId} kind="v6" blocks={v6Blocks ?? []} />
    </div>
  );
}
