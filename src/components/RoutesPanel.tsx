// RoutesPanel — static routes of a RouteTable rendered as ONE shared table in both modes.
//
// Read mode  : text cells, no trash column, header action «Редактировать».
//              0 routes => dashed placeholder instead of the table.
// Edit mode  : same table/columns, each cell becomes a seamless borderless <Input>
//              (blended into the cell so the layout does not jump), a narrow trash
//              column appears on the right with a per-row delete button, and a
//              full-width dashed «Добавить маршрут» footer row appears below the rows.
//              Header action becomes «Сохранить» + «Отменить».
//
// The SectionHeader title stays «Статические маршруты (N)» in BOTH modes.
// save() does a full-replace update (static_routes + update_mask) and starts an
// async Operation, exactly as before — no behaviour change to the save payload.

import { useState } from "react";
import { Button, Input, Space, Typography } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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

interface RoutesPanelProps {
  routeTableId: string;
  projectId: string | null;
  routes: StaticRoute[];
}

interface DraftRoute {
  destination_prefix: string;
  next_hop_address: string;
}

const MONO_FONT = "ui-monospace, monospace";

const rtSpec = REGISTRY["route-tables"];

export function RoutesPanel({ routeTableId, projectId, routes }: RoutesPanelProps) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<DraftRoute[] | null>(null);

  const editing = drafts !== null;

  const mutation = useMutation({
    mutationFn: async () => {
      const next = (drafts ?? [])
        .map((r) => ({
          destination_prefix: r.destination_prefix.trim(),
          next_hop_address: r.next_hop_address.trim(),
        }))
        .filter((r) => r.destination_prefix !== "" && r.next_hop_address !== "");

      const res = await api.update(`${rtSpec.apiPath}/${routeTableId}`, {
        static_routes: next,
        update_mask: "static_routes",
      });

      const operationId = extractOperationId(res);
      if (operationId) {
        operationStore.start({
          id: operationId,
          title: `Сохранение маршрутов (${next.length})`,
          resourceId: rtSpec.id,
          projectId,
        });
      }

      qc.invalidateQueries({ queryKey: [rtSpec.id] });
    },
  });

  function startEdit() {
    if (routes.length === 0) {
      setDrafts([{ destination_prefix: "", next_hop_address: "" }]);
      return;
    }
    setDrafts(
      routes.map((r) => ({
        destination_prefix: r.destination_prefix ?? "",
        next_hop_address: r.next_hop_address ?? r.gateway_id ?? "",
      })),
    );
  }

  function cancel() {
    setDrafts(null);
  }

  function addRow() {
    setDrafts((prev) => [...(prev ?? []), { destination_prefix: "", next_hop_address: "" }]);
  }

  function removeRow(index: number) {
    setDrafts((prev) => (prev ?? []).filter((_, i) => i !== index));
  }

  function setRow(index: number, patch: Partial<DraftRoute>) {
    setDrafts((prev) =>
      (prev ?? []).map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  }

  async function save() {
    try {
      await mutation.mutateAsync();
      cancel();
    } catch (err) {
      const m =
        err instanceof ApiError
          ? `${err.code}: ${err.message}`
          : (err as Error).message;
      toast.error(`Статические маршруты: ${m}`);
    }
  }

  const count = editing ? (drafts?.length ?? 0) : routes.length;

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
    <Button type="primary" icon={<EditOutlined />} onClick={startEdit}>
      Редактировать
    </Button>
  );

  const showTable = editing || routes.length > 0;

  return (
    <div style={{ marginTop: 24, maxWidth: 760 }}>
      <SectionHeader
        title={
          <span>
            Статические маршруты{" "}
            <Typography.Text type="secondary">({count})</Typography.Text>
          </span>
        }
        right={headerRight}
      />

      {showTable ? (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-xs uppercase tracking-wide">
                <th className="text-left px-3 py-2">Префикс назначения</th>
                <th className="text-left px-3 py-2">Следующий узел</th>
                {editing && <th style={{ width: 44 }} />}
              </tr>
            </thead>
            <tbody>
              {editing
                ? (drafts ?? []).map((row, i) => (
                    <tr
                      key={i}
                      className="border-t border-border hover:bg-muted/20"
                    >
                      <td className="px-3 py-2 font-mono text-xs">
                        <Input
                          variant="borderless"
                          placeholder="10.0.0.0/24"
                          value={row.destination_prefix}
                          onChange={(e) =>
                            setRow(i, { destination_prefix: e.target.value })
                          }
                          style={{ width: "100%", fontFamily: MONO_FONT, padding: "4px 0" }}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        <Input
                          variant="borderless"
                          placeholder="10.0.0.1"
                          value={row.next_hop_address}
                          onChange={(e) =>
                            setRow(i, { next_hop_address: e.target.value })
                          }
                          style={{ width: "100%", fontFamily: MONO_FONT, padding: "4px 0" }}
                        />
                      </td>
                      <td className="px-1 py-2 text-center">
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          aria-label="Удалить маршрут"
                          onClick={() => removeRow(i)}
                        />
                      </td>
                    </tr>
                  ))
                : routes.map((r, i) => (
                    <tr
                      key={i}
                      className="border-t border-border hover:bg-muted/20"
                    >
                      <td className="px-3 py-2 font-mono text-xs">
                        {r.destination_prefix}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {r.next_hop_address || r.gateway_id}
                      </td>
                    </tr>
                  ))}
            </tbody>
            {editing && (
              <tfoot>
                <tr className="border-t border-border">
                  <td className="px-3 py-2" colSpan={3}>
                    <Button
                      type="dashed"
                      block
                      icon={<PlusOutlined />}
                      onClick={addRow}
                    >
                      Добавить маршрут
                    </Button>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          Статических маршрутов нет — нажмите «Редактировать», чтобы добавить.
        </div>
      )}
    </div>
  );
}
