// ResourceShell — единый 3-зонный лайаут детализации ресурса (KAC-232/233).
//
// Зоны: (1) глобальный ServiceSidebar (Layout.tsx) | (2) DetailShell aside —
// имя + вертикальные табы Обзор/Связанные/JSON + доки | (3) main — контент
// активного таба ИЛИ форма (form-panel).
//
// Формы — расширение страницы, НЕ модалки (разворот CLAUDE.md §3):
//   /<res>/:uid/edit                 → InlineResourceEditForm в зоне 3
//   /<res>/:uid/<child>/create       → форма создания связного ресурса в зоне 3
// Таб «Связанные» — встроенные ResourceTable дочерних ресурсов (тот же
// компонент, что на странице-списке) + «Создать» (→ form-panel).
//
// Прототип-фаза: эталон VPC Network. RELATED-карта временно тут; в финале —
// spec.related в resource-registry.

import { type ReactNode, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Descriptions, Tag, Spin, Typography } from "antd";
import { EditOutlined, PlusOutlined, ReadOutlined, RightOutlined } from "@ant-design/icons";
import { ResourceIcon } from "@/components/form/ResourceIcon";
import { DetailShell, type DetailTab, type DocLink } from "@/components/DetailShell";
import { SectionHeader } from "@/components/SectionHeader";
import { ResourceTable } from "@/components/ResourceTable";
import { ErrorResult } from "@/components/ErrorResult";
import { CopyableId } from "@/components/CopyableId";
import { LabelsCell } from "@/components/LabelsCell";
import { RowActionsMenu } from "@/components/RowActionsMenu";
import { JsonMonacoView } from "@/components/JsonMonacoView";
import { OperationsTab } from "@/components/OperationsTab";
import {
  TableSearch,
  ColumnSettings,
  useHiddenColumns,
  type ToggleCol,
} from "@/components/TableToolbar";
import { useBreadcrumb } from "@/components/PageHeaderSlot";
import { InlineResourceEditForm } from "@/components/InlineResourceEditForm";
import { InlineResourceCreateForm } from "@/components/InlineResourceCreateForm";
import { InlineSubnetCreateForm } from "@/components/InlineSubnetCreateForm";
import { api } from "@/api/client";
import { REGISTRY, getByPath, resourceProjectPath, type ResourceSpec } from "@/lib/resource-registry";
import { buildSpecColumns } from "@/lib/spec-columns";
import { useResourceList } from "@/lib/use-resource-list";
import { useInvalidateResourceList } from "@/lib/use-operation";

export type ResourceShellMode = "edit" | "child-create";

interface RelatedDef {
  route: string;
  filterField: string;
}

// Временная карта связанных ресурсов (→ spec.related в финале).
const RELATED: Record<string, RelatedDef[]> = {
  networks: [
    { route: "subnets", filterField: "network_id" },
    { route: "route-tables", filterField: "network_id" },
    { route: "security-groups", filterField: "network_id" },
  ],
};

function specByRoute(route: string): ResourceSpec | undefined {
  return Object.values(REGISTRY).find((s) => s.route === route);
}

// Документация по типу мастер-ресурса (отображается в блоке табов слева).
// Kachō docs (без «yandex»); hrefs — заглушки до публикации портала доков.
const DOCS: Record<string, DocLink[]> = {
  networks: [
    { label: "Облачные сети и подсети", href: "#" },
    { label: "Таблицы маршрутизации", href: "#" },
    { label: "Группы безопасности", href: "#" },
    { label: "Адреса облачных ресурсов", href: "#" },
  ],
};

