// dependency-graph — построение дерева «что подвязано к ресурсу» для confirm-модалки
// удаления. Generic-механизм: per registry-id резолвер, который через REST собирает
// дочерние ресурсы (рекурсивно), помечая, какие из них блокируют удаление родителя
// (FK RESTRICT на бэкенде → "Network/Subnet ... is not empty").
//
// Сейчас резолверы есть для:
//   networks  → subnets (рекурсивно: addresses, network-interfaces) · route-tables · security-groups
//   subnets   → addresses · network-interfaces
// (см. kacho-vpc/CLAUDE.md §2 «FK contract»: default-SG авто-удаляется при Network.Delete,
//  поэтому defaultForNetwork-SG помечается blocks=false.)

import { api } from "@/api/client";
import { REGISTRY } from "@/lib/resource-registry";

export interface DepNode {
  /** Уникальный ключ для antd Tree. */
  key: string;
  /** registry id (например "subnets"). */
  resourceId: string;
  id: string;
  name: string;
  /** folder id ресурса — для построения ссылки. */
  folderId: string;
  /** URL-сегмент под /folders/:fid/ (например "vpc/subnets"). */
  routeSegment: string;
  /** Блокирует удаление родителя (FK RESTRICT)? */
  blocks: boolean;
  children: DepNode[];
}

type AnyRec = Record<string, any>;

async function listAll(apiPath: string, payloadKey: string, query?: Record<string, string>): Promise<AnyRec[]> {
  const r = await api.list<Record<string, AnyRec[]>>(apiPath, { pageSize: "1000", ...(query ?? {}) });
  return r?.[payloadKey] ?? [];
}

function routeSegmentFor(resourceId: string): string {
  const spec = REGISTRY[resourceId];
  const route = spec?.route ?? resourceId;
  return resourceId.startsWith("compute-") ? `compute/${route}` : `vpc/${route}`;
}

function mkNode(resourceId: string, r: AnyRec, blocks: boolean, children: DepNode[] = []): DepNode {
  return {
    key: `${resourceId}:${r.id}`,
    resourceId,
    id: String(r.id),
    name: (r.name as string) || String(r.id),
    folderId: (r.folder_id as string) || "",
    routeSegment: routeSegmentFor(resourceId),
    blocks,
    children,
  };
}

/** Дети подсети: internal-Address'ы и NetworkInterface'ы на ней (фильтр по folder-спискам). */
async function subnetChildren(subnetId: string, folderId: string): Promise<DepNode[]> {
  if (!folderId) return [];
  const [addrs, nics] = await Promise.all([
    listAll("/vpc/v1/addresses", "addresses", { folder_id: folderId }),
    listAll("/vpc/v1/networkInterfaces", "network_interfaces", { folder_id: folderId }),
  ]);
  const out: DepNode[] = [];
  for (const a of addrs) {
    const sid = a.internal_ipv4_address?.subnet_id ?? a.internal_ipv6_address?.subnet_id;
    if (sid === subnetId) out.push(mkNode("addresses", a, true));
  }
  for (const ni of nics) {
    if (ni.subnet_id === subnetId) out.push(mkNode("network-interfaces", ni, true));
  }
  return out;
}

/** Есть ли резолвер зависимостей для этого registry-id. */
export function hasDependencyResolver(resourceId: string): boolean {
  return resourceId === "networks" || resourceId === "subnets";
}

/** Собрать дерево зависимостей ресурса. `resource` — минимум {id, folder_id}. */
export async function loadDependents(
  resourceId: string,
  resource: { id: string; folder_id?: string | null },
): Promise<DepNode[]> {
  const folderId = resource.folder_id ?? "";

  if (resourceId === "networks") {
    const [subnets, routeTables, sgs] = await Promise.all([
      listAll(`/vpc/v1/networks/${resource.id}/subnets`, "subnets"),
      listAll(`/vpc/v1/networks/${resource.id}/route_tables`, "route_tables"),
      listAll(`/vpc/v1/networks/${resource.id}/security_groups`, "security_groups"),
    ]);
    const out: DepNode[] = [];
    for (const s of subnets) {
      const kids = await subnetChildren(String(s.id), (s.folder_id as string) || folderId);
      out.push(mkNode("subnets", s, true, kids));
    }
    for (const rt of routeTables) out.push(mkNode("route-tables", rt, true));
    for (const sg of sgs) {
      const isDefault = !!sg.default_for_network;
      out.push(mkNode("security-groups", { ...sg, name: (isDefault ? "default · " : "") + ((sg.name as string) || sg.id) }, !isDefault));
    }
    return out;
  }

  if (resourceId === "subnets") {
    return subnetChildren(resource.id, folderId);
  }

  return [];
}

/** Все блокирующие узлы дерева (рекурсивно) — для предупреждения «сначала удалите …». */
export function blockingNodes(nodes: DepNode[]): DepNode[] {
  const acc: DepNode[] = [];
  const walk = (ns: DepNode[]) => {
    for (const n of ns) {
      if (n.blocks) acc.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return acc;
}
