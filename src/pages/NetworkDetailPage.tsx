// NetworkDetailPage — Network detail с табами по дочерним ресурсам.
// Tabs: Обзор (auto) / Таблицы маршрутизации / Группы безопасности /
//       DNS зоны / Операции.
//
// Per-tab header CTA через ResourceDetailPage.headerActionsByTab.
// Каждый child-tab имеет Title + filter (имя или id substring) над таблицей.

import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Empty, Input, Space, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { ResourceDetailPage } from "@/components/ResourceDetailPage";
import { ResourceTable, type Column } from "@/components/ResourceTable";
import { RowActionsMenu } from "@/components/RowActionsMenu";
import { api } from "@/api/client";
import { REGISTRY, getByPath, type ResourceSpec } from "@/lib/resource-registry";
import { buildSpecColumns } from "@/lib/spec-columns";
import type { DetailTab } from "@/components/DetailShell";

export function NetworkDetailPage() {
  const { uid: networkId, folderId } = useParams();
  const navigate = useNavigate();
  const networkSpec = REGISTRY["networks"];
  const rtSpec = REGISTRY["route-tables"];
  const sgSpec = REGISTRY["security-groups"];

  const { data: rtData } = useQuery({
    queryKey: ["route-tables", "list", folderId],
    queryFn: () =>
      api.list<{ route_tables: Array<Record<string, unknown>> }>(rtSpec.apiPath, {
        folder_id: folderId!,
        pageSize: "500",
      }),
    refetchInterval: 5000,
    enabled: !!folderId,
  });

  const { data: sgData } = useQuery({
    queryKey: ["security-groups", "list", folderId],
    queryFn: () =>
      api.list<{ security_groups: Array<Record<string, unknown>> }>(sgSpec.apiPath, {
        folder_id: folderId!,
        pageSize: "500",
      }),
    refetchInterval: 5000,
    enabled: !!folderId,
  });

  const networkRouteTables = useMemo(
    () => (rtData?.route_tables ?? []).filter((r) => r.network_id === networkId),
    [rtData, networkId],
  );
  const networkSGs = useMemo(
    () => (sgData?.security_groups ?? []).filter((r) => r.network_id === networkId),
    [sgData, networkId],
  );

  const rtColumns = useChildColumns(rtSpec, folderId);
  const sgColumns = useChildColumns(sgSpec, folderId);

  const extraTabs = useMemo(
    () =>
      (): DetailTab[] => [
        {
          id: "route-tables",
          label: "Таблицы маршрутизации",
          count: networkRouteTables.length,
          render: () => (
            <ChildSection
              title="Таблицы маршрутизации"
              rows={networkRouteTables}
              columns={rtColumns}
              emptyText="К сети не привязано ни одной таблицы маршрутизации."
              onClick={(id) =>
                folderId && navigate(`/folders/${folderId}/route-tables/${id}`)
              }
            />
          ),
        },
        {
          id: "security-groups",
          label: "Группы безопасности",
          count: networkSGs.length,
          render: () => (
            <ChildSection
              title="Группы безопасности"
              rows={networkSGs}
              columns={sgColumns}
              emptyText="В сети нет групп безопасности."
              onClick={(id) =>
                folderId && navigate(`/folders/${folderId}/security-groups/${id}`)
              }
            />
          ),
        },
        {
          id: "dns-zones",
          label: "DNS зоны",
          render: () => (
            <Empty
              description={
                <Typography.Text type="secondary">
                  DNS зоны пока не поддерживаются в Kachō (запланировано в дорожной карте).
                </Typography.Text>
              }
            />
          ),
        },
        {
          id: "operations",
          label: "Операции",
          render: () => (
            <Alert
              type="info"
              showIcon
              message="История операций"
              description="OperationService пока не поддерживает фильтр по resource_id. Список операций по этой сети появится после соответствующего изменения backend (см. план §11.1)."
            />
          ),
        },
      ],
    [networkRouteTables, networkSGs, rtColumns, sgColumns, folderId, navigate],
  );

  const headerActionsByTab = (tabId: string) => {
    if (!folderId) return null;
    if (tabId === "route-tables") {
      return (
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() =>
            navigate(`/folders/${folderId}/route-tables/create?network_id=${networkId}`)
          }
        >
          Создать таблицу маршрутизации
        </Button>
      );
    }
    if (tabId === "security-groups") {
      return (
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() =>
            navigate(`/folders/${folderId}/security-groups/create?network_id=${networkId}`)
          }
        >
          Создать группу безопасности
        </Button>
      );
    }
    return null;
  };

  return (
    <ResourceDetailPage
      spec={networkSpec}
      extraTabs={extraTabs}
      hideJsonTab
      headerActionsByTab={headerActionsByTab}
    />
  );
}

// useChildColumns — buildSpecColumns + actions-колонка для child-tabs.
function useChildColumns(
  spec: ResourceSpec,
  folderId: string | undefined,
): Column<Record<string, unknown>>[] {
  return useMemo(() => {
    const cols = buildSpecColumns(spec);
    const basePath = folderId ? `/folders/${folderId}/${spec.route}` : null;
    if (basePath) {
      cols.push({
        header: "",
        className: "text-right whitespace-nowrap",
        cell: (row) => (
          <RowActionsMenu
            spec={spec}
            row={row}
            basePath={basePath}
            folderUid={folderId ?? null}
          />
        ),
      });
    }
    return cols;
  }, [spec, folderId]);
}

// ChildSection — Title + filter + table. Используется на каждой
// child-tab Network detail.
function ChildSection({
  title,
  rows,
  columns,
  emptyText,
  onClick,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  columns: Column<Record<string, unknown>>[];
  emptyText: string;
  onClick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const name = (getByPath<string>(row, "name") ?? "").toLowerCase();
      const id = (getByPath<string>(row, "id") ?? "").toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [rows, query]);

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        {title}
      </Typography.Title>
      <Input.Search
        placeholder="Фильтр по имени или идентификатору"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ maxWidth: 360 }}
        allowClear
      />
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {query ? "По фильтру ничего не найдено." : emptyText}
        </div>
      ) : (
        <ResourceTable
          rows={filtered}
          columns={columns}
          rowKey={(r) => getByPath<string>(r, "id") ?? Math.random().toString()}
          onRowClick={(r) => {
            const id = getByPath<string>(r, "id");
            if (id) onClick(id);
          }}
        />
      )}
    </Space>
  );
}