/** Дата создания в формате "30.05.2026, в 00:38". */
function fmtCreatedAt(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${date}, в ${time}`;
}

interface EmptyCopy {
  title: string;
  body: string;
  docs?: string[];
}
// Welcome-копирайт для пустых дочерних таблиц (Kachō-style; без «yandex»).
const EMPTY_STATE: Record<string, EmptyCopy> = {
  "route-tables": {
    title: "Создайте вашу первую таблицу маршрутизации",
    body:
      "С помощью таблиц маршрутизации вы можете построить маршруты между сетью в облаке Kachō и другими " +
      "виртуальными или локальными сетями. Или же настроить отказоустойчивую схему передачи данных с " +
      "маршрутами в нескольких зонах доступности.",
    docs: ["Статическая маршрутизация", "Маршрутизация с помощью NAT-инстанса"],
  },
  subnets: {
    title: "Создайте вашу первую подсеть",
    body:
      "Подсеть — диапазон IP-адресов внутри сети, привязанный к зоне доступности. Ресурсы (ВМ, " +
      "балансировщики, NIC) размещаются в подсетях и получают адреса из их CIDR.",
    docs: ["Облачные сети и подсети"],
  },
  "security-groups": {
    title: "Создайте вашу первую группу безопасности",
    body:
      "Группа безопасности — набор правил, определяющих разрешённый входящий и исходящий трафик для " +
      "ресурсов сети.",
    docs: ["Группы безопасности"],
  },
};

/** RelatedTable — встроенная таблица дочернего ресурса (тот же ResourceTable,
 *  что на списке), client-side отфильтрованная по родителю. */
function RelatedTable({
  childSpec,
  filterField,
  parentId,
  projectId,
  detailBase,
}: {
  childSpec: ResourceSpec;
  filterField: string;
  parentId: string;
  projectId: string;
  detailBase: string;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [hidden, toggleHidden] = useHiddenColumns(`cols:${childSpec.id}`);
  const { data, isLoading, isError, error } = useResourceList(childSpec, "project_id", projectId);
  const all = (data?.[childSpec.payloadKey] as Record<string, unknown>[] | undefined) ?? [];
  const ownRows = all.filter((r) => getByPath<string>(r, filterField) === parentId);

  // Поиск по имени или идентификатору (client-side).
  const q = search.trim().toLowerCase();
  const rows = q
    ? ownRows.filter((r) => {
        const nm = (getByPath<string>(r, "name") ?? "").toLowerCase();
        const id = (getByPath<string>(r, "id") ?? "").toLowerCase();
        return nm.includes(q) || id.includes(q);
      })
    : ownRows;

  const createPath = `${detailBase}/${childSpec.route}/create`;
  const childBase = `${detailBase}/${childSpec.route}`; // nested base: detail/edit/actions
  const createLabel = `Создать ${childSpec.singular.toLowerCase()}`;

  // Колонки: spec.columns без столбца-ссылки на родителя (filterField).
  const specNoParent: ResourceSpec = {
    ...childSpec,
    columns: childSpec.columns.filter((c) => c.path !== filterField),
  };
  const toggleCols: ToggleCol[] = specNoParent.columns.map((c) => ({ key: c.header, label: c.header }));
  // Видимые data-колонки (по конфигу шестерёнки) + всегда-видимая "⋮" actions.
  const columns = buildSpecColumns(specNoParent, { projectId }).filter((c) => !hidden.has(c.header));
  columns.push({
    header: "",
    className: "text-right whitespace-nowrap",
    cell: (row) => (
      <RowActionsMenu spec={childSpec} row={row} basePath={childBase} projectId={projectId || null} />
    ),
  });

  if (isError) return <ErrorResult error={error} />;

  // Пустое состояние — продакшн-реди welcome (только когда у родителя реально
  // нет дочерних ресурсов; промах поиска показывается внутри таблицы).
  if (!isLoading && ownRows.length === 0) {
    const copy = EMPTY_STATE[childSpec.id];
    return (
      <div
        style={{
          maxWidth: 600,
          margin: "0 auto",
          minHeight: "calc(100vh - 220px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "32px 16px",
        }}
      >
        {/* Иллюстрация — иконка ресурса в мягком градиентном контейнере. */}
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 24,
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 44,
            color: "#3D8DF5",
            background: "linear-gradient(135deg, rgba(61,141,245,0.16), rgba(61,141,245,0.04))",
            border: "1px solid var(--ant-color-border-secondary, #2f3138)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.03) inset",
          }}
        >
          <ResourceIcon specId={childSpec.id} />
        </div>

        <Typography.Title level={4} style={{ margin: "0 0 10px", fontWeight: 600 }}>
          {copy?.title ?? `Создайте первый ресурс «${childSpec.singular.toLowerCase()}»`}
        </Typography.Title>

        {copy?.body && (
          <Typography.Paragraph
            type="secondary"
            style={{ fontSize: 14, lineHeight: 1.65, margin: "0 0 24px", maxWidth: 500 }}
          >
            {copy.body}
          </Typography.Paragraph>
        )}

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate(createPath)}
          style={{ marginBottom: copy?.docs?.length ? 28 : 0 }}
        >
          {createLabel}
        </Button>

        {copy?.docs && copy.docs.length > 0 && (
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              textAlign: "left",
              padding: "14px 18px",
              background: "var(--ant-color-fill-quaternary, rgba(255,255,255,0.03))",
              border: "1px solid var(--ant-color-border-secondary, #2f3138)",
              borderRadius: 12,
            }}
          >
            <Typography.Text
              type="secondary"
              style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}
            >
              <ReadOutlined style={{ marginRight: 6 }} />
              Документация
            </Typography.Text>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {copy.docs.map((d) => (
                <Typography.Link
                  key={d}
                  href="#"
                  style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <RightOutlined style={{ fontSize: 10, opacity: 0.6 }} />
                  {d}
                </Typography.Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title={
          <>
            {childSpec.plural} <Tag style={{ marginLeft: 4 }}>{ownRows.length}</Tag>
          </>
        }
        right={
          <>
            <TableSearch value={search} onChange={setSearch} />
            <ColumnSettings columns={toggleCols} hidden={hidden} onToggle={toggleHidden} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(createPath)}>
              {createLabel}
            </Button>
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
          // network-вложенный detail — «назад» возвращает в Network, откуда пришли.
          if (id) navigate(`${childBase}/${id}`);
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

  const detailBase = `/projects/${projectId}/vpc/${spec.route}/${uid}`;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [spec.id, "shell-detail", uid],
    queryFn: () => api.get<Record<string, unknown>>(`${spec.apiPath}/${uid}`),
    enabled: !!uid,
    refetchInterval: 5_000,
    staleTime: 0,
  });

  // Имя — для крошек (до early-return; при загрузке data может быть undefined).
  const name = (data ? getByPath<string>(data, "name") : "") || (uid ?? "");

  // Крошки в глобальный хедер (хук вызывается безусловно, до early-return).
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

  if (isLoading && !data) {
    return <div style={{ padding: 48, textAlign: "center" }}><Spin /></div>;
  }
  if (isError || !data) {
    return <ErrorResult error={error} />;
  }

  const status = getByPath<string>(data, "status");
  const related = RELATED[spec.id] ?? [];

  // ── Обзор: обязательные поля ID / Имя / Описание / Дата создания / Метки ──
  const overviewItems: { label: string; value: ReactNode }[] = [
    { label: "Идентификатор", value: <CopyableId id={getByPath<string>(data, "id") ?? ""} /> },
    { label: "Имя", value: name },
    { label: "Описание", value: getByPath<string>(data, "description") || "—" },
    { label: "Дата создания", value: fmtCreatedAt(getByPath<string>(data, "created_at")) },
    { label: "Метки", value: <LabelsCell labels={getByPath<Record<string, string>>(data, "labels")} /> },
  ];

  const tabs: DetailTab[] = [
    {
      id: "overview",
      label: "Обзор",
      render: () => (
        <div>
          <SectionHeader
            title="Обзор"
            right={
              <Button icon={<EditOutlined />} onClick={() => navigate(`${detailBase}/edit`)}>
                Редактировать
              </Button>
            }
          />
          <Descriptions
            column={1}
            size="small"
            bordered
            items={overviewItems.map((it, i) => ({ key: String(i), label: it.label, children: it.value }))}
          />
        </div>
      ),
    },
  ];
  // Каждый тип связанного ресурса — отдельный таб (Subnets / RouteTables / ...).
  related.forEach((r) => {
    const childSpec = specByRoute(r.route);
    if (!childSpec) return;
    tabs.push({
      id: childSpec.route,
      label: childSpec.plural,
      render: () => (
        <RelatedTable
          childSpec={childSpec}
          filterField={r.filterField}
          parentId={getByPath<string>(data, "id") ?? (uid ?? "")}
          projectId={projectId ?? ""}
          detailBase={detailBase}
        />
      ),
    });
  });
  // Базовый таб «Операции» — список LRO для этого ресурса (у каждого мастера).
  tabs.push({
    id: "operations",
    label: "Операции",
    render: () => <OperationsTab spec={spec} resourceId={getByPath<string>(data, "id") ?? (uid ?? "")} />,
  });
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

  // ── form-panel (зона 3) ──
  let mainOverride: ReactNode | undefined;
  if (mode === "edit") {
    mainOverride = (
      <InlineResourceEditForm
        spec={spec}
        data={data}
        projectId={projectId ?? null}
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
      // после create вернуться в таб этого связанного ресурса (path-based URI).
      const back = `${detailBase}/${childRoute}`;
      mainOverride =
        childSpec.id === "subnets" ? (
          <InlineSubnetCreateForm networkId={uid} projectId={projectId ?? ""} onCancel={() => navigate(back)} onSuccess={() => navigate(back)} />
        ) : (
          <InlineResourceCreateForm
            spec={childSpec}
            ctx={{ projectId }}
            presetFields={{ network_id: uid }}
            projectId={projectId ?? null}
            onCancel={() => navigate(back)}
            onSuccess={() => navigate(back)}
          />
        );
    }
  }

  // Активный таб — из pathname (path-based, уникальный URI на таб). В form-mode
  // подсвечиваем соответствующий таб (edit → Обзор, child-create → таб ребёнка).
  const sub = location.pathname.startsWith(detailBase)
    ? location.pathname.slice(detailBase.length).replace(/^\/+/, "")
    : "";
  let activeTabId = "overview";
  if (mode === "child-create" && childRoute) activeTabId = childRoute;
  else if (mode === "edit") activeTabId = "overview";
  else if (sub === "json") activeTabId = "json";
  else if (sub === "operations") activeTabId = "operations";
  else if (sub && related.some((r) => r.route === sub)) activeTabId = sub;

  // Клик по табу навигирует по path → выходит из form-panel + даёт уникальный URI.
  const onTabSelect = (id: string) => {
    if (id === "overview") navigate(detailBase);
    else if (id === "json") navigate(`${detailBase}/json`);
    else navigate(`${detailBase}/${id}`);
  };

  return (
    <DetailShell
      resourceLabel={spec.singular}
      resourceName={name}
      badges={status ? <Tag>{status}</Tag> : undefined}
      tabs={tabs}
      docLinks={DOCS[spec.id] ?? []}
      mainOverride={mainOverride}
      activeTabId={activeTabId}
      onTabSelect={onTabSelect}
    />
  );
}
