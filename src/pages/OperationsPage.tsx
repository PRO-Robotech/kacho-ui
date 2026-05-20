// OperationsPage — project-scoped global список LRO операций по всем VPC ресурсам.
// Aggregation client-side: для каждого VPC-resource type списком собираются
// ресурсы проекта, затем по каждому делается ListOperations. Все операции
// объединяются и сортируются по created_at desc.
//
// Фильтры: id / Статус / Тип ресурса.

import { useMemo, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Select, Space, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { api } from "@/api/client";
import { useBreadcrumb, useHeaderRight } from "@/components/PageHeaderSlot";
import { ErrorResult } from "@/components/ErrorResult";
import {
  OperationsTable,
  type Op,
  statusOf,
  type OperationStatus,
} from "@/components/OperationsTable";
import { useProjectStore } from "@/lib/context-store";
import { REGISTRY } from "@/lib/resource-registry";

// Список VPC-ресурсов, у которых есть per-resource ListOperations.
const VPC_RESOURCES = [
  { id: "networks", label: "Network" },
  { id: "subnets", label: "Subnet" },
  { id: "network-interfaces", label: "Network Interface" },
  { id: "addresses", label: "Address" },
  { id: "route-tables", label: "Route Table" },
  { id: "security-groups", label: "Security Group" },
  { id: "gateways", label: "Gateway" },
] as const;

const STATUS_OPTIONS: { value: OperationStatus | "all"; label: string }[] = [
  { value: "all", label: "Все статусы" },
  { value: "running", label: "Выполняется" },
  { value: "done", label: "Выполнена" },
  { value: "error", label: "Ошибка" },
  { value: "cancelled", label: "Отменена" },
];

const KIND_OPTIONS = [
  { value: "all", label: "Все типы" },
  ...VPC_RESOURCES.map((r) => ({ value: r.id, label: r.label })),
];

interface ResListResp {
  // Динамическое поле: payloadKey → массив ресурсов
  [k: string]: Array<{ id: string }> | string | undefined;
}

export function OperationsPage() {
  const project = useProjectStore((s) => s.project);
  const projectId = project?.id ?? null;
  const qc = useQueryClient();

  const headerRight = useMemo(
    () => (
      <Button
        size="small"
        icon={<ReloadOutlined />}
        onClick={() =>
          qc.invalidateQueries({
            predicate: (q) =>
              Array.isArray(q.queryKey) && q.queryKey[1] === "operations",
          })
        }
      >
        Обновить
      </Button>
    ),
    [qc],
  );
  useHeaderRight(headerRight);

  const breadcrumb = useMemo(
    () => (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Typography.Text type="secondary">Virtual Private Cloud</Typography.Text>
        <Typography.Text type="secondary">/</Typography.Text>
        <Typography.Text strong>Операции</Typography.Text>
      </span>
    ),
    [],
  );
  useBreadcrumb(breadcrumb);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OperationStatus | "all">("all");
  const [kind, setKind] = useState<string>("all");

  // 1) для каждого VPC-resource type грузим список ресурсов проекта.
  const listQueries = useQueries({
    queries: VPC_RESOURCES.map((r) => {
      const spec = REGISTRY[r.id];
      return {
        queryKey: [r.id, "list-for-ops", projectId],
        queryFn: () =>
          api.list<ResListResp>(spec.apiPath, {
            project_id: projectId!,
            pageSize: "200",
          }),
        enabled: !!projectId && !!spec,
        staleTime: 30_000,
      };
    }),
  });

  // 2) собираем плоский список (resourceId, kind, apiPath).
  const targets = useMemo(() => {
    if (!projectId) return [];
    const out: { id: string; kind: string; apiPath: string }[] = [];
    VPC_RESOURCES.forEach((r, i) => {
      const spec = REGISTRY[r.id];
      const resp = listQueries[i].data;
      const list = (resp?.[spec.payloadKey] as Array<{ id: string }> | undefined) ?? [];
      list.forEach((item) => {
        if (item?.id) out.push({ id: item.id, kind: r.id, apiPath: spec.apiPath });
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, ...listQueries.map((q) => q.dataUpdatedAt)]);

  // 3) для каждого target грузим operations.
  const opsQueries = useQueries({
    queries: targets.map((t) => ({
      queryKey: [t.kind, "operations", t.id],
      queryFn: () =>
        api.list<{ operations: Op[] }>(`${t.apiPath}/${t.id}/operations`, {
          pageSize: "50",
        }),
      enabled: true,
      staleTime: 5_000,
      refetchInterval: 10_000,
    })),
  });

  const isLoading =
    listQueries.some((q) => q.isLoading) || opsQueries.some((q) => q.isLoading);

  // 4) merge + sort.
  const allOps = useMemo(() => {
    const out: Op[] = [];
    opsQueries.forEach((q, i) => {
      const t = targets[i];
      const ops = q.data?.operations ?? [];
      ops.forEach((o) =>
        out.push({ ...o, resource_id: o.resource_id ?? t?.id, resource_kind: t?.kind }),
      );
    });
    out.sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      return tb - ta;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opsQueries.map((q) => q.dataUpdatedAt).join(","), targets.length]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allOps.filter((o) => {
      if (kind !== "all" && o.resource_kind !== kind) return false;
      if (status !== "all" && statusOf(o) !== status) return false;
      if (!q) return true;
      return (o.id ?? "").toLowerCase().includes(q);
    });
  }, [allOps, query, status, kind]);

  if (!projectId) {
    return (
      <ErrorResult
        status="warning"
        title="Выберите проект"
        subTitle="Глобальные операции отображаются для текущего проекта."
      />
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Операции
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Все операции (LRO) по VPC-ресурсам в текущем проекте.
        </Typography.Text>
      </div>

      <Space size={8} wrap>
        <Input
          placeholder="Фильтр по идентификатору"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          allowClear
          style={{ width: 320 }}
        />
        <Select
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
          style={{ width: 200 }}
        />
        <Select
          value={kind}
          onChange={setKind}
          options={KIND_OPTIONS}
          style={{ width: 200 }}
        />
      </Space>

      <OperationsTable
        rows={filtered}
        loading={isLoading}
        showResourceKind
        empty={allOps.length > 0 && filtered.length === 0}
      />
    </Space>
  );
}
