// RoutesPanel — управление статическими маршрутами RouteTable (KAC-239 S3-UI).
//
// UX (по фидбэку заказчика): read-only список + кнопка «Редактировать», которая
// раскрывает ВСЕ маршруты в editable-строки (CIDR + next-hop + мусорное ведёрко
// для удаления строки) + «+ ещё маршрут» (dashed-кнопка в общей стилистике).
// «Сохранить» применяет весь набор разом (full-replace static_routes + update_mask),
// «Отменить» — выходит без изменений.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Space, Typography } from "antd";
import { DeleteOutlined, PlusOutlined, EditOutlined } from "@ant-design/icons";
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
  routes: StaticRoute[];
}

interface DraftRoute {
  destination_prefix: string;
  next_hop_address: string;
}

function toDraft(r: StaticRoute): DraftRoute {
  return {
    destination_prefix: r.destination_prefix ?? "",
    next_hop_address: r.next_hop_address ?? "",
  };
}

export function RoutesPanel({ routeTableId, projectId, routes }: Props) {
  const rtSpec = REGISTRY["route-tables"];
  const qc = useQueryClient();

  const [drafts, setDrafts] = useState<DraftRoute[] | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: unknown) => api.update(`${rtSpec.apiPath}/${routeTableId}`, payload),
  });

  const startEdit = () =>
    setDrafts(routes.length ? routes.map(toDraft) : [{ destination_prefix: "", next_hop_address: "" }]);
  const cancel = () => setDrafts(null);

  const setRow = (i: number, patch: Partial<DraftRoute>) =>
    setDrafts((d) => (d ? d.map((row, idx) => (idx === i ? { ...row, ...patch } : row)) : d));
  const addRow = () => setDrafts((d) => [...(d ?? []), { destination_prefix: "", next_hop_address: "" }]);
  const removeRow = (i: number) => setDrafts((d) => (d ? d.filter((_, idx) => idx !== i) : d));

  const save = async () => {
    const next: StaticRoute[] = (drafts ?? [])
      .map((r) => ({
        destination_prefix: r.destination_prefix.trim(),
        next_hop_address: r.next_hop_address.trim(),
      }))
      .filter((r) => r.destination_prefix && r.next_hop_address);
    try {
      const resp = await mutation.mutateAsync({ static_routes: next, update_mask: "static_routes" });
      const opId = extractOperationId(resp as Parameters<typeof extractOperationId>[0]);
      if (opId) {
        operationStore.start({
          id: opId,
          title: `Сохранение маршрутов (${next.length})`,
          resourceId: rtSpec.id,
          projectId,
        });
      }
      qc.invalidateQueries({ queryKey: [rtSpec.id] });
      cancel();
    } catch (err) {
      const m = err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
      toast.error(`Статические маршруты: ${m}`);
    }
  };

  if (drafts) {
    return (
      <div style={{ marginTop: 24 }}>
        <SectionHeader title="Редактирование статических маршрутов" />
        <Space direction="vertical" size={8} style={{ width: "100%", maxWidth: 760 }}>
          {drafts.map((row, i) => (
            <Space.Compact key={i} style={{ width: "100%" }}>
              <Input
                placeholder="Префикс назначения (10.0.0.0/24)"
                value={row.destination_prefix}
                onChange={(e) => setRow(i, { destination_prefix: e.target.value })}
                style={{ width: "46%", fontFamily: "ui-monospace, monospace" }}
              />
              <Input
                placeholder="Next hop (10.0.0.1)"
                value={row.next_hop_address}
                onChange={(e) => setRow(i, { next_hop_address: e.target.value })}
                style={{ width: "46%", fontFamily: "ui-monospace, monospace" }}
              />
              <Button danger icon={<DeleteOutlined />} onClick={() => removeRow(i)} aria-label="Удалить маршрут" />
            </Space.Compact>
          ))}
          <Button type="dashed" block icon={<PlusOutlined />} onClick={addRow} style={{ maxWidth: 760 }}>
            ещё маршрут
          </Button>
        </Space>
        <Space style={{ marginTop: 16 }}>
          <Button type="primary" onClick={save} loading={mutation.isPending}>
            Сохранить
          </Button>
          <Button onClick={cancel} disabled={mutation.isPending}>
            Отменить
          </Button>
        </Space>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24 }}>
      <SectionHeader
        title={<>Статические маршруты <Typography.Text type="secondary">({routes.length})</Typography.Text></>}
        right={
          <Button type="primary" icon={<EditOutlined />} onClick={startEdit}>
            Редактировать
          </Button>
        }
      />
      {routes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Статических маршрутов нет — нажмите «Редактировать», чтобы добавить.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2">Префикс назначения</th>
                <th className="text-left px-3 py-2">Next hop</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r, i) => (
                <tr key={i} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs">{r.destination_prefix || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.next_hop_address || r.gateway_id || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
