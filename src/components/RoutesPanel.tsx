// RoutesPanel — управление статическими маршрутами RouteTable (KAC-239 S3-UI).
//
// Заменяет read-only StaticRoutesTable: добавление маршрутов (несколько за раз),
// чекбоксы (per-row + select-all) + bulk-delete, отдельно от правки ресурса.
//
// Бэкенд: static_routes — JSONB-массив, RouteTable.Update принимает
// update_mask=static_routes (full-replace). Гранулярность реализуется
// read-modify-write всего набора: текущие маршруты ± изменение → PATCH.
// (Verb-RPC :add/:remove-routes есть в proto S3, но backend-хендлеры ещё нет —
// здесь full-set reconcile поверх существующего Update; UX идентичен.)

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Checkbox, Input, Modal, Space, Typography } from "antd";
import { DeleteOutlined, PlusOutlined, ExclamationCircleFilled } from "@ant-design/icons";
import { ApiError, api } from "@/api/client";
import { extractOperationId } from "@/components/OperationDialog";
import { SectionHeader } from "@/components/SectionHeader";
import { REGISTRY } from "@/lib/resource-registry";
import { operationStore } from "@/lib/use-operation-store";
import { toast } from "@/lib/toast";

export interface StaticRoute {
  destination_prefix?: string;
  next_hop_address?: string;
  gateway_id?: string;
}

interface Props {
  routeTableId: string;
  projectId: string | null;
  /** Текущие маршруты (из detail RT). */
  routes: StaticRoute[];
}

// Стабильный ключ маршрута для выбора (id у static_route нет — ключ по контенту).
function routeKey(r: StaticRoute): string {
  return `${r.destination_prefix ?? ""}→${r.next_hop_address ?? r.gateway_id ?? ""}`;
}

interface DraftRoute {
  destination_prefix: string;
  next_hop_address: string;
}

export function RoutesPanel({ routeTableId, projectId, routes }: Props) {
  const rtSpec = REGISTRY["route-tables"];
  const qc = useQueryClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<DraftRoute[] | null>(null); // null = список; иначе add-режим

  const mutation = useMutation({
    mutationFn: (payload: unknown) => api.update(`${rtSpec.apiPath}/${routeTableId}`, payload),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: [rtSpec.id] });

  // Записать новый полный набор static_routes (full-replace через update_mask).
  const writeRoutes = async (next: StaticRoute[], opTitle: string) => {
    try {
      const resp = await mutation.mutateAsync({
        static_routes: next,
        update_mask: "static_routes",
      });
      const opId = extractOperationId(resp as Parameters<typeof extractOperationId>[0]);
      if (opId) operationStore.start({ id: opId, title: opTitle, resourceId: rtSpec.id, projectId });
      refresh();
    } catch (err) {
      const m = err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
      toast.error(`Статические маршруты: ${m}`);
    }
  };

  const keys = routes.map(routeKey);
  const allSelected = keys.length > 0 && keys.every((k) => selected.has(k));
  const someSelected = keys.some((k) => selected.has(k));

  const toggleOne = (k: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });
  const toggleAll = (on: boolean) => setSelected(on ? new Set(keys) : new Set());

  const confirmDeleteSelected = () => {
    const keep = routes.filter((r) => !selected.has(routeKey(r)));
    const removed = routes.length - keep.length;
    if (removed === 0) return;
    Modal.confirm({
      title: `Удалить выбранные маршруты (${removed})`,
      icon: <ExclamationCircleFilled />,
      content: "Действие необратимо.",
      okText: "Удалить",
      okButtonProps: { danger: true },
      cancelText: "Отмена",
      onOk: async () => {
        await writeRoutes(keep, `Удаление маршрутов (${removed})`);
        setSelected(new Set());
      },
    });
  };

  // ── add-режим: форма нескольких новых маршрутов ──
  const startAdd = () => setDrafts([{ destination_prefix: "", next_hop_address: "" }]);
  const cancelAdd = () => setDrafts(null);
  const setDraft = (i: number, patch: Partial<DraftRoute>) =>
    setDrafts((d) => (d ? d.map((row, idx) => (idx === i ? { ...row, ...patch } : row)) : d));
  const addDraftRow = () => setDrafts((d) => [...(d ?? []), { destination_prefix: "", next_hop_address: "" }]);
  const removeDraftRow = (i: number) => setDrafts((d) => (d ? d.filter((_, idx) => idx !== i) : d));

  const saveAdd = async () => {
    const valid = (drafts ?? []).filter(
      (r) => r.destination_prefix.trim() && r.next_hop_address.trim(),
    );
    if (valid.length === 0) {
      cancelAdd();
      return;
    }
    const merged = [...routes, ...valid.map((r) => ({ destination_prefix: r.destination_prefix.trim(), next_hop_address: r.next_hop_address.trim() }))];
    cancelAdd();
    await writeRoutes(merged, `Добавление маршрутов (${valid.length})`);
  };

  if (drafts) {
    return (
      <div>
        <SectionHeader title="Добавление статических маршрутов" />
        <Space direction="vertical" size={8} style={{ width: "100%", maxWidth: 720 }}>
          {drafts.map((row, i) => (
            <Space.Compact key={i} style={{ width: "100%" }}>
              <Input
                placeholder="CIDR назначения (10.0.0.0/24)"
                value={row.destination_prefix}
                onChange={(e) => setDraft(i, { destination_prefix: e.target.value })}
                style={{ width: "45%", fontFamily: "ui-monospace, monospace" }}
              />
              <Input
                placeholder="Next-hop (10.0.0.1)"
                value={row.next_hop_address}
                onChange={(e) => setDraft(i, { next_hop_address: e.target.value })}
                style={{ width: "45%", fontFamily: "ui-monospace, monospace" }}
              />
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => removeDraftRow(i)}
                disabled={drafts.length === 1}
              />
            </Space.Compact>
          ))}
          <Button icon={<PlusOutlined />} onClick={addDraftRow} size="small">
            Ещё маршрут
          </Button>
        </Space>
        <Space style={{ marginTop: 16 }}>
          <Button type="primary" onClick={saveAdd} loading={mutation.isPending}>
            Сохранить
          </Button>
          <Button onClick={cancelAdd} disabled={mutation.isPending}>
            Отменить
          </Button>
        </Space>
      </div>
    );
  }

  // ── список ──
  const selCount = keys.filter((k) => selected.has(k)).length;
  return (
    <div style={{ marginTop: 24 }}>
      <SectionHeader
        title={<>Статические маршруты <Typography.Text type="secondary">({routes.length})</Typography.Text></>}
        right={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={startAdd}>
              Добавить маршрут
            </Button>
            <Button danger icon={<DeleteOutlined />} disabled={!someSelected} onClick={confirmDeleteSelected}>
              Удалить{selCount > 0 ? ` (${selCount})` : ""}
            </Button>
          </Space>
        }
      />
      {routes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Статических маршрутов нет.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2" style={{ width: 36 }}>
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected && !allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
                <th className="text-left px-3 py-2">Префикс назначения</th>
                <th className="text-left px-3 py-2">Next hop</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r, i) => {
                const k = routeKey(r);
                return (
                  <tr key={i} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <Checkbox checked={selected.has(k)} onChange={(e) => toggleOne(k, e.target.checked)} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.destination_prefix || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.next_hop_address || r.gateway_id || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
