// SgRulesPanel — управление правилами Security Group по одному (KAC-239).
//
// Заменяет read-only RulesTable в табах «Входящий/Исходящий трафик» SG detail.
// Режимы: list (таблица с per-row ⋮ Редактировать/Удалить + «Добавить правило»)
// ↔ edit (редактор ОДНОГО правила через SgRulesEditor).
//
// Бэкенд: PATCH /vpc/v1/securityGroups/<id>/rules (UpdateRules) с
// { deletion_rule_ids, addition_rule_specs }. Каждая операция — над одним
// правилом (правила имеют стабильный id после KAC-239 backend-фикса):
//   • add    → { addition_rule_specs: [spec] }
//   • edit   → { deletion_rule_ids: [id], addition_rule_specs: [spec] }
//   • delete → { deletion_rule_ids: [id] }
// Это правка ОДНОГО правила, а не всего ресурса SG.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Dropdown, Space, Typography } from "antd";
import { MoreOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { ApiError, api } from "@/api/client";
import { extractOperationId } from "@/components/OperationDialog";
import { SectionHeader } from "@/components/SectionHeader";
import { SgRulesEditor } from "@/components/form/SgRulesEditor";
import { DeleteDialog } from "@/components/DeleteDialog";
import { REGISTRY, sanitizeSgRule } from "@/lib/resource-registry";
import { operationStore } from "@/lib/use-operation-store";
import { toast } from "@/lib/toast";

export interface SgRule {
  id?: string;
  direction?: string;
  description?: string;
  protocol_name?: string;
  protocol_number?: number;
  ports?: { from_port?: number | string; to_port?: number | string };
  cidr_blocks?: { v4_cidr_blocks?: string[]; v6_cidr_blocks?: string[] };
  security_group_id?: string;
  predefined_target?: string;
  [k: string]: unknown;
}

interface Props {
  sgId: string;
  projectId: string | null;
  /** "INGRESS" | "EGRESS" — направление этого таба. */
  direction: "INGRESS" | "EGRESS";
  /** Заголовок таба («Входящий трафик» / «Исходящий трафик»). */
  title: string;
  /** Все правила SG (из detail). Фильтруются по direction. */
  allRules: SgRule[];
}

function protoLabel(r: SgRule): string {
  if (r.protocol_name) return r.protocol_name;
  if (typeof r.protocol_number === "number") return `proto ${r.protocol_number}`;
  return "Any";
}
function portsLabel(r: SgRule): string {
  if (!r.ports) return "—";
  const f = r.ports.from_port;
  const t = r.ports.to_port;
  if (f == null && t == null) return "—";
  if (f === t || t == null) return String(f);
  return `${f}–${t}`;
}
function targetParts(r: SgRule): { kind: string; value: string } {
  if (r.cidr_blocks) {
    const v4 = r.cidr_blocks.v4_cidr_blocks ?? [];
    const v6 = r.cidr_blocks.v6_cidr_blocks ?? [];
    return { kind: "CIDR", value: [...v4, ...v6].join(", ") || "—" };
  }
  if (r.security_group_id) return { kind: "SG", value: r.security_group_id };
  if (r.predefined_target) return { kind: "Predefined", value: r.predefined_target };
  return { kind: "—", value: "—" };
}

export function SgRulesPanel({ sgId, projectId, direction, title, allRules }: Props) {
  const sgSpec = REGISTRY["security-groups"];
  const qc = useQueryClient();
  const rules = allRules.filter(
    (r) => (r.direction ?? "INGRESS").toUpperCase() === direction,
  );

  // mode: null = список; иначе редактор одного правила (obj = {rules:[rule]}).
  const [editObj, setEditObj] = useState<Record<string, unknown> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null); // null = добавление
  const [delRule, setDelRule] = useState<SgRule | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: unknown) => api.update(`${sgSpec.apiPath}/${sgId}/rules`, payload),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: [sgSpec.id] });

  const runOp = async (payload: { deletion_rule_ids?: string[]; addition_rule_specs?: unknown[] }, opTitle: string) => {
    try {
      const resp = await mutation.mutateAsync(payload);
      const opId = extractOperationId(resp as Parameters<typeof extractOperationId>[0]);
      if (opId) operationStore.start({ id: opId, title: opTitle, resourceId: sgSpec.id, projectId });
      refresh();
    } catch (err) {
      const m = err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
      toast.error(`Правило группы безопасности: ${m}`);
    }
  };

  const startAdd = () => {
    setEditingId(null);
    setEditObj({ rules: [{ direction }] });
  };
  const startEdit = (r: SgRule) => {
    setEditingId(r.id ?? null);
    setEditObj({ rules: [{ ...r }] });
  };
  const cancelEdit = () => {
    setEditObj(null);
    setEditingId(null);
  };

  const saveEdit = async () => {
    const arr = (editObj?.rules as SgRule[] | undefined) ?? [];
    const raw = arr[0];
    if (!raw) {
      cancelEdit();
      return;
    }
    const clean = sanitizeSgRule({ ...raw, direction });
    delete clean.id;
    const payload: { deletion_rule_ids?: string[]; addition_rule_specs?: unknown[] } = {
      addition_rule_specs: [clean],
    };
    if (editingId) payload.deletion_rule_ids = [editingId]; // edit = delete+add по id
    cancelEdit();
    await runOp(payload, editingId ? "Изменение правила группы безопасности" : "Добавление правила группы безопасности");
  };

  // ── режим редактора одного правила ──
  if (editObj) {
    return (
      <div>
        <SectionHeader title={`${editingId ? "Редактирование" : "Добавление"} правила · ${title.toLowerCase()}`} />
        <SgRulesEditor
          pathPrefix=""
          value={editObj}
          onChange={setEditObj}
          path="rules"
          description="Direction зафиксирован по вкладке. Protocol/ports/target — по необходимости."
        />
        <Space style={{ marginTop: 16 }}>
          <Button type="primary" onClick={saveEdit} loading={mutation.isPending}>
            Сохранить
          </Button>
          <Button onClick={cancelEdit} disabled={mutation.isPending}>
            Отменить
          </Button>
        </Space>
      </div>
    );
  }

  // ── режим списка ──
  return (
    <div>
      <SectionHeader
        title={<>{title} <Typography.Text type="secondary">({rules.length})</Typography.Text></>}
        right={
          <Button type="primary" icon={<PlusOutlined />} onClick={startAdd}>
            Добавить правило
          </Button>
        }
      />
      {rules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Правил нет — трафик блокируется (default-deny).
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2">Протокол</th>
                <th className="text-left px-3 py-2">Диапазон портов</th>
                <th className="text-left px-3 py-2">Тип источника</th>
                <th className="text-left px-3 py-2">Источник</th>
                <th className="text-left px-3 py-2">Описание</th>
                <th className="px-3 py-2" style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => {
                const tgt = targetParts(r);
                return (
                  <tr key={r.id ?? i} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2">{protoLabel(r)}</td>
                    <td className="px-3 py-2">{portsLabel(r)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{tgt.kind}</td>
                    <td className="px-3 py-2 font-mono text-xs">{tgt.value}</td>
                    <td className="px-3 py-2 text-xs">{r.description || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <Dropdown
                        trigger={["click"]}
                        placement="bottomRight"
                        menu={{
                          items: [
                            { key: "edit", icon: <EditOutlined />, label: "Редактировать", onClick: () => startEdit(r) },
                            { type: "divider" as const },
                            {
                              key: "delete",
                              icon: <DeleteOutlined />,
                              label: "Удалить",
                              danger: true,
                              disabled: !r.id,
                              onClick: () => setDelRule(r),
                            },
                          ],
                        }}
                      >
                        <Button type="text" size="small" icon={<MoreOutlined />} aria-label="Действия" />
                      </Dropdown>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DeleteDialog
        open={!!delRule}
        onOpenChange={(o) => !o && setDelRule(null)}
        apiPath={`${sgSpec.apiPath}/${sgId}/rules`}
        resourceId="правило"
        resourceLabel="правило"
        name={delRule ? `${protoLabel(delRule)} · ${targetParts(delRule).value}` : ""}
        projectId={projectId}
        onConfirm={() => {
          const id = delRule?.id;
          setDelRule(null);
          if (id) void runOp({ deletion_rule_ids: [id] }, "Удаление правила группы безопасности");
        }}
      />
    </div>
  );
}
