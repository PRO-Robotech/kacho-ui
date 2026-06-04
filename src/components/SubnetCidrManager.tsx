// CidrSection — управление CIDR-блоками подсети (одно семейство v4/v6) ОДНОЙ
// панелью с read/edit-режимом, ПОЛНОСТЬЮ как RoutesPanel/«Статические маршруты»:
//
// Read mode : текстовые строки CIDR, header-action «Редактировать».
// Edit mode : каждая строка — borderless <Input>, per-row ⌫, снизу dashed
//             «Добавить CIDR»; header-action → «Сохранить» + «Отменить».
//             Удалять/добавлять можно НЕСКОЛЬКО — изменения применяются разом по
//             «Сохранить».
//
// CIDR-блоки нельзя менять PATCH-ом (immutable after Subnet.Create) — на save
// считаем diff черновика против текущих блоков и применяем:
//   added  → :add-cidr-blocks { vN_cidr_blocks: [...] }   (один вызов)
//   removed→ :remove-cidr-blocks { vN_cidr_blocks: [...] } (один вызов)
// Каждый verb возвращает Operation (трекается operationStore), затем invalidate.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Space, Typography } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { ApiError, api } from "@/api/client";
import { extractOperationId } from "@/components/OperationDialog";
import { SectionHeader } from "@/components/SectionHeader";
import { operationStore } from "@/lib/use-operation-store";
import { toast } from "@/lib/toast";

type CidrKind = "v4" | "v6";

const FIELD_BY_KIND: Record<CidrKind, "v4_cidr_blocks" | "v6_cidr_blocks"> = {
  v4: "v4_cidr_blocks",
  v6: "v6_cidr_blocks",
};

const SUBNETS_API = "/vpc/v1/subnets";
const MONO_FONT = "ui-monospace, monospace";
const ROW_H = 41;

const cellInputStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: MONO_FONT,
  fontSize: 12,
  padding: 0,
  height: ROW_H - 2,
  lineHeight: `${ROW_H - 2}px`,
};

function validateCidr(kind: CidrKind, cidr: string): string | null {
  if (!cidr) return "Введите CIDR.";
  if (!cidr.includes("/")) return "CIDR должен содержать префикс (например /24).";
  if (kind === "v6" && !cidr.includes(":")) return "Похоже не на IPv6-адрес.";
  return null;
}

// Бейдж семейства в плитке шапки — «IPv4» / «IPv6» (mono, мелко чтобы влезло).
const familyTile = (text: string) => (
  <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: MONO_FONT, letterSpacing: "-0.04em" }}>
    {text}
  </span>
);

interface SectionProps {
  subnetId: string;
  kind: CidrKind;
  blocks: string[];
  projectId: string | null;
}

