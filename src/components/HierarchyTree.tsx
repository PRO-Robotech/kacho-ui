// HierarchyTree — antd Tree для левой боковой панели: Org → Cloud → Folder.
//
// Lazy-load:
//   корни  = GET /organization-manager/v1/organizations
//   org→   = GET /resource-manager/v1/clouds?organization_id=<X>
//   cloud→ = GET /resource-manager/v1/folders?cloud_id=<X>
//
// Click → navigate + setContext (синхронно с Cloud/Folder pills в шапке).

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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

function nodeTitle(name: string, id: string): React.ReactNode {
  return (
    <span className="inline-flex items-baseline gap-1.5 max-w-full">
      <span className="truncate">{name || "(unnamed)"}</span>
      <span className="text-[10px] text-[var(--ant-color-text-tertiary)] font-mono opacity-70">
        {id.slice(0, 8)}
      </span>
    </span>
  );
}

export function HierarchyTree() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const ctx = useContext((s) => s);

  // Кеш загруженных детей: keyParent -> [child keys]
  const [loaded, setLoaded] = useState<Record<string, TreeDataNode[]>>({});
  const [orgs, setOrgs] = useState<OrgRow[] | null>(null);
  const [loadingRoots, setLoadingRoots] = useState(false);

  // Загружаем корневые orgs один раз при mount.
  useEffect(() => {
    let cancelled = false;
    setLoadingRoots(true);
    api
      .list<{ organizations: OrgRow[] }>("/organization-manager/v1/organizations")
      .then((r) => {
        if (!cancelled) setOrgs(r.organizations ?? []);
      })
      .catch(() => {
        if (!cancelled) setOrgs([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRoots(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const treeData: TreeDataNode[] = useMemo(() => {
    if (!orgs) return [];
    return orgs.map((o) => ({
      key: k.org(o.id),
      title: nodeTitle(o.name, o.id),
      icon: <ApartmentOutlined />,
      children: loaded[k.org(o.id)] ?? undefined,
      isLeaf: false,
    }));
  }, [orgs, loaded]);

  const onLoadData = async (node: TreeDataNode): Promise<void> => {
    const parsed = parseKey(String(node.key));
    if (!parsed) return;
    const cacheKey = String(node.key);
    if (loaded[cacheKey]) return;

    if (parsed.kind === "org") {
      const r = await api.list<{ clouds: CloudRow[] }>("/resource-manager/v1/clouds", {
        organization_id: parsed.id,
      });
      const children: TreeDataNode[] = (r.clouds ?? []).map((c) => ({
        key: k.cloud(c.id),
        title: nodeTitle(c.name, c.id),
        icon: <CloudOutlined />,
        children: loaded[k.cloud(c.id)] ?? undefined,
        isLeaf: false,
      }));
      setLoaded((prev) => ({ ...prev, [cacheKey]: children }));
    } else if (parsed.kind === "cloud") {
      const r = await api.list<{ folders: FolderRow[] }>("/resource-manager/v1/folders", {
        cloud_id: parsed.id,
      });
      const children: TreeDataNode[] = (r.folders ?? []).map((f) => ({
        key: k.folder(f.id),
        title: nodeTitle(f.name, f.id),
        icon: <FolderOutlined />,
        isLeaf: true,
      }));
      setLoaded((prev) => ({ ...prev, [cacheKey]: children }));
    }
  };

  const onSelect = (_: React.Key[], info: { node: TreeDataNode }) => {
    const parsed = parseKey(String(info.node.key));
    if (!parsed) return;

    if (parsed.kind === "org") {
      // Найдём имя в orgs
      const name = (orgs ?? []).find((o) => o.id === parsed.id)?.name ?? "";
      contextApi.setOrg({ id: parsed.id, name });
      navigate(`/organizations/${parsed.id}/clouds`);
      return;
    }

    if (parsed.kind === "cloud") {
      const orgChildren = Object.values(loaded).flat();
      const node = orgChildren.find((n) => n.key === info.node.key);
      const name = (() => {
        // children'ы хранятся как cloud-rows, имя в title — это JSX. Лучше
        // ре-парсить из orgs+loaded напрямую.
        for (const [pk, kids] of Object.entries(loaded)) {
          for (const kid of kids) {
            if (kid.key === info.node.key) {
              const orgKey = parseKey(pk);
              return { id: parsed.id, organization_id: orgKey?.id ?? "" };
            }
          }
        }
        return { id: parsed.id, organization_id: "" };
      })();
      const titleNode = typeof node?.title === "function" ? null : node?.title;
      contextApi.setCloud({
        id: parsed.id,
        name: extractName(titleNode) ?? "",
        organizationId: name.organization_id,
      });
      navigate(`/clouds/${parsed.id}/folders`);
      return;
    }

    if (parsed.kind === "folder") {
      // Найти cloud-id и org-id parent'ов через loaded-cache.
      let cloudId = "";
      let orgId = "";
      for (const [pk, kids] of Object.entries(loaded)) {
        for (const kid of kids) {
          if (kid.key === info.node.key) {
            const parent = parseKey(pk);
            if (parent?.kind === "cloud") {
              cloudId = parent.id;
              // Найти org для этого cloud
              for (const [orgKey, orgKids] of Object.entries(loaded)) {
                if (orgKids.some((c) => c.key === pk)) {
                  const o = parseKey(orgKey);
                  if (o?.kind === "org") orgId = o.id;
                }
              }
            }
          }
        }
      }
      const titleNode = typeof info.node.title === "function" ? null : info.node.title;
      const folderName = extractName(titleNode) ?? "";
      contextApi.setFolder({
        id: parsed.id,
        uid: parsed.id,
        name: folderName,
        cloudId,
        organizationId: orgId,
      });
      // Если уже на /folders/X/<resource> — сменить только folderId.
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

  // Авто-expand до текущего контекста — добавляем в expandedKeys org/cloud
  // если они есть.
  const expandedKeys: React.Key[] = useMemo(() => {
    const out: React.Key[] = [];
    if (ctx.org) out.push(k.org(ctx.org.id));
    if (ctx.cloud) out.push(k.cloud(ctx.cloud.id));
    return out;
  }, [ctx]);

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ background: token.colorBgLayout, padding: "8px 4px" }}
    >
      {loadingRoots && (
        <div className="flex items-center justify-center p-4">
          <Spin size="small" />
        </div>
      )}
      {!loadingRoots && treeData.length === 0 && (
        <div className="px-3 py-4 text-xs text-[var(--ant-color-text-tertiary)]">
          Нет организаций. Создайте первую через Organizations.
        </div>
      )}
      {!loadingRoots && treeData.length > 0 && (
        <Tree
          showIcon
          blockNode
          treeData={treeData}
          loadData={onLoadData}
          onSelect={onSelect}
          selectedKeys={selectedKeys}
          defaultExpandedKeys={expandedKeys}
        />
      )}
    </div>
  );
}

// Извлекает имя из JSX-ноды title (созданной nodeTitle()).
function extractName(node: React.ReactNode): string | null {
  if (!node || typeof node !== "object") return null;
  // node — JSX <span><span>{name}</span><span>{id}</span></span>
  // Walking children for first string is простейший reliable path.
  const stack: unknown[] = [node];
  while (stack.length) {
    const cur = stack.shift();
    if (typeof cur === "string") return cur;
    if (cur && typeof cur === "object" && "props" in cur) {
      const props = (cur as { props: { children?: unknown } }).props;
      if (Array.isArray(props.children)) stack.push(...props.children);
      else if (props.children) stack.push(props.children);
    }
  }
  return null;
}
