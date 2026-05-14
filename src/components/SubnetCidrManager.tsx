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
import {
  Button,
  Card,
  Input,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { CloseOutlined, LoadingOutlined, PlusOutlined } from "@ant-design/icons";
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

function CidrSection({ subnetId, kind, blocks }: SectionProps) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [opId, setOpId] = useState<string | null>(null);
  const [opTitle, setOpTitle] = useState("");
  const [pendingCidr, setPendingCidr] = useState<string | null>(null);

  const label = kind === "v4" ? "IPv4 CIDR blocks" : "IPv6 CIDR blocks";
  const placeholder = kind === "v4" ? "10.0.1.0/24" : "fd00:1234::/64";
  const tagColor = kind === "v4" ? "blue" : "geekblue";

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
    <Card
      size="small"
      title={
        <Space size={8}>
          <Typography.Text strong>{label}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {blocks.length} блок(ов)
          </Typography.Text>
        </Space>
      }
    >
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        <div style={{ minHeight: 24 }}>
          {blocks.length === 0 ? (
            <Typography.Text type="secondary" italic style={{ fontSize: 12 }}>
              — пусто —
            </Typography.Text>
          ) : (
            <Space size={[6, 6]} wrap>
              {blocks.map((cidr) => {
                const busy = pendingCidr === cidr && (mutate.isPending || opId !== null);
                return (
                  <Tag
                    key={cidr}
                    color={tagColor}
                    closable={!busy}
                    closeIcon={
                      busy ? (
                        <Spin
                          indicator={<LoadingOutlined style={{ fontSize: 10 }} spin />}
                        />
                      ) : (
                        <CloseOutlined style={{ fontSize: 10 }} />
                      )
                    }
                    onClose={(e) => {
                      e.preventDefault();
                      if (!busy) onRemove(cidr);
                    }}
                    style={{ fontFamily: "monospace", fontSize: 12, margin: 0 }}
                  >
                    {cidr}
                  </Tag>
                );
              })}
            </Space>
          )}
        </div>
        <Space.Compact style={{ width: "100%" }}>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            disabled={inputDisabled}
            style={{ fontFamily: "monospace", fontSize: 12 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
          />
          <Button
            type="primary"
            ghost
            onClick={onAdd}
            disabled={!draft.trim() || inputDisabled}
            icon={<PlusOutlined />}
          >
            Add
          </Button>
        </Space.Compact>
      </Space>

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
    </Card>
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
