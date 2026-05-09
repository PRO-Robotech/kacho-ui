// AddressPoolDetailPage — admin страница AddressPool: utilization + cross-folder addresses.
//
// Корневой системный тенант (нет org/cloud/folder для самого pool), но в табличке
// addresses показываются клиентские folder/cloud/org (reverse-lookup).

import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonView } from "@/components/JsonView";
import { CopyableId } from "@/components/CopyableId";
import { ResourceFormDialog } from "@/components/ResourceFormDialog";
import { DeleteButton } from "@/components/DeleteButton";
import { IpamUtilizationBar, CIDRBreakdown } from "@/components/IpamUtilizationBar";
import { api } from "@/api/client";
import { REGISTRY } from "@/lib/resource-registry";

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
  const navigate = useNavigate();

  const poolSpec = REGISTRY["address-pools"];

  const { data: pool, isLoading: loadingPool, refetch: refetchPool } = useQuery({
    queryKey: ["pool", poolId],
    queryFn: () => api.get<Record<string, unknown>>(`/vpc/v1/addressPools/${poolId}`),
    refetchInterval: 5000,
    enabled: !!poolId,
  });

  const { data: util, refetch: refetchUtil } = useQuery({
    queryKey: ["pool-util", poolId],
    queryFn: () => api.get<{
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

  const { data: addresses, refetch: refetchAddrs } = useQuery({
    queryKey: ["pool-addresses", poolId],
    queryFn: () => api.get<{ addresses: PoolAddrEntry[] }>(
      `/vpc/v1/addressPools/${poolId}/addresses?pageSize=200`),
    refetchInterval: 5000,
    enabled: !!poolId,
  });

  // Reverse-lookup: folder → cloud → org. Загружаем все три уровня и
  // группируем в Map для O(1) lookup.
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
    queryFn: () => api.list<{ organizations: Organization[] }>("/organization-manager/v1/organizations"),
    staleTime: 30_000,
  });

  const folderMap = new Map((folders?.folders ?? []).map((f) => [f.id, f]));
  const cloudMap  = new Map((clouds?.clouds ?? []).map((c) => [c.id, c]));
  const orgMap    = new Map((orgs?.organizations ?? []).map((o) => [o.id, o]));

  const reverseLookup = (folderId: string): { folder?: string; cloud?: string; org?: string } => {
    const f = folderMap.get(folderId);
    if (!f) return {};
    const c = cloudMap.get(f.cloud_id);
    const o = c ? orgMap.get(c.organization_id) : undefined;
    return { folder: f.name, cloud: c?.name, org: o?.name };
  };

  const refresh = () => {
    refetchPool();
    refetchUtil();
    refetchAddrs();
  };

  if (loadingPool) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!pool) return <div className="p-8 text-red-400">Pool not found</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/system/address-pools")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{(pool.name as string) || "(unnamed)"}</h1>
          <div className="text-xs text-muted-foreground flex gap-3 mt-0.5">
            <CopyableId id={poolId ?? ""} />
            <span>kind: <span className="font-mono">{pool.kind as string}</span></span>
            <span>zone: <span className="font-mono">{(pool.zone_id as string) || "(global)"}</span></span>
            {(pool.is_default as boolean) && <span className="text-emerald-400 font-medium">DEFAULT</span>}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RotateCw className="h-4 w-4" /> Refresh
        </Button>
        <ResourceFormDialog
          mode="edit"
          title={`Edit ${poolSpec.singular}`}
          apiPath={`${poolSpec.apiPath}/${poolId}`}
          resourceId={poolSpec.id}
          template={pool}
          fields={poolSpec.fields}
          onSuccess={refresh}
          sanitize={poolSpec.sanitize}
        />
        <DeleteButton
          apiPath={`${poolSpec.apiPath}/${poolId}`}
          resourceId={poolSpec.id}
          name={(pool.name as string) || (poolId ?? "")}
          resourceLabel={poolSpec.singular}
          navigateTo={() => navigate("/system/address-pools")}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="addresses">
            Addresses ({addresses?.addresses?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="json">Raw JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 pt-4">
          {util && (
            <>
              <IpamUtilizationBar
                label="Pool utilization"
                total={util.total_ips}
                used={util.used_ips}
                free={util.free_ips}
                percent={util.used_percent}
              />
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">Per-CIDR breakdown</div>
                <CIDRBreakdown cidrs={util.cidrs ?? []} />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <Field label="Description">{(pool.description as string) || "—"}</Field>
            <Field label="Kind">{pool.kind as string}</Field>
            <Field label="Zone">{(pool.zone_id as string) || "(global)"}</Field>
            <Field label="Is default">{String(pool.is_default ?? false)}</Field>
            <Field label="Selector priority">{String(pool.selector_priority ?? 0)}</Field>
            <Field label="Selector labels">
              <code className="text-xs">{JSON.stringify(pool.selector_labels ?? {})}</code>
            </Field>
          </div>
        </TabsContent>

        <TabsContent value="addresses" className="pt-4">
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2">IP</th>
                  <th className="text-left px-3 py-2">Address</th>
                  <th className="text-left px-3 py-2">Zone</th>
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
                        <Link to={`/folders/${a.folder_id}/addresses/${a.id}`} className="text-blue-400 hover:underline">
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
                      No addresses allocated from this pool
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="json" className="pt-4">
          <JsonView data={pool} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{children}</div>
    </div>
  );
}
