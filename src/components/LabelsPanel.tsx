// LabelsPanel — метки ресурса (map<string,string>) как ОДНА таблица в обоих
// режимах, по образцу RoutesPanel (Статические маршруты).
//
// Read mode : текстовые ячейки Ключ/Значение, header-action «Редактировать».
//             0 меток → dashed-плейсхолдер.
// Edit mode : те же колонки — каждая ячейка становится borderless <Input>,
//             правая колонка — per-row trash, снизу dashed «Добавить метку».
//             Header-action → «Сохранить» + «Отменить».
//
// No-jump: table-layout:fixed + <colgroup> фиксируют ширины; колонка действий
// всегда отрисована (пустая в read); фикс-высота строки. save() — full-replace
// update (labels + update_mask) + async Operation. Theme-aware.

import { useState } from "react";
import { Button, Input, Space, Typography } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { extractOperationId } from "@/components/OperationDialog";
import { SectionHeader } from "@/components/SectionHeader";
import { operationStore } from "@/lib/use-operation-store";
import { toast } from "@/lib/toast";

interface LabelsPanelProps {
  /** registry id ресурса — для invalidate. */
  resourceId: string;
  /** spec.apiPath (например /vpc/v1/subnets). */
  apiPath: string;
  /** id ресурса. */
  uid: string;
  projectId: string | null;
  labels?: Record<string, string> | null;
}

interface DraftLabel {
  key: string;
  value: string;
}

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

export function LabelsPanel({ resourceId, apiPath, uid, projectId, labels }: LabelsPanelProps) {
  const qc = useQueryClient();
  const entries = Object.entries(labels ?? {});
  const [drafts, setDrafts] = useState<DraftLabel[] | null>(null);
  const editing = drafts !== null;

  const mutation = useMutation({
    mutationFn: async () => {
      const next: Record<string, string> = {};
      for (const d of drafts ?? []) {
        const k = d.key.trim();
        if (k !== "") next[k] = d.value.trim();
      }
      const res = await api.update(`${apiPath}/${uid}`, {
        labels: next,
        update_mask: "labels",
      });
      const operationId = extractOperationId(res);
      if (operationId) {
        operationStore.start({
          id: operationId,
          title: `Сохранение меток (${Object.keys(next).length})`,
          resourceId,
          projectId,
        });
      }
      qc.invalidateQueries({ queryKey: [resourceId] });
    },
  });

  function startEdit() {
    setDrafts(
      entries.length === 0
        ? [{ key: "", value: "" }]
        : entries.map(([key, value]) => ({ key, value })),
    );
  }
  function cancel() {
    setDrafts(null);
  }
  function addRow() {
    setDrafts((prev) => [...(prev ?? []), { key: "", value: "" }]);
  }
  function removeRow(index: number) {
    setDrafts((prev) => (prev ?? []).filter((_, i) => i !== index));
  }
  function setRow(index: number, patch: Partial<DraftLabel>) {
    setDrafts((prev) => (prev ?? []).map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  async function save() {
    try {
      await mutation.mutateAsync();
      cancel();
    } catch (err) {
      const m = err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
      toast.error(`Метки: ${m}`);
    }
  }

  const count = editing ? (drafts?.length ?? 0) : entries.length;

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

  const showTable = editing || entries.length > 0;

  return (
    <div style={{ marginTop: 24, maxWidth: 760 }}>
      <SectionHeader
        title={
          <span>
            Метки <Typography.Text type="secondary">({count})</Typography.Text>
          </span>
        }
        right={headerRight}
      />

      {showTable ? (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "calc((100% - 48px) / 2)" }} />
              <col style={{ width: "calc((100% - 48px) / 2)" }} />
              <col style={{ width: 48 }} />
            </colgroup>
            <thead>
              <tr className="bg-muted/40 text-xs uppercase tracking-wide">
                <th className="text-left px-3 py-2">Ключ</th>
                <th className="text-left px-3 py-2">Значение</th>
                <th className="px-1 py-2" />
              </tr>
            </thead>
            <tbody>
              {editing
                ? (drafts ?? []).map((row, i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/20" style={{ height: ROW_H }}>
                      <td className="px-3 font-mono text-xs" style={{ verticalAlign: "middle" }}>
                        <Input
                          variant="borderless"
                          placeholder="env"
                          value={row.key}
                          onChange={(e) => setRow(i, { key: e.target.value })}
                          style={cellInputStyle}
                        />
                      </td>
                      <td className="px-3 font-mono text-xs" style={{ verticalAlign: "middle" }}>
                        <Input
                          variant="borderless"
                          placeholder="prod"
                          value={row.value}
                          onChange={(e) => setRow(i, { value: e.target.value })}
                          style={cellInputStyle}
                        />
                      </td>
                      <td className="px-1 text-center" style={{ verticalAlign: "middle" }}>
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          aria-label="Удалить метку"
                          onClick={() => removeRow(i)}
                        />
                      </td>
                    </tr>
                  ))
                : entries.map(([k, v], i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/20" style={{ height: ROW_H }}>
                      <td className="px-3 font-mono text-xs" style={{ verticalAlign: "middle" }}>
                        {k}
                      </td>
                      <td className="px-3 font-mono text-xs" style={{ verticalAlign: "middle" }}>
                        {v}
                      </td>
                      <td className="px-1" />
                    </tr>
                  ))}
            </tbody>
            {editing && (
              <tfoot>
                <tr className="border-t border-border">
                  <td className="px-3 py-2" colSpan={3}>
                    <Button type="dashed" block icon={<PlusOutlined />} onClick={addRow}>
                      Добавить метку
                    </Button>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          Меток нет — нажмите «Редактировать», чтобы добавить.
        </div>
      )}
    </div>
  );
}
