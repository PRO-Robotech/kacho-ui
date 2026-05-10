// HierarchyTree — antd Tree для левой боковой панели: Org → Cloud → Folder.
//
// Lazy-load через queryClient.fetchQuery (с staleTime + invalidation):
//   корни  = GET /organization-manager/v1/organizations
//   org→   = GET /resource-manager/v1/clouds?organization_id=<X>
//   cloud→ = GET /resource-manager/v1/folders?cloud_id=<X>
//
// queryKey начинается с ["tree", ...] — useInvalidateResourceList после
// Create/Update/Delete рефрешит дерево автоматически.
//
// Click → navigate + setContext (синхронно с Cloud/Folder pills в шапке).

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tree, Spin, theme } from "antd";
import type { TreeDataNode } from "antd";
import { CloudOutlined, FolderOutlined, ApartmentOutlined } from "@ant-design/icons";
import { api } from "@/api/client";
import { contextApi, useContext } from "@/lib/context-store";

interface OrgRow {
  id: string;
  name: string;
}
interface CloudRow {
  id: string;
  name: string;
  organization_id: string;
}
interface FolderRow {
  id: string;
  name: string;
  cloud_id: string;
}

const k = {
  org: (id: string) => `org:${id}`,
  cloud: (id: string) => `cloud:${id}`,
  folder: (id: string) => `folder:${id}`,
};

function parseKey(key: string): { kind: "org" | "cloud" | "folder"; id: string } | null {
  const m = key.match(/^(org|cloud|folder):(.+)$/);
  if (!m) return null;
  return { kind: m[1] as "org" | "cloud" | "folder", id: m[2] };
}

function nodeTitle(name: string, id: string, color: string): React.ReactNode {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        maxWidth: "100%",
      }}
    >
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name || "(unnamed)"}
      </span>
      <span
        style={{
          fontSize: 10,
          color,
          fontFamily: "monospace",
          opacity: 0.7,
        }}
      >
        {id.slice(0, 8)}
      </span>
    </span>
  );
}

interface CloudInfo {
  id: string;
  name: string;
  orgId: string;
}
interface FolderInfo {
  id: string;
  name: string;
  cloudId: string;
  orgId: string;
}

interface HierarchyTreeProps {
  /** Если true — рендерится без внешней обёртки (для встраивания в dropdown). */
  embedded?: boolean;
}

