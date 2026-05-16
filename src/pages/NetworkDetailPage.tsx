// NetworkDetailPage — Network detail с табами по дочерним ресурсам.
// Tabs: Обзор (auto) / Таблицы маршрутизации / Группы безопасности /
//       DNS зоны / Операции.
//
// Per-tab header CTA через ResourceDetailPage.headerActionsByTab.
// Каждый child-tab имеет Title + filter (имя или id substring) над таблицей.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Input, Space, Typography } from "antd";
import { ErrorResult } from "@/components/ErrorResult";
import { PlusOutlined } from "@ant-design/icons";
import { ResourceDetailPage } from "@/components/ResourceDetailPage";
import { ResourceTable, type Column } from "@/components/ResourceTable";
import { RowActionsMenu } from "@/components/RowActionsMenu";
import { ResourceFormModal } from "@/components/ResourceFormModal";
import { InlineResourceCreateForm } from "@/components/InlineResourceCreateForm";
import { InlineSubnetCreateForm } from "@/components/InlineSubnetCreateForm";
import { api } from "@/api/client";
import { REGISTRY, getByPath, type ResourceSpec } from "@/lib/resource-registry";
import { buildSpecColumns } from "@/lib/spec-columns";
import {
  buildCreateChildUrl,
  detectCreateChildSpecId,
} from "@/lib/create-child-url";
import type { DetailTab } from "@/components/DetailShell";

