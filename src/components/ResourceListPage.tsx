// ResourceListPage — generic страница списка ресурсов на antd.
//
// Polling 3 сек (через useResourceList).

import { useMemo, useState } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Input, Select, Typography, Space, Tag } from "antd";
import { ErrorResult } from "@/components/ErrorResult";
import { PlusOutlined } from "@ant-design/icons";
import { api } from "@/api/client";
import { REGISTRY } from "@/lib/resource-registry";
import { ResourceTable, Column } from "@/components/ResourceTable";
import { RowActionsMenu } from "@/components/RowActionsMenu";
import { ResourceEmptyState } from "@/components/ResourceEmptyState";
import { ProjectRequiredEmpty } from "@/components/ProjectRequiredEmpty";
import { useBreadcrumb, useHeaderRight } from "@/components/PageHeaderSlot";
import { ResourceSpec, getByPath, resourceServicePrefix } from "@/lib/resource-registry";
import { buildSpecColumns } from "@/lib/spec-columns";
import { useResourceList } from "@/lib/use-resource-list";

interface Props {
  spec: ResourceSpec;
  parentField?: string;
  parentParam?: string;
  /** Явное значение scope-фильтра (account-scoped IAM-ресурсы берут account
   *  из context-store, а не из URL-параметра). Имеет приоритет над parentParam. */
  parentValue?: string | null;
}

export function ResourceListPage({ spec, parentField, parentParam, parentValue }: Props) {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const filterValue =
    parentValue ?? (parentParam ? (params[parentParam] ?? null) : null);
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

  // KAC-231: модалки упразднены в пользу формы-страницы/панели (логика Network)
  // у модулей с полноценными panel/page-формами: VPC (ResourceShell edit-панель,
  // ResourceCreatePage) + admin (ResourceCreatePage/ResourceEditPage страницы).
  // Compute/NLB/IAM остаются на модалках до своей раскатки (их detail ещё не
  // ResourceShell, /edit редиректит в модалку). panelForms — этот гейт.
  const panelForms =
    resourceServicePrefix(spec.id) === "vpc" ||
    spec.id === "regions" ||
    spec.id === "zones" ||
    spec.id === "address-pools";
  const listBase = location.pathname.endsWith("/") ? location.pathname.slice(0, -1) : location.pathname;
  const createTarget = panelForms ? `${listBase}/create` : `${listBase}?modal=${spec.id}-create`;
  // KAC-246: CTA «Создать» — в header right-slot (шапка), НЕ в page-toolbar.
  const cta = useMemo(() => {
    if (!spec.ops.create) return null;
    return (
      <Link to={createTarget}>
        <Button type="primary" icon={<PlusOutlined />}>
          Создать {spec.singular.toLowerCase()}
        </Button>
      </Link>
    );
  }, [spec, createTarget]);
  useHeaderRight(cta);

  if (parentField && !filterValue) return <ProjectRequiredEmpty resource={spec.plural} />;

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

  // params.projectId доступен для project-scoped listов (/projects/:projectId/...);
  // прокидываем в buildSpecColumns, чтобы format: "references" (used_by) мог
  // отрендерить ссылку на /projects/<projectId>/compute/instances/<id> и т.п.
  const columns: Column<Record<string, unknown>>[] = buildSpecColumns(spec, {
    projectId: params.projectId,
  });

  columns.push({
    header: "",
    className: "text-right whitespace-nowrap",
    cell: (row) => (
      <RowActionsMenu
        spec={spec}
        row={row}
        basePath={basePath}
        projectId={filterValue ?? null}
        editAsPanel={panelForms}
      />
    ),
  });

  // Пустой список (без активных пользовательских фильтров) → welcome, как у
  // дочерних таблиц. По filteredItems (учитывает intrinsic-фильтр addresses
  // «только внешние»): нет отображаемых строк при пустом поиске/зоне → welcome.
  const showWelcome =
    !isLoading &&
    !isError &&
    filteredItems.length === 0 &&
    spec.ops.create &&
    query.trim() === "" &&
    (!hasZoneFilter || zone === "all");

  // Заголовок-toolbar: title + счётчик-тег РЯДОМ с title; описание — ниже (CTA
  // «Создать» — в шапке, см. useHeaderRight). KAC-246.
  const titleBlock = (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Typography.Title level={3} className="t-page-title" style={{ margin: 0 }}>
            {spec.plural}
          </Typography.Title>
          {!isLoading && !isError && (
            <Tag
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                lineHeight: "22px",
                height: 24,
                paddingInline: 9,
                borderRadius: 7,
              }}
            >
              {filteredItems.length}
            </Tag>
          )}
        </div>
        {spec.description && (
          <Typography.Text type="secondary" style={{ fontSize: 13, display: "block", marginTop: 2 }}>
            {spec.description}
          </Typography.Text>
        )}
      </div>
    </div>
  );

  // Welcome (пустой список) — лёгкий layout без surface-обёртки таблицы.
  if (showWelcome) {
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {titleBlock}
        <ResourceEmptyState spec={spec} onCreate={() => navigate(createTarget)} />
      </Space>
    );
  }

  return (
    <div className="kc-surface" style={{ padding: 20 }}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {/* KAC-246: заголовок + фильтр в одной строке (title слева, фильтры справа). */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            width: "100%",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>{titleBlock}</div>
          <Space size={12} wrap style={{ flexShrink: 0 }}>
            <Input.Search
              placeholder="Фильтр по имени или идентификатору"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: 320 }}
              allowClear
            />
            {hasZoneFilter && (
              <Select value={zone} onChange={setZone} options={zoneOptions} style={{ width: 220 }} />
            )}
          </Space>
        </div>

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
              // childRoute шаблон: /projects/:id, ...
              const target = spec.childRoute
                ? spec.childRoute.replace(":id", id)
                : `${basePath}/${id}`;
              navigate(target);
            }}
          />
        )}
      </Space>
    </div>
  );
}

