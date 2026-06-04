// ResourceShell — единый registry-driven 3-зонный layout детализации ЛЮБОГО
// ресурса (KAC-231 эпик). Эталон выработан на VPC Network, раскатан на все
// модули.
//
// Зоны: (1) глобальный ServiceSidebar (Layout.tsx) | (2) DetailShell aside —
// имя + вертикальные табы + доки | (3) main — контент таба ИЛИ форма-панель.
//
// Табы: «Обзор» (5 обяз. полей + доменные строки расширения + «Редактировать»)
//   → per-type табы связанных ресурсов (spec.related) → доменные табы расширения
//   → «Операции» → «JSON» → «JSON (internal)» если есть internalGetPath.
//
// Формы — НЕ модалки, а разворот в зоне 3 (mode=edit | child-create), уникальный
// URI на таб/режим. Диспетч кастомных/generic форм — InlineResourceForm.
//
// Конфиг per-resource: spec.related / spec.docs / spec.emptyState (registry) +
// DETAIL_EXTENSIONS (доменный React-контент: см. resource-detail-extensions).

import { type ReactNode, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Descriptions, Spin, Tag, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { DetailShell, type DetailTab, type DocLink } from "@/components/DetailShell";
import { SectionHeader } from "@/components/SectionHeader";
import { ResourceEmptyState } from "@/components/ResourceEmptyState";
import { ResourceTable } from "@/components/ResourceTable";
import { ErrorResult } from "@/components/ErrorResult";
import { CopyableId } from "@/components/CopyableId";
import { LabelsCell } from "@/components/LabelsCell";
import { RowActionsMenu } from "@/components/RowActionsMenu";
import { JsonMonacoView } from "@/components/JsonMonacoView";
import { OperationsTab } from "@/components/OperationsTab";
import { InlineResourceForm } from "@/components/InlineResourceForm";
import {
  TableSearch,
  ColumnSettings,
  useHiddenColumns,
  type ToggleCol,
} from "@/components/TableToolbar";
import { useBreadcrumb, useHeaderRight } from "@/components/PageHeaderSlot";
import { detailExtension, type DescItem } from "@/components/resource-detail-extensions";
import { api } from "@/api/client";
import { REGISTRY, getByPath, resourceProjectPath, type ResourceSpec } from "@/lib/resource-registry";
import { buildSpecColumns } from "@/lib/spec-columns";
import { useResourceList } from "@/lib/use-resource-list";
import { useInvalidateResourceList } from "@/lib/use-operation";
import { DetailOverviewActions } from "@/components/DetailOverviewActions";

export type ResourceShellMode = "edit" | "child-create";

function specByRoute(route: string): ResourceSpec | undefined {
  return Object.values(REGISTRY).find((s) => s.route === route);
}

/** Дата создания в формате "30.05.2026, в 00:38". */
function fmtCreatedAt(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${date}, в ${time}`;
}

/** JsonIntView — internal/infra-проекция ресурса (GET spec.internalGetPath). */
function JsonIntView({ path }: { path: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["jsonint", path],
    queryFn: () => api.get<Record<string, unknown>>(path),
    refetchInterval: 5_000,
    staleTime: 0,
  });
  if (isError) return <ErrorResult error={error} />;
  if (isLoading && !data) return <div style={{ padding: 32, textAlign: "center" }}><Spin /></div>;
  return <JsonMonacoView data={data} />;
}

/** RelatedTable — встроенная таблица дочернего ресурса (тот же ResourceTable,
 *  что на списке): поиск + конфигуратор колонок + «⋮» actions + welcome-empty. */
function RelatedTable({
  childSpec,
  filterFields,
  parentId,
  projectId,
  detailBase,
}: {
  childSpec: ResourceSpec;
  filterFields: string[];
  parentId: string;
  projectId: string;
  detailBase: string;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [hidden, toggleHidden] = useHiddenColumns(`cols:${childSpec.id}`);
  const { data, isLoading, isError, error } = useResourceList(childSpec, "project_id", projectId);
  const all = (data?.[childSpec.payloadKey] as Record<string, unknown>[] | undefined) ?? [];
  // Фильтр по родителю (OR по нескольким полям — напр. subnet→addresses v4∪v6).
  const ownRows = all.filter((r) => filterFields.some((ff) => getByPath<string>(r, ff) === parentId));

  // Поиск по имени или идентификатору (client-side).
  const q = search.trim().toLowerCase();
  const rows = q
    ? ownRows.filter((r) => {
        const nm = (getByPath<string>(r, "name") ?? "").toLowerCase();
        const id = (getByPath<string>(r, "id") ?? "").toLowerCase();
        return nm.includes(q) || id.includes(q);
      })
    : ownRows;

  // child-create — панель в зоне 3 shell РОДИТЕЛЯ (URI вложен под родителя).
  const createPath = `${detailBase}/${childSpec.route}/create`;
  // drill в ребёнка — на его собственный flat-URL (родитель → в хлебных крошках).
  const flatChildBase = resourceProjectPath(childSpec.id, projectId) ?? `${detailBase}/${childSpec.route}`;
  const createLabel = `Создать ${childSpec.singular.toLowerCase()}`;

  // Колонки: spec.columns без столбцов-ссылок на родителя (filterFields).
  const specNoParent: ResourceSpec = {
    ...childSpec,
    columns: childSpec.columns.filter((c) => !filterFields.includes(c.path)),
  };
  const toggleCols: ToggleCol[] = specNoParent.columns.map((c) => ({ key: c.header, label: c.header }));
  const columns = buildSpecColumns(specNoParent, { projectId }).filter((c) => !hidden.has(c.header));
  columns.push({
    header: "",
    className: "text-right whitespace-nowrap",
    cell: (row) => (
      <RowActionsMenu spec={childSpec} row={row} basePath={flatChildBase} projectId={projectId || null} editAsPanel />
    ),
  });

  if (isError) return <ErrorResult error={error} />;

  // Пустое состояние — welcome (только когда детей реально нет; промах поиска
  // показывается внутри таблицы). createLabel передаём отдельно (тот же текст).
  if (!isLoading && ownRows.length === 0) {
    return <ResourceEmptyState spec={childSpec} onCreate={() => navigate(createPath)} createLabel={createLabel} />;
  }

  return (
    <div>
      <SectionHeader
        title={
          <>
            {childSpec.plural}{" "}
            <Tag
              style={{
                marginLeft: 6,
                fontSize: 13,
                fontWeight: 600,
                lineHeight: "20px",
                height: 22,
                paddingInline: 8,
                borderRadius: 7,
              }}
            >
              {ownRows.length}
            </Tag>
          </>
        }
        right={
          <>
            <TableSearch value={search} onChange={setSearch} />
            <ColumnSettings columns={toggleCols} hidden={hidden} onToggle={toggleHidden} />
            {/* «Создать <child>» — в ШАПКЕ страницы (ResourceShell header, KAC-242),
                не в заголовке таблицы. createPath/createLabel ещё нужны empty-state. */}
          </>
        }
      />
      <ResourceTable
        rows={rows}
        columns={columns}
        loading={isLoading}
        rowKey={(r) => getByPath<string>(r, "id") ?? Math.random().toString()}
        empty={q ? "По запросу ничего не найдено." : undefined}
        onRowClick={(r) => {
          const id = getByPath<string>(r, "id");
          if (id) navigate(`${flatChildBase}/${id}`);
        }}
      />
    </div>
  );
}

export function ResourceShell({ spec, mode }: { spec: ResourceSpec; mode?: ResourceShellMode }) {
  const { projectId, uid, childRoute } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const invalidate = useInvalidateResourceList();

  // detailBase = URL до и включая /:uid (надёжно при любой вложенности/модуле).
  const marker = `/${uid ?? ""}`;
  const mIdx = uid ? location.pathname.indexOf(marker) : -1;
  const detailBase =
    mIdx >= 0
      ? location.pathname.slice(0, mIdx + marker.length)
      : `${resourceProjectPath(spec.id, projectId) ?? `/${spec.route}`}/${uid}`;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [spec.id, "shell-detail", uid],
    queryFn: () => api.get<Record<string, unknown>>(`${spec.apiPath}/${uid}`),
    enabled: !!uid,
    refetchInterval: 5_000,
    staleTime: 0,
  });

  const ext = useMemo(() => detailExtension(spec.id), [spec.id]);
  const name =
    (data ? getByPath<string>(data, "name") : "") || (data ? ext?.title?.(data) : "") || (uid ?? "");

  const listHref = resourceProjectPath(spec.id, projectId);
  const breadcrumb = useMemo(() => {
    const childSpec = mode === "child-create" && childRoute ? specByRoute(childRoute) : undefined;
    const sec = (txt: string) => <Typography.Text type="secondary">{txt}</Typography.Text>;
    const sep = <Typography.Text type="secondary">/</Typography.Text>;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {spec.serviceTitle && (<>{sec(spec.serviceTitle)}{sep}</>)}
        {listHref ? <Link to={listHref}>{sec(spec.plural)}</Link> : sec(spec.plural)}
        {sep}
        {mode ? (
          <>
            <Link to={detailBase}>{sec(name)}</Link>
            {sep}
            {mode === "edit" ? (
              <Typography.Text strong>Редактирование</Typography.Text>
            ) : (
              <>
                <Link to={`${detailBase}/${childRoute}`}>{sec(childSpec?.plural ?? childRoute ?? "")}</Link>
                {sep}
                <Typography.Text strong>Создание</Typography.Text>
              </>
            )}
          </>
        ) : (
          <Typography.Text strong style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }}>
            {name}
          </Typography.Text>
        )}
      </span>
    );
  }, [spec.serviceTitle, spec.plural, listHref, detailBase, name, mode, childRoute]);
  useBreadcrumb(breadcrumb);

  // KAC-242: действия в ШАПКЕ страницы — КОНТЕКСТНЫЕ по активному табу (не
  // глобальные на всех табах):
  //   • «Обзор»        → Редактировать + ⋮Удалить ресурса (DetailOverviewActions)
  //   • related-child  → «Создать <child>» (подсеть / таблица маршрутизации / SG / …);
  //                       удаление ребёнка — per-row в таблице (RowActionsMenu)
  //   • прочие табы (операции / JSON / ext) → нет
  // Скрыто в edit/child-create (форма уже в зоне 3). Активный таб берём из URL ДО
  // early-return (без `data`); сам набор кнопок мемоизируем.
  const headerTabFromUrl = location.pathname.startsWith(detailBase)
    ? location.pathname.slice(detailBase.length).replace(/^\/+/, "").split("/")[0]
    : "";
  const headerTabId =
    mode === "child-create" && childRoute
      ? childRoute
      : mode === "edit"
        ? "overview"
        : headerTabFromUrl || "overview";
  const headerActions = useMemo(() => {
    if (mode) return null;
    if (headerTabId === "overview") {
      return data ? (
        <DetailOverviewActions
          spec={spec}
          data={data}
          projectId={projectId ?? null}
          detailBase={detailBase}
          extActions={ext?.headerActions?.({ data, projectId: projectId ?? null, detailBase, navigate })}
        />
      ) : null;
    }
    const rel = (spec.related ?? []).find((r) => REGISTRY[r.childId]?.route === headerTabId);
    const childSpec = rel ? REGISTRY[rel.childId] : undefined;
    if (childSpec) {
      return (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate(`${detailBase}/${childSpec.route}/create`)}
        >
          Создать {childSpec.singular.toLowerCase()}
        </Button>
      );
    }
    return null;
  }, [mode, headerTabId, data, spec, projectId, detailBase, ext, navigate]);
  useHeaderRight(headerActions);

  if (isLoading && !data) {
    return <div style={{ padding: 48, textAlign: "center" }}><Spin /></div>;
  }
  if (isError || !data) {
    return <ErrorResult error={error} />;
  }

  const status = getByPath<string>(data, "status");
  const related = spec.related ?? [];
  const extCtx = { data, projectId: projectId ?? null, detailBase, navigate };

  // ── Обзор: 5 обязательных + доменные строки расширения ──
  const overviewItems: DescItem[] = [
    { label: "Идентификатор", value: <CopyableId id={getByPath<string>(data, "id") ?? ""} /> },
    { label: "Имя", value: name },
    { label: "Описание", value: getByPath<string>(data, "description") || "—" },
    { label: "Дата создания", value: fmtCreatedAt(getByPath<string>(data, "created_at")) },
    // KAC-246: метки в обзоре — read-only (chips); добавление/правка — в форме
    // создания/модификации (LabelsEditor, key=value-таблица).
    { label: "Метки", value: <LabelsCell labels={getByPath<Record<string, string>>(data, "labels")} max={12} /> },
    ...(ext?.overviewExtra?.(extCtx) ?? []),
  ];

  const tabs: DetailTab[] = [
    {
      id: "overview",
      label: "Обзор",
      render: () => (
        <div>
          <SectionHeader title="Обзор" />
          <Descriptions
            column={1}
            size="small"
            bordered
            style={{ maxWidth: 920 }}
            labelStyle={{ width: 260, whiteSpace: "nowrap", verticalAlign: "top" }}
            items={overviewItems.map((it, i) => ({ key: String(i), label: it.label, children: it.value }))}
          />
          {ext?.overviewBelow?.(extCtx)}
        </div>
      ),
    },
  ];

  // Связанные ресурсы — отдельный таб на каждый тип.
  related.forEach((r) => {
    const childSpec = REGISTRY[r.childId];
    if (!childSpec) return;
    const filterFields = Array.isArray(r.filterField) ? r.filterField : [r.filterField];
    tabs.push({
      id: childSpec.route,
      label: r.label ?? childSpec.plural,
      render: () => (
        <RelatedTable
          childSpec={childSpec}
          filterFields={filterFields}
          parentId={getByPath<string>(data, "id") ?? (uid ?? "")}
          projectId={projectId ?? ""}
          detailBase={detailBase}
        />
      ),
    });
  });

  // Доменные табы расширения (SG rules, RT routes, Instance NIC, ...).
  (ext?.extraTabs?.(extCtx) ?? []).forEach((t) => tabs.push(t));

  // Операции (если не sync-ресурс).
  if (!ext?.hideOperations) {
    tabs.push({
      id: "operations",
      label: "Операции",
      render: () => <OperationsTab spec={spec} resourceId={getByPath<string>(data, "id") ?? (uid ?? "")} />,
    });
  }
  tabs.push({
    id: "json",
    label: "JSON",
    render: () => (
      <div>
        <SectionHeader title="JSON" />
        <JsonMonacoView data={data} />
      </div>
    ),
  });
  if (spec.internalGetPath) {
    const intPath = spec.internalGetPath.replace("{id}", getByPath<string>(data, "id") ?? (uid ?? ""));
    tabs.push({
      id: "jsonint",
      label: "JSON (internal)",
      render: () => (
        <div>
          <SectionHeader title="JSON (internal)" />
          <JsonIntView path={intPath} />
        </div>
      ),
    });
  }

  // ── form-panel (зона 3) ──
  let mainOverride: ReactNode | undefined;
  if (mode === "edit") {
    mainOverride = (
      <InlineResourceForm
        spec={spec}
        action="edit"
        id={uid}
        data={data}
        projectId={projectId ?? ""}
        onCancel={() => navigate(detailBase)}
        onSuccess={() => {
          invalidate(spec.id, projectId);
          navigate(detailBase);
        }}
      />
    );
  } else if (mode === "child-create" && childRoute) {
    const childSpec = specByRoute(childRoute);
    if (childSpec) {
      const back = `${detailBase}/${childRoute}`;
      const rel = related.find((r) => REGISTRY[r.childId]?.route === childRoute);
      const ff = rel ? (Array.isArray(rel.filterField) ? rel.filterField[0] : rel.filterField) : undefined;
      mainOverride = (
        <InlineResourceForm
          spec={childSpec}
          action="create"
          projectId={projectId ?? ""}
          networkId={spec.id === "networks" ? uid : undefined}
          subnetId={spec.id === "subnets" ? uid : undefined}
          presetFields={ff ? { [ff]: uid } : undefined}
          onCancel={() => navigate(back)}
          onSuccess={() => navigate(back)}
        />
      );
    }
  }

  // Активный таб — из pathname (path-based, уникальный URI на таб).
  const sub = location.pathname.startsWith(detailBase)
    ? location.pathname.slice(detailBase.length).replace(/^\/+/, "")
    : "";
  const seg0 = sub.split("/")[0];
  let activeTabId = "overview";
  if (mode === "child-create" && childRoute) activeTabId = childRoute;
  else if (mode === "edit") activeTabId = "overview";
  else if (seg0 && tabs.some((t) => t.id === seg0)) activeTabId = seg0;

  const onTabSelect = (id: string) => {
    if (id === "overview") navigate(detailBase);
    else navigate(`${detailBase}/${id}`);
  };

  return (
    <DetailShell
      resourceLabel={spec.singular}
      resourceName={name}
      badges={status ? <Tag>{status}</Tag> : undefined}
      tabs={tabs}
      docLinks={(spec.docs as DocLink[] | undefined) ?? []}
      mainOverride={mainOverride}
      activeTabId={activeTabId}
      onTabSelect={onTabSelect}
    />
  );
}
