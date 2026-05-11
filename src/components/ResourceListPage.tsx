// ResourceListPage — generic страница списка ресурсов на antd.
//
// Polling 3 сек (через useResourceList).

import { useMemo, useState } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Input, Select, Typography, Space } from "antd";
import { ErrorResult } from "@/components/ErrorResult";
import { PlusOutlined } from "@ant-design/icons";
import { api } from "@/api/client";
import { REGISTRY } from "@/lib/resource-registry";
import { ResourceTable, Column } from "@/components/ResourceTable";
import { RowActionsMenu } from "@/components/RowActionsMenu";
import { FolderRequiredEmpty } from "@/components/FolderRequiredEmpty";
import { useHeaderRight, useBreadcrumb } from "@/components/PageHeaderSlot";
import { ResourceSpec, getByPath } from "@/lib/resource-registry";
import { buildSpecColumns } from "@/lib/spec-columns";
import { useResourceList } from "@/lib/use-resource-list";

interface Props {
  spec: ResourceSpec;
  parentField?: string;
  parentParam?: string;
}

export function ResourceListPage({ spec, parentField, parentParam }: Props) {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const filterValue = parentParam ? (params[parentParam] ?? null) : null;
  const [query, setQuery] = useState("");

  const { data, isLoading, isError, error } = useResourceList(
    spec,
    parentField ?? null,
    filterValue,
  );

  const breadcrumb = useMemo(
    () => (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {spec.serviceTitle && (
          <>
            <Typography.Text type="secondary">{spec.serviceTitle}</Typography.Text>
            <Typography.Text type="secondary">/</Typography.Text>
          </>
        )}
        <Typography.Text strong>{spec.plural}</Typography.Text>
      </span>
    ),
    [spec.plural, spec.serviceTitle],
  );
  useBreadcrumb(breadcrumb);

  const createBase = location.pathname.endsWith("/")
    ? location.pathname.slice(0, -1)
    : location.pathname;

  const cta = useMemo(() => {
    if (!spec.ops.create) return null;
    return (
      <Link to={`${createBase}/create`}>
        <Button type="primary" size="small" icon={<PlusOutlined />}>
          Создать {spec.singular.toLowerCase()}
        </Button>
      </Link>
    );
  }, [spec, createBase]);

  useHeaderRight(cta);

  if (parentField && !filterValue) return <FolderRequiredEmpty resource={spec.plural} />;

  const basePath = location.pathname.endsWith("/")
    ? location.pathname.slice(0, -1)
    : location.pathname;

  const items = (data?.[spec.payloadKey] as Record<string, unknown>[] | undefined) ?? [];

  // Дополнительный фильтр "Зона доступности" — для ресурсов, у которых есть
  // понятие zone. Subnet хранит zone напрямую, Address — внутри
  // internal_ipv4_address.zone_id / external_ipv4_address.zone_id.
  const hasZoneFilter = spec.id === "subnets" || spec.id === "addresses";
  const [zone, setZone] = useState<string>("all");
  const zoneSpec = REGISTRY["zones"];
  const { data: zoneData } = useQuery({
    queryKey: ["zones", "list-for-filter"],
    queryFn: () =>
      api.list<{ zones: Array<{ id: string; name?: string }> }>(zoneSpec.apiPath, {
        pageSize: "200",
      }),
    enabled: hasZoneFilter,
    staleTime: 60_000,
  });
  const zoneOptions = useMemo(
    () => [
      { value: "all", label: "Все зоны доступности" },
      ...((zoneData?.zones ?? []).map((z) => ({
        value: z.id,
        label: z.name || z.id,
      })) as { value: string; label: string }[]),
    ],
    [zoneData],
  );

  function rowZone(row: Record<string, unknown>): string | undefined {
    if (spec.id === "subnets") return getByPath<string>(row, "zone_id");
    if (spec.id === "addresses") {
      return (
        getByPath<string>(row, "internal_ipv4_address.zone_id") ??
        getByPath<string>(row, "external_ipv4_address.zone_id")
      );
    }
    return undefined;
  }

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((row) => {
      // "Публичные IP" — это external addresses; internal IPs показываются
      // только в subnet detail (IP-адреса tab). Фильтруем по наличию
      // external_ipv4_address (либо external_ipv6_address в будущем).
      if (spec.id === "addresses") {
        const ext =
          getByPath<unknown>(row, "external_ipv4_address") ??
          getByPath<unknown>(row, "external_ipv6_address");
        if (!ext) return false;
      }
      if (hasZoneFilter && zone !== "all" && rowZone(row) !== zone) return false;
      if (!q) return true;
      const name = (getByPath<string>(row, "name") ?? "").toLowerCase();
      const id = (getByPath<string>(row, "id") ?? "").toLowerCase();
      return name.includes(q) || id.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query, zone, hasZoneFilter, spec.id]);

  // params.folderId доступен для folder-scoped listов (/folders/:folderId/...);
  // прокидываем в buildSpecColumns, чтобы format: "references" (used_by) мог
  // отрендерить ссылку на /folders/<folderId>/compute/instances/<id> и т.п.
  const columns: Column<Record<string, unknown>>[] = buildSpecColumns(spec, {
    folderId: params.folderId,
  });

  columns.push({
    header: "",
    className: "text-right whitespace-nowrap",
    cell: (row) => (
      <RowActionsMenu
        spec={spec}
        row={row}
        basePath={basePath}
        folderUid={filterValue ?? null}
      />
    ),
  });

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {spec.plural}
        </Typography.Title>
        {spec.description && (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {spec.description}
          </Typography.Text>
        )}
      </div>

      <Space size={12} wrap>
        <Input.Search
          placeholder="Фильтр по имени или идентификатору"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: 360 }}
          allowClear
        />
        {hasZoneFilter && (
          <Select
            value={zone}
            onChange={setZone}
            options={zoneOptions}
            style={{ width: 240 }}
          />
        )}
      </Space>

      {isError ? (
        <ErrorResult error={error} />
      ) : (
      <ResourceTable
        rows={filteredItems}
        loading={isLoading && items.length === 0}
        rowKey={(r) => getByPath<string>(r, "id") ?? Math.random().toString()}
        columns={columns}
        onRowClick={(row) => {
          const id = getByPath<string>(row, "id");
          if (!id) return;
          // childRoute шаблон: /folders/:id, /clouds/:id/folders, ...
          const target = spec.childRoute
            ? spec.childRoute.replace(":id", id)
            : `${basePath}/${id}`;
          navigate(target);
        }}
      />
      )}
    </Space>
  );
}

