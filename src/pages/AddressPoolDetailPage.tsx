// AddressPoolDetailPage — admin страница AddressPool: utilization + cross-folder addresses.
//
// Корневой системный тенант (нет org/cloud/folder для самого pool), но в табличке
// addresses показываются клиентские folder/cloud/org (reverse-lookup).

import { Link, useParams } from "react-router-dom";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ResourceDetailPage } from "@/components/ResourceDetailPage";
import { IpamUtilizationBar, CIDRBreakdown } from "@/components/IpamUtilizationBar";
import { api } from "@/api/client";
import { REGISTRY } from "@/lib/resource-registry";
import type { DetailTab } from "@/components/DetailShell";

interface PoolAddrEntry {
  id: string;
  folder_id: string;
  name: string;
  ipv4: string;
  zone_id: string;
  reserved: boolean;
  used: boolean;
  created_at: string;
}

interface Folder { id: string; name: string; cloud_id: string }
interface Cloud  { id: string; name: string; organization_id: string }
interface Organization { id: string; name: string }

export function AddressPoolDetailPage() {
  const { uid: poolId } = useParams();
  const spec = REGISTRY["address-pools"];

  const { data: util } = useQuery({
    queryKey: ["pool-util", poolId],
    queryFn: () =>
      api.get<{
        pool_id: string;
        total_ips: string | number;
        used_ips: string | number;
        free_ips: string | number;
        used_percent: number;
        cidrs: { cidr: string; total: string | number; used: string | number }[];
      }>(`/vpc/v1/addressPools/${poolId}/utilization`),
    refetchInterval: 5000,
    enabled: !!poolId,
  });

  const { data: addresses } = useQuery({
    queryKey: ["pool-addresses", poolId],
    queryFn: () =>
      api.get<{ addresses: PoolAddrEntry[] }>(
        `/vpc/v1/addressPools/${poolId}/addresses?pageSize=200`,
      ),
    refetchInterval: 5000,
    enabled: !!poolId,
  });

  const { data: folders } = useQuery({
    queryKey: ["folders-all"],
    queryFn: () => api.list<{ folders: Folder[] }>("/resource-manager/v1/folders"),
    staleTime: 30_000,
  });
  const { data: clouds } = useQuery({
    queryKey: ["clouds-all"],
    queryFn: () => api.list<{ clouds: Cloud[] }>("/resource-manager/v1/clouds"),
    staleTime: 30_000,
  });
  const { data: orgs } = useQuery({
    queryKey: ["orgs-all"],
    queryFn: () =>
      api.list<{ organizations: Organization[] }>("/organization-manager/v1/organizations"),
    staleTime: 30_000,
  });

  const folderMap = new Map((folders?.folders ?? []).map((f) => [f.id, f]));
  const cloudMap = new Map((clouds?.clouds ?? []).map((c) => [c.id, c]));
  const orgMap = new Map((orgs?.organizations ?? []).map((o) => [o.id, o]));

  const reverseLookup = (folderId: string): { folder?: string; cloud?: string; org?: string } => {
    const f = folderMap.get(folderId);
    if (!f) return {};
    const c = cloudMap.get(f.cloud_id);
    const o = c ? orgMap.get(c.organization_id) : undefined;
    return { folder: f.name, cloud: c?.name, org: o?.name };
  };

  const extraTabs = useMemo(
    () =>
      (): DetailTab[] => {
        const addrCount = addresses?.addresses?.length ?? 0;
        return [
          {
            id: "ipam",
            label: "Использование",
            render: () =>
              util ? (
                <div className="space-y-6">
                  <IpamUtilizationBar
                    label="Утилизация пула"
                    total={util.total_ips}
                    used={util.used_ips}
                    free={util.free_ips}
                    percent={util.used_percent}
                  />
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2">По CIDR</div>
                    <CIDRBreakdown cidrs={util.cidrs ?? []} />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Загрузка…</div>
              ),
          },
          {
            id: "addresses",
            label: "Адреса",
            count: addrCount,
            render: () => (
              <div className="rounded-lg border border-border overflow-hidden bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-3 py-2">IP</th>
                      <th className="text-left px-3 py-2">Адрес</th>
                      <th className="text-left px-3 py-2">Зона</th>
                      <th className="text-left px-3 py-2">Folder</th>
                      <th className="text-left px-3 py-2">Cloud</th>
                      <th className="text-left px-3 py-2">Org</th>
                      <th className="text-left px-3 py-2">Reserved/Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(addresses?.addresses ?? []).map((a) => {
                      const lk = reverseLookup(a.folder_id);
                      return (
                        <tr key={a.id} className="border-t border-border hover:bg-muted/20">
                          <td className="px-3 py-2 font-mono">{a.ipv4 || "—"}</td>
                          <td className="px-3 py-2">
                            <Link
                              to={`/folders/${a.folder_id}/addresses/${a.id}`}
                              className="text-blue-400 hover:underline"
                            >
                              {a.name || a.id.slice(0, 12) + "…"}
                            </Link>
                            <div className="text-[10px] text-muted-foreground font-mono">{a.id}</div>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{a.zone_id}</td>
                          <td className="px-3 py-2 text-xs">
                            <Link to={`/folders/${a.folder_id}`} className="hover:underline">
                              {lk.folder ?? a.folder_id.slice(0, 8) + "…"}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-xs">{lk.cloud ?? "—"}</td>
                          <td className="px-3 py-2 text-xs">{lk.org ?? "—"}</td>
                          <td className="px-3 py-2 text-xs">
                            {a.reserved && <span className="text-blue-400 mr-1">RES</span>}
                            {a.used && <span className="text-emerald-400">USED</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {(!addresses?.addresses || addresses.addresses.length === 0) && (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                          Из этого пула адреса ещё не выделены
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ),
          },
        ];
      },
    // reverseLookup замыкает folderMap/cloudMap/orgMap из текущего рендера —
    // OK: при смене любого из трёх запросов компонент перерендерится и tab'ы
    // получат новый callback.
    [util, addresses, folderMap, cloudMap, orgMap, reverseLookup],
  );

  return <ResourceDetailPage spec={spec} extraTabs={extraTabs} />;
}
