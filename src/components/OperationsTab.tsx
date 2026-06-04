// OperationsTab — generic список операций (LRO) для конкретного ресурса.
// Использует verbatim YC pattern: GET <spec.apiPath>/{id}/operations.
//
// Фильтры: input по идентификатору + Select по статусу.
// Колонки — см. OperationsTable.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input, Select, Space, Typography } from "antd";
import { api, ApiError } from "@/api/client";
import { ErrorResult } from "@/components/ErrorResult";
import {
  OperationsTable,
  type Op,
  statusOf,
  type OperationStatus,
} from "@/components/OperationsTable";
import type { ResourceSpec } from "@/lib/resource-registry";

interface Props {
  spec: ResourceSpec;
  resourceId: string;
}

const STATUS_OPTIONS: { value: OperationStatus | "all"; label: string }[] = [
  { value: "all", label: "Все статусы" },
  { value: "running", label: "Выполняется" },
  { value: "done", label: "Выполнена" },
  { value: "error", label: "Ошибка" },
  { value: "cancelled", label: "Отменена" },
];

export function OperationsTab({ spec, resourceId }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OperationStatus | "all">("all");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [spec.id, "operations", resourceId],
    queryFn: () =>
      api.list<{ operations: Op[]; next_page_token?: string }>(
        `${spec.apiPath}/${resourceId}/operations`,
        { pageSize: "200" },
      ),
    enabled: !!resourceId,
    refetchInterval: 5_000,
    staleTime: 0,
  });

  // Хуки — ВСЕГДА до раннего return (Rules of Hooks).
  const ops = useMemo(() => {
    const raw = data?.operations ?? [];
    return raw
      .map((o) => ({ ...o, resource_id: o.resource_id ?? resourceId }))
      // новое сверху — сортировка по дате создания desc.
      .sort((a, b) => {
        const ta = a.created_at ? Date.parse(a.created_at) : 0;
        const tb = b.created_at ? Date.parse(b.created_at) : 0;
        return tb - ta;
      });
  }, [data, resourceId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ops.filter((o) => {
      if (status !== "all" && statusOf(o) !== status) return false;
      if (!q) return true;
      return (o.id ?? "").toLowerCase().includes(q);
    });
  }, [ops, query, status]);

  if (isError) {
    const httpStatus =
      error instanceof ApiError && error.status === 501 ? "404" : undefined;
    return (
      <ErrorResult
        error={error}
        status={httpStatus}
        title={httpStatus === "404" ? "404" : undefined}
        subTitle={
          httpStatus === "404"
            ? "ListOperations для этого ресурса пока не реализован."
            : undefined
        }
      />
    );
  }

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      {/* KAC-246: заголовок + фильтры в одной строке (title слева, фильтры справа). */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", width: "100%" }}>
        <Typography.Title level={4} style={{ margin: 0, flex: 1, minWidth: 0 }}>
          Операции
        </Typography.Title>
        <Space size={8} wrap style={{ flexShrink: 0 }}>
          <Input
            placeholder="Фильтр по идентификатору"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            allowClear
            style={{ width: 260 }}
          />
          <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} style={{ width: 180 }} />
        </Space>
      </div>

      <OperationsTable
        rows={filtered}
        loading={isLoading}
        empty={ops.length > 0 && filtered.length === 0}
      />
    </Space>
  );
}
