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

import { type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Descriptions, Space, Spin, Tag, Typography } from "antd";
import { EditOutlined, PlusOutlined } from "@ant-design/icons";
import { DetailShell, type DetailTab } from "@/components/DetailShell";
import { ResourceTable } from "@/components/ResourceTable";
import { ErrorResult } from "@/components/ErrorResult";
import { InlineResourceEditForm } from "@/components/InlineResourceEditForm";
import { InlineResourceCreateForm } from "@/components/InlineResourceCreateForm";
import { InlineSubnetCreateForm } from "@/components/InlineSubnetCreateForm";
import { api } from "@/api/client";
import { REGISTRY, getByPath, type ResourceSpec } from "@/lib/resource-registry";
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
  const { data, isLoading, isError, error } = useResourceList(childSpec, "project_id", projectId);
  const all = (data?.[childSpec.payloadKey] as Record<string, unknown>[] | undefined) ?? [];
  const rows = all.filter((r) => getByPath<string>(r, filterField) === parentId);
  const columns = buildSpecColumns(childSpec, { projectId });

  return (
    <div style={{ marginBottom: 28 }}>
      <Space style={{ justifyContent: "space-between", width: "100%", marginBottom: 8 }}>
        <Typography.Text strong>
          {childSpec.plural} <Tag color="blue">{rows.length}</Tag>
        </Typography.Text>
        <Button
          size="small"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate(`${detailBase}/${childSpec.route}/create`)}
        >
          Создать
        </Button>
      </Space>
      {isError ? (
        <ErrorResult error={error} />
      ) : rows.length === 0 ? (
        <Typography.Text type="secondary">Нет ресурсов «{childSpec.plural.toLowerCase()}».</Typography.Text>
      ) : (
        <ResourceTable
          rows={rows}
          columns={columns}
          loading={isLoading}
          rowKey={(r) => getByPath<string>(r, "id") ?? Math.random().toString()}
          onRowClick={(r) => {
            const id = getByPath<string>(r, "id");
            if (id) navigate(`/projects/${projectId}/vpc/${childSpec.route}/${id}`);
          }}
        />
      )}
    </div>
  );
}

export function ResourceShell({ spec, mode }: { spec: ResourceSpec; mode?: ResourceShellMode }) {
  const { projectId, uid, childRoute } = useParams();
  const navigate = useNavigate();
  const invalidate = useInvalidateResourceList();

  const detailBase = `/projects/${projectId}/vpc/${spec.route}/${uid}`;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [spec.id, "shell-detail", uid],
    queryFn: () => api.get<Record<string, unknown>>(`${spec.apiPath}/${uid}`),
    enabled: !!uid,
    refetchInterval: 5_000,
    staleTime: 0,
  });

  if (isLoading && !data) {
    return <div style={{ padding: 48, textAlign: "center" }}><Spin /></div>;
  }
  if (isError || !data) {
    return <ErrorResult error={error} />;
  }

  const name = getByPath<string>(data, "name") || (uid ?? "");
  const status = getByPath<string>(data, "status");
  const related = RELATED[spec.id] ?? [];

  // ── Обзор (key-value) ──
  const overviewItems: { label: string; value: ReactNode }[] = [
    { label: "Имя", value: name },
    { label: "ID", value: <Typography.Text code copyable>{getByPath<string>(data, "id")}</Typography.Text> },
    ...(status ? [{ label: "Статус", value: <Tag>{status}</Tag> }] : []),
    ...(getByPath<string>(data, "description")
      ? [{ label: "Описание", value: getByPath<string>(data, "description")! }]
      : []),
    ...(getByPath<string>(data, "created_at")
      ? [{ label: "Создано", value: new Date(getByPath<string>(data, "created_at")!).toLocaleString() }]
      : []),
  ];

  const tabs: DetailTab[] = [
    {
      id: "overview",
      label: "Обзор",
      render: () => (
        <Descriptions
          column={1}
          size="small"
          bordered
          items={overviewItems.map((it, i) => ({ key: String(i), label: it.label, children: it.value }))}
        />
      ),
    },
  ];
  if (related.length > 0) {
    tabs.push({
      id: "related",
      label: "Связанные",
      render: () => (
        <div>
          {related.map((r) => {
            const childSpec = specByRoute(r.route);
            if (!childSpec) return null;
            return (
              <RelatedTable
                key={r.route}
                childSpec={childSpec}
                filterField={r.filterField}
                parentId={getByPath<string>(data, "id") ?? (uid ?? "")}
                projectId={projectId ?? ""}
                detailBase={detailBase}
              />
            );
          })}
        </div>
      ),
    });
  }
  tabs.push({
    id: "json",
    label: "JSON",
    render: () => (
      <pre style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", whiteSpace: "pre-wrap", margin: 0 }}>
        {JSON.stringify(data, null, 2)}
      </pre>
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
      const back = `${detailBase}?tab=related`;
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

  return (
    <DetailShell
      resourceLabel={spec.singular}
      resourceName={name}
      badges={status ? <Tag>{status}</Tag> : undefined}
      tabs={tabs}
      docLinks={[]}
      mainOverride={mainOverride}
      secondaryActions={
        mode ? undefined : (
          <Button icon={<EditOutlined />} onClick={() => navigate(`${detailBase}/edit`)}>
            Редактировать
          </Button>
        )
      }
    />
  );
}
