// AddressPoolDetailPage — admin страница AddressPool: utilization + cross-project addresses.
//
// Корневой системный тенант (нет account/project для самого pool), но в табличке
// addresses показываются клиентские project / account (reverse-lookup) после
// KAC-124: Organization/Cloud/Folder → Account/Project.

import { Link, useParams } from "react-router-dom";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ResourceDetailPage } from "@/components/ResourceDetailPage";
import { IpamUtilizationBar, CIDRBreakdown } from "@/components/IpamUtilizationBar";
import { AddressPoolCidrManager } from "@/components/AddressPoolCidrManager";
import { api } from "@/api/client";
import { REGISTRY } from "@/lib/resource-registry";
import type { DetailTab } from "@/components/DetailShell";
import type { AccountSummaryList, ProjectSummaryList } from "@/api/types";

interface PoolAddrEntry {
  id: string;
  project_id: string;
  name: string;
  ipv4: string;
  zone_id: string;
  reserved: boolean;
  used: boolean;
  created_at: string;
}

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

  // KAC-124: IAM Account + Project заменили Resource-Manager Organization+Cloud+Folder.
  // VPC резервирует addresses под `project_id`.
  const { data: projects } = useQuery({
    queryKey: ["iam-projects-all"],
    queryFn: () => api.list<ProjectSummaryList>("/iam/v1/projects"),
    staleTime: 30_000,
  });
  const { data: accounts } = useQuery({
    queryKey: ["iam-accounts-all"],
    queryFn: () => api.list<AccountSummaryList>("/iam/v1/accounts"),
    staleTime: 30_000,
  });

  const projectMap = new Map((projects?.projects ?? []).map((p) => [p.id, p]));
  const accountMap = new Map((accounts?.accounts ?? []).map((a) => [a.id, a]));

  const reverseLookup = (
    projectId: string,
  ): { project?: string; account?: string } => {
    const p = projectMap.get(projectId);
    if (!p) return {};
    const a = p.account_id ? accountMap.get(p.account_id) : undefined;
    return { project: p.name, account: a?.name };
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
                      <th className="text-left px-3 py-2">Project</th>
                      <th className="text-left px-3 py-2">Account</th>
                      <th className="text-left px-3 py-2">Reserved/Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(addresses?.addresses ?? []).map((a) => {
                      const lk = reverseLookup(a.project_id);
                      return (
                        <tr key={a.id} className="border-t border-border hover:bg-muted/20">
                          <td className="px-3 py-2 font-mono">{a.ipv4 || "—"}</td>
                          <td className="px-3 py-2">
                            <Link
                              to={`/projects/${a.project_id}/vpc/addresses/${a.id}`}
                              className="text-blue-400 hover:underline"
                            >
                              {a.name || a.id.slice(0, 12) + "…"}
                            </Link>
                            <div className="text-[10px] text-muted-foreground font-mono">{a.id}</div>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{a.zone_id}</td>
                          <td className="px-3 py-2 text-xs">
                            <Link to={`/projects/${a.project_id}`} className="hover:underline">
                              {lk.project ?? a.project_id.slice(0, 8) + "…"}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-xs">{lk.account ?? "—"}</td>
                          <td className="px-3 py-2 text-xs">
                            {a.reserved && <span className="text-blue-400 mr-1">RES</span>}
                            {a.used && <span className="text-emerald-400">USED</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {(!addresses?.addresses || addresses.addresses.length === 0) && (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
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
    // reverseLookup замыкает projectMap/accountMap из текущего рендера — OK:
    // при смене любого запроса компонент перерендерится и tab'ы получат
    // новый callback.
    [util, addresses, projectMap, accountMap, reverseLookup],
  );

  // CIDR-блоки пула — отдельная панель управления под «Общим» в Обзоре (паритет
  // с Subnet CIDR). KAC-269: мутируются :addCidrBlocks / :removeCidrBlocks, не
  // PATCH (Update больше не меняет CIDR).
  const overviewExtras = (data: Record<string, unknown>) => {
    const id = (data.id as string) ?? poolId ?? "";
    const v4 = (data.v4_cidr_blocks as string[] | undefined) ?? [];
    const v6 = (data.v6_cidr_blocks as string[] | undefined) ?? [];
    return (
      <div style={{ marginTop: 24, maxWidth: 760 }}>
        <AddressPoolCidrManager poolId={id} v4Blocks={v4} v6Blocks={v6} />
      </div>
    );
  };

  return (
    <ResourceDetailPage spec={spec} extraTabs={extraTabs} overviewExtras={overviewExtras} />
  );
}
