// OperationsTable — generic вид списка LRO-операций.
// Используется в:
//   • OperationsTab (per-resource detail-page)
//   • OperationsPage (global folder-level)
//
// Колонки: Идентификатор / Статус (icon+string) / Пользователь (string) /
//          Операция / Дата начала / Дата изменения / Сообщение об ошибке /
//          Идентификатор ресурса.
//
// Фильтры — приходят сверху (по id и status; глобальная страница добавляет
// фильтр по типу ресурса).

import { Empty, Space, Table, Typography } from "antd";
import {
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
  MinusCircleFilled,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { CopyableId } from "@/components/CopyableId";

export type OperationStatus = "running" | "done" | "error" | "cancelled";

export interface Op {
  id: string;
  description?: string;
  created_at?: string;
  modified_at?: string;
  created_by?: string;
  done?: boolean;
  error?: { code?: number | string; message?: string };
  metadata?: Record<string, unknown>;
  /** Заполняется через aggregation либо парсингом metadata.<resource>_id. */
  resource_id?: string;
  /** Тип ресурса (registry id). Заполняется при aggregation в global-странице. */
  resource_kind?: string;
}

export function statusOf(op: Op): OperationStatus {
  if (!op.done) return "running";
  if (op.error) {
    return Number(op.error.code) === 1 ? "cancelled" : "error";
  }
  return "done";
}

export function statusLabel(s: OperationStatus): string {
  switch (s) {
    case "running":
      return "Выполняется";
    case "done":
      return "Выполнена";
    case "error":
      return "Ошибка";
    case "cancelled":
      return "Отменена";
  }
}

function statusCell(op: Op) {
  const s = statusOf(op);
  const iconStyle = { fontSize: 16 };
  const icon =
    s === "done" ? (
      <CheckCircleFilled style={{ ...iconStyle, color: "#52c41a" }} />
    ) : s === "error" ? (
      <CloseCircleFilled style={{ ...iconStyle, color: "#ff4d4f" }} />
    ) : s === "cancelled" ? (
      <MinusCircleFilled style={{ ...iconStyle, color: "#8c8c8c" }} />
    ) : (
      <LoadingOutlined style={{ ...iconStyle, color: "#faad14" }} spin />
    );
  return (
    <Space size={6}>
      {icon}
      <span>{statusLabel(s)}</span>
    </Space>
  );
}

function fmtTs(ts?: string): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

interface Props {
  rows: Op[];
  loading?: boolean;
  /** Когда true — показывать колонку "Тип ресурса" (для global-страницы). */
  showResourceKind?: boolean;
  /** Когда true — показывать пустое состояние при rows.length===0 и !loading. */
  empty?: boolean;
}

export function OperationsTable({ rows, loading, showResourceKind, empty }: Props) {
  const columns: ColumnsType<Op> = [
    {
      title: "Идентификатор",
      dataIndex: "id",
      key: "id",
      width: 240,
      render: (v: string) => <CopyableId id={v} />,
    },
    {
      title: "Статус",
      key: "status",
      width: 160,
      render: (_v, op) => statusCell(op),
    },
    {
      title: "Пользователь",
      dataIndex: "created_by",
      key: "created_by",
      width: 200,
      render: (v: string | undefined) => v || "—",
    },
    {
      title: "Операция",
      dataIndex: "description",
      key: "description",
      render: (v: string | undefined, op) =>
        v || <Typography.Text type="secondary">{op.id}</Typography.Text>,
    },
    {
      title: "Дата начала",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (v: string) => fmtTs(v),
    },
    {
      title: "Дата изменения",
      dataIndex: "modified_at",
      key: "modified_at",
      width: 180,
      render: (v: string) => fmtTs(v),
    },
    {
      title: "Сообщение об ошибке",
      key: "error",
      render: (_v, op) =>
        op.error?.message ? (
          <Typography.Text type="danger" style={{ whiteSpace: "pre-wrap" }}>
            {op.error.message}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    ...(showResourceKind
      ? ([
          {
            title: "Тип ресурса",
            dataIndex: "resource_kind",
            key: "resource_kind",
            width: 160,
            render: (v: string | undefined) => v || "—",
          },
        ] as ColumnsType<Op>)
      : []),
    {
      title: "Идентификатор ресурса",
      dataIndex: "resource_id",
      key: "resource_id",
      width: 240,
      render: (v: string | undefined) => (v ? <CopyableId id={v} /> : "—"),
    },
  ];

  return (
    <Table<Op>
      rowKey="id"
      dataSource={rows}
      columns={columns}
      loading={loading}
      size="small"
      pagination={false}
      locale={{
        emptyText: (
          <Empty
            description={
              <Typography.Text type="secondary">
                {empty ? "По фильтру ничего не найдено." : "Операций пока нет."}
              </Typography.Text>
            }
          />
        ),
      }}
    />
  );
}