export function HierarchyTree({ embedded }: HierarchyTreeProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const ctx = useContext((s) => s);
  const qc = useQueryClient();

  // Корневые orgs через useQuery (auto-refetch + invalidation).
  const orgsQuery = useQuery({
    queryKey: ["tree", "orgs"],
    queryFn: () => api.list<{ organizations: OrgRow[] }>("/organization-manager/v1/organizations"),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
  const orgs = orgsQuery.data?.organizations ?? [];

  // Дети дерева — кеш {parentKey: TreeDataNode[]}. Заполняется в loadData.
  const [loaded, setLoaded] = useState<Record<string, TreeDataNode[]>>({});
  // Память cloud/folder (id, name, parents) для navigate без re-парса JSX.
  const [cloudInfo, setCloudInfo] = useState<Record<string, CloudInfo>>({});
  const [folderInfo, setFolderInfo] = useState<Record<string, FolderInfo>>({});

  // Controlled expanded/loaded keys — позволяет force re-load после invalidate.
  // При invalidate: очищаем `loadedKeys` (Tree снова считает children нелоadenным
  // и вызывает onLoadData), но сохраняем `expandedKeys` (открытые узлы остаются
  // открытыми во время рефреша).
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [loadedKeys, setLoadedKeys] = useState<React.Key[]>([]);
  const expandInitDone = useRef(false);

  // Инициализация expandedKeys из текущего ctx (один раз при mount).
  useEffect(() => {
    if (expandInitDone.current) return;
    const init: React.Key[] = [];
    if (ctx.org) init.push(k.org(ctx.org.id));
    if (ctx.cloud) init.push(k.cloud(ctx.cloud.id));
    if (init.length > 0) {
      setExpandedKeys(init);
      expandInitDone.current = true;
    }
  }, [ctx.org, ctx.cloud]);

  // Подписка на invalidate — сбрасываем loadedKeys, чтобы Tree перевызвала
  // onLoadData для уже expanded узлов.
  useEffect(() => {
    const unsub = qc.getQueryCache().subscribe((evt) => {
      if (
        evt.type === "updated" &&
        Array.isArray(evt.query.queryKey) &&
        evt.query.queryKey[0] === "tree"
      ) {
        setLoaded({});
        setLoadedKeys([]);
      }
    });
    return unsub;
  }, [qc]);

  const treeData: TreeDataNode[] = useMemo(() => {
    return orgs.map((o) => ({
      key: k.org(o.id),
      title: nodeTitle(o.name, o.id, token.colorTextTertiary),
      icon: <ApartmentOutlined />,
      children: loaded[k.org(o.id)] ?? undefined,
      isLeaf: false,
    }));
  }, [orgs, loaded, token.colorTextTertiary]);

  const onLoadData = async (node: TreeDataNode): Promise<void> => {
    const parsed = parseKey(String(node.key));
    if (!parsed) return;
    const cacheKey = String(node.key);
    if (loaded[cacheKey]) return;

    if (parsed.kind === "org") {
      const r = await qc.fetchQuery({
        queryKey: ["tree", "clouds", parsed.id],
        queryFn: () =>
          api.list<{ clouds: CloudRow[] }>("/resource-manager/v1/clouds", {
            organization_id: parsed.id,
          }),
        staleTime: 10_000,
      });
      const children: TreeDataNode[] = (r.clouds ?? []).map((c) => {
        setCloudInfo((prev) => ({
          ...prev,
          [c.id]: { id: c.id, name: c.name, orgId: c.organization_id },
        }));
        return {
          key: k.cloud(c.id),
          title: nodeTitle(c.name, c.id, token.colorTextTertiary),
          icon: <CloudOutlined />,
          children: loaded[k.cloud(c.id)] ?? undefined,
          isLeaf: false,
        };
      });
      setLoaded((prev) => ({ ...prev, [cacheKey]: children }));
      setLoadedKeys((prev) => Array.from(new Set([...prev, cacheKey])));
      return;
    }

    if (parsed.kind === "cloud") {
      const r = await qc.fetchQuery({
        queryKey: ["tree", "folders", parsed.id],
        queryFn: () =>
          api.list<{ folders: FolderRow[] }>("/resource-manager/v1/folders", {
            cloud_id: parsed.id,
          }),
        staleTime: 10_000,
      });
      const ci = cloudInfo[parsed.id];
      const orgId = ci?.orgId ?? "";
      const children: TreeDataNode[] = (r.folders ?? []).map((f) => {
        setFolderInfo((prev) => ({
          ...prev,
          [f.id]: { id: f.id, name: f.name, cloudId: f.cloud_id, orgId },
        }));
        return {
          key: k.folder(f.id),
          title: nodeTitle(f.name, f.id, token.colorTextTertiary),
          icon: <FolderOutlined />,
          isLeaf: true,
        };
      });
      setLoaded((prev) => ({ ...prev, [cacheKey]: children }));
      setLoadedKeys((prev) => Array.from(new Set([...prev, cacheKey])));
    }
  };

  const onSelect = (_: React.Key[], info: { node: TreeDataNode }) => {
    const parsed = parseKey(String(info.node.key));
    if (!parsed) return;

    if (parsed.kind === "org") {
      const name = orgs.find((o) => o.id === parsed.id)?.name ?? "";
      contextApi.setOrg({ id: parsed.id, name });
      navigate(`/organizations/${parsed.id}/clouds`);
      return;
    }

    if (parsed.kind === "cloud") {
      const ci = cloudInfo[parsed.id];
      contextApi.setCloud({
        id: parsed.id,
        name: ci?.name ?? "",
        organizationId: ci?.orgId ?? "",
      });
      navigate(`/clouds/${parsed.id}/folders`);
      return;
    }

    if (parsed.kind === "folder") {
      const fi = folderInfo[parsed.id];
      contextApi.setFolder({
        id: parsed.id,
        uid: parsed.id,
        name: fi?.name ?? "",
        cloudId: fi?.cloudId ?? "",
        organizationId: fi?.orgId ?? "",
      });
      const m = location.pathname.match(/^\/folders\/[^/]+(\/.+)?$/);
      const tail = m && m[1] ? m[1] : "/networks";
      navigate(`/folders/${parsed.id}${tail}`);
    }
  };

  const selectedKeys: React.Key[] = useMemo(() => {
    if (ctx.folder) return [k.folder(ctx.folder.id)];
    if (ctx.cloud) return [k.cloud(ctx.cloud.id)];
    if (ctx.org) return [k.org(ctx.org.id)];
    return [];
  }, [ctx]);

  const inner = (
    <>
      {orgsQuery.isLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 16 }}>
          <Spin size="small" />
        </div>
      )}
      {!orgsQuery.isLoading && treeData.length === 0 && (
        <div style={{ padding: "16px 12px", fontSize: 12, color: token.colorTextTertiary }}>
          Нет организаций. Создайте первую через Organizations.
        </div>
      )}
      {!orgsQuery.isLoading && treeData.length > 0 && (
        <Tree
          showIcon
          blockNode
          treeData={treeData}
          loadData={onLoadData}
          loadedKeys={loadedKeys}
          onSelect={onSelect}
          selectedKeys={selectedKeys}
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys)}
        />
      )}
    </>
  );

  if (embedded) {
    return <div data-testid="hierarchy-tree">{inner}</div>;
  }

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ background: token.colorBgLayout, padding: "8px 4px" }}
      data-testid="hierarchy-tree"
    >
      {inner}
    </div>
  );
}