export function CidrSection({ subnetId, kind, blocks, projectId }: SectionProps) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<string[] | null>(null);
  const editing = drafts !== null;

  const family = kind === "v4" ? "IPv4" : "IPv6";
  const placeholder = kind === "v4" ? "10.0.1.0/24" : "fd00:1234::/64";
  const field = FIELD_BY_KIND[kind];

  const mutation = useMutation({
    mutationFn: async () => {
      // Валидируем + дедупим черновик.
      const next: string[] = [];
      for (const raw of drafts ?? []) {
        const c = raw.trim();
        if (c === "") continue;
        const verr = validateCidr(kind, c);
        if (verr) throw new Error(verr);
        if (!next.includes(c)) next.push(c);
      }

      const added = next.filter((c) => !blocks.includes(c));
      const removed = blocks.filter((c) => !next.includes(c));
      if (added.length === 0 && removed.length === 0) return;

      if (added.length > 0) {
        const res = await api.action(`${SUBNETS_API}/${subnetId}:add-cidr-blocks`, { [field]: added });
        const opId = extractOperationId(res);
        if (opId) {
          operationStore.start({ id: opId, title: `Добавление ${family} CIDR (${added.length})`, resourceId: "subnets", projectId });
        }
      }
      if (removed.length > 0) {
        const res = await api.action(`${SUBNETS_API}/${subnetId}:remove-cidr-blocks`, { [field]: removed });
        const opId = extractOperationId(res);
        if (opId) {
          operationStore.start({ id: opId, title: `Удаление ${family} CIDR (${removed.length})`, resourceId: "subnets", projectId });
        }
      }
      qc.invalidateQueries({ queryKey: ["subnets"] });
    },
  });

  function startEdit() {
    setDrafts(blocks.length === 0 ? [""] : [...blocks]);
  }
  function cancel() {
    setDrafts(null);
  }
  function addRow() {
    setDrafts((prev) => [...(prev ?? []), ""]);
  }
  function removeRow(index: number) {
    setDrafts((prev) => (prev ?? []).filter((_, i) => i !== index));
  }
  function setRow(index: number, value: string) {
    setDrafts((prev) => (prev ?? []).map((r, i) => (i === index ? value : r)));
  }

  async function save() {
    try {
      await mutation.mutateAsync();
      cancel();
    } catch (err) {
      const m = err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
      toast.error(`${family} CIDR: ${m}`);
    }
  }

  const count = editing ? (drafts?.length ?? 0) : blocks.length;

  const headerRight = editing ? (
    <Space>
      <Button type="primary" loading={mutation.isPending} onClick={save}>
        Сохранить
      </Button>
      <Button disabled={mutation.isPending} onClick={cancel}>
        Отменить
      </Button>
    </Space>
  ) : (
    <Button icon={<EditOutlined />} onClick={startEdit}>
      Редактировать
    </Button>
  );

  const showTable = editing || blocks.length > 0;

  return (
    <div style={{ marginTop: 24, maxWidth: 760 }}>
      <SectionHeader
        icon={familyTile(family)}
        eyebrow="Список"
        title={
          <span>
            CIDR <Typography.Text type="secondary">({count})</Typography.Text>
          </span>
        }
        right={headerRight}
      />

      {showTable ? (
        <div
          style={{
            border: "1px solid var(--kc-border)",
            borderRadius: 8,
            overflow: "hidden",
            background: "var(--kc-page)",
          }}
        >
          <table className="w-full text-sm kc-grid-table" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "calc(100% - 48px)" }} />
              <col style={{ width: 48 }} />
            </colgroup>
            <thead>
              <tr style={{ background: "var(--kc-container)" }}>
                <th
                  className="text-left"
                  style={{ padding: "7px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.02em", color: "var(--kc-text-tertiary)" }}
                >
                  CIDR-блок
                </th>
                <th style={{ padding: "7px 4px" }} />
              </tr>
            </thead>
            <tbody>
              {editing
                ? (drafts ?? []).map((cidr, i) => (
                    <tr key={i} className="kc-kv-row" style={{ height: ROW_H, borderTop: "1px solid var(--kc-border-secondary)" }}>
                      <td className="px-3 font-mono text-xs" style={{ verticalAlign: "middle" }}>
                        <Input
                          variant="borderless"
                          placeholder={placeholder}
                          value={cidr}
                          onChange={(e) => setRow(i, e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>
                      <td className="px-1 text-center" style={{ verticalAlign: "middle" }}>
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          aria-label="Удалить CIDR"
                          onClick={() => removeRow(i)}
                        />
                      </td>
                    </tr>
                  ))
                : blocks.map((cidr, i) => (
                    <tr key={i} className="kc-kv-row" style={{ height: ROW_H, borderTop: "1px solid var(--kc-border-secondary)" }}>
                      <td className="px-3 font-mono text-xs" style={{ verticalAlign: "middle" }}>
                        {cidr}
                      </td>
                      <td className="px-1" />
                    </tr>
                  ))}
            </tbody>
            {editing && (
              <tfoot>
                <tr style={{ borderTop: "1px solid var(--kc-border-secondary)" }}>
                  <td style={{ padding: "8px 12px" }} colSpan={2}>
                    <Button type="dashed" block icon={<PlusOutlined />} onClick={addRow}>
                      Добавить CIDR
                    </Button>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <div
          style={{
            border: "1px dashed var(--kc-border)",
            borderRadius: 8,
            padding: "24px 12px",
            textAlign: "center",
            fontSize: 13,
            color: "var(--kc-text-tertiary)",
          }}
        >
          CIDR-блоков нет — нажмите «Редактировать», чтобы добавить.
        </div>
      )}
    </div>
  );
}