export function NetworkDetailPage() {
  const { uid: networkId, folderId } = useParams();
  const navigate = useNavigate();
  const networkSpec = REGISTRY["networks"];
  const rtSpec = REGISTRY["route-tables"];
  const sgSpec = REGISTRY["security-groups"];

  const subnetSpec = REGISTRY["subnets"];

  // KAC-102: create-child перенесён с модалки на отдельную страницу
  // `/folders/X/vpc/networks/<nid>/create-<child-slug>`. URL остаётся под
  // /networks/<nid>/ → layout NetworkDetailPage, блок «Общее» подменяется
  // на форму create-child через `overviewReplace`.
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const parentDetailPath =
    folderId && networkId ? `/folders/${folderId}/vpc/networks/${networkId}` : "";
  const createChildSpecId = useMemo(
    () => detectCreateChildSpecId(location.pathname),
    [location.pathname],
  );

  const openCreateChild = useCallback(
    (specId: string) => {
      if (!parentDetailPath) return;
      const url = buildCreateChildUrl(parentDetailPath, specId);
      if (url) navigate(url);
    },
    [parentDetailPath, navigate],
  );

  // Back-compat для старых ссылок (KAC-67 v2..v5 / KAC-69) —
  // `?action=create-*` / `?createSubnet=1` / `?modal=<spec>-create&networkId=X`
  // → redirect на `/networks/<nid>/create-<slug>`.
  useEffect(() => {
    if (!networkId || !parentDetailPath) return;
    const action = searchParams.get("action");
    const createSubnetLegacy = searchParams.get("createSubnet") === "1";
    const modal = searchParams.get("modal");
    const modalMatch = modal?.match(/^([a-z-]+)-create$/);
    let target: string | null = null;
    if (createSubnetLegacy || action === "create-subnet") target = "subnets";
    else if (action === "create-route-table") target = "route-tables";
    else if (action === "create-security-group") target = "security-groups";
    else if (modalMatch && searchParams.get("networkId") === networkId) {
      const candidate = modalMatch[1];
      if (
        candidate === "subnets" ||
        candidate === "route-tables" ||
        candidate === "security-groups"
      ) {
        target = candidate;
      }
    }
    if (!target) return;
    const url = buildCreateChildUrl(parentDetailPath, target);
    if (!url) return;
    const params = new URLSearchParams(searchParams);
    params.delete("action");
    params.delete("createSubnet");
    params.delete("modal");
    params.delete("networkId");
    const qs = params.toString();
    navigate(qs ? `${url}?${qs}` : url, { replace: true });
  }, [networkId, parentDetailPath, searchParams, navigate]);

  const { data: subnetData } = useQuery({
    queryKey: ["subnets", "list", folderId],
    queryFn: () =>
      api.list<{ subnets: Array<Record<string, unknown>> }>(subnetSpec.apiPath, {
        folder_id: folderId!,
        pageSize: "500",
      }),
    refetchInterval: 5000,
    enabled: !!folderId,
  });

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

  const networkSubnets = useMemo(
    () => (subnetData?.subnets ?? []).filter((r) => r.network_id === networkId),
    [subnetData, networkId],
  );
  const networkRouteTables = useMemo(
    () => (rtData?.route_tables ?? []).filter((r) => r.network_id === networkId),
    [rtData, networkId],
  );
  const networkSGs = useMemo(
    () => (sgData?.security_groups ?? []).filter((r) => r.network_id === networkId),
    [sgData, networkId],
  );

  // RowActionsMenu Edit-кнопка ведёт на `${basePath}/${id}/edit` — для child-resources
  // на network-detail передаём nested basePath, чтобы edit URL остался под networks/.
  const nestedBase = (route: string) =>
    folderId && networkId ? `/folders/${folderId}/vpc/networks/${networkId}/${route}` : null;
  const subnetColumns = useChildColumns(subnetSpec, folderId, nestedBase("subnets"));
  const rtColumns = useChildColumns(rtSpec, folderId, nestedBase("route-tables"));
  const sgColumns = useChildColumns(sgSpec, folderId, nestedBase("security-groups"));

  const overviewExtras = useCallback(
    () => (
      <ChildSection
        title="Подсети"
        rows={networkSubnets}
        columns={subnetColumns}
        emptyText="В сети нет подсетей."
        onClick={(id) =>
          folderId &&
          networkId &&
          navigate(`/folders/${folderId}/vpc/networks/${networkId}/subnets/${id}`)
        }
      />
    ),
    [networkSubnets, subnetColumns, folderId, networkId, navigate],
  );

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
                folderId &&
                networkId &&
                navigate(
                  `/folders/${folderId}/vpc/networks/${networkId}/route-tables/${id}`,
                )
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
                folderId &&
                networkId &&
                navigate(
                  `/folders/${folderId}/vpc/networks/${networkId}/security-groups/${id}`,
                )
              }
            />
          ),
        },
        {
          id: "dns-zones",
          label: "DNS зоны",
          render: () => (
            <ErrorResult
              status="404"
              subTitle="DNS зоны пока не поддерживаются в Kachō (запланировано в дорожной карте)."
            />
          ),
        },
        // tab "Операции" автоматически добавляется ResourceDetailPage —
        // не дублируем здесь.
      ],
    [
      networkRouteTables,
      networkSGs,
      rtColumns,
      sgColumns,
      folderId,
      networkId,
      navigate,
    ],
  );

  const headerActionsByTab = useCallback(
    (tabId: string) => {
      if (!folderId || !networkId) return null;
      if (tabId === "route-tables") {
        return (
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => openCreateChild("route-tables")}
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
            onClick={() => openCreateChild("security-groups")}
          >
            Создать группу безопасности
          </Button>
        );
      }
      return null;
    },
    [folderId, networkId, openCreateChild],
  );

  // "Создать подсеть" — навигирует на /networks/<n>/create-subnet.
  const overviewCreateOverride = useMemo(
    () =>
      folderId && networkId
        ? {
            label: "Создать подсеть",
            onClick: () => openCreateChild("subnets"),
          }
        : undefined,
    [folderId, networkId, openCreateChild],
  );

  // KAC-102: render create-child form в правой колонке (вместо «Общее»).
  const goBackToParent = useCallback(
    (tab?: string) => {
      if (!parentDetailPath) return;
      navigate(tab ? `${parentDetailPath}?tab=${tab}` : parentDetailPath);
    },
    [parentDetailPath, navigate],
  );

  const overviewReplace = useMemo(() => {
    if (!createChildSpecId || !folderId || !networkId) return undefined;
    const childSpec = REGISTRY[createChildSpecId];
    if (!childSpec) return undefined;
    return () => {
      if (createChildSpecId === "subnets") {
        return (
          <InlineSubnetCreateForm
            folderId={folderId}
            networkId={networkId}
            onCancel={() => goBackToParent()}
            onSuccess={() => goBackToParent()}
          />
        );
      }
      // route-tables / security-groups — generic форма с preset network_id.
      return (
        <InlineResourceCreateForm
          spec={childSpec}
          ctx={{ folderId }}
          presetFields={{ network_id: networkId }}
          folderUid={folderId}
          title={`Создание: ${childSpec.singular}`}
          onCancel={() => goBackToParent(createChildSpecId)}
          onSuccess={() => goBackToParent(createChildSpecId)}
        />
      );
    };
  }, [createChildSpecId, folderId, networkId, goBackToParent]);

  return (
    <>
      <ResourceDetailPage
        spec={networkSpec}
        extraTabs={extraTabs}
        headerActionsByTab={headerActionsByTab}
        overviewCreateOverride={overviewCreateOverride}
        overviewExtras={overviewExtras}
        overviewReplace={overviewReplace}
        hideOverviewCreate={!!createChildSpecId}
      />
      {folderId && <ResourceFormModal folderId={folderId} />}
    </>
  );
}

// useChildColumns — buildSpecColumns + actions-колонка для child-tabs.
// basePathOverride — если задан, используется вместо flat /folders/<f>/<route>;
// нужно для nested-контекстов (RT/SG/Subnet под network) чтобы edit/delete
// links оставались под parent-путём.
function useChildColumns(
  spec: ResourceSpec,
  folderId: string | undefined,
  basePathOverride?: string | null,
): Column<Record<string, unknown>>[] {
  return useMemo(() => {
    const cols = buildSpecColumns(spec, { folderId });
    const basePath =
      basePathOverride ?? (folderId ? `/folders/${folderId}/${spec.route}` : null);
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
  }, [spec, folderId, basePathOverride]);
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
