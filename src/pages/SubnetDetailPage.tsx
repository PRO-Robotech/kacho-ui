// SubnetDetailPage — расширение generic ResourceDetailPage с utilization-баром.
//
// Клиентская иерархия: Folder → Network → Subnet → Address (internal).
// Total = sum(usable per CIDR), Used = ListUsedAddresses count.

import { useParams, useNavigate, Link } from "react-router-dom";
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

interface Subnet {
  id: string;
  folder_id: string;
  name: string;
  network_id: string;
  zone_id: string;
  v4_cidr_blocks?: string[];
  v6_cidr_blocks?: string[];
  description?: string;
  route_table_id?: string;
  created_at?: string;
}

interface UsedAddress {
  address: string;
  ip_version: string;
  references?: { type: string; referrer: string }[];
}

// usable IPs per IPv4 CIDR (excluding network/broadcast).
function usableIPv4(cidr: string): number {
  const m = cidr.match(/\/(\d+)$/);
  if (!m) return 0;
  const bits = Number(m[1]);
  if (bits === 32) return 1;
  if (bits === 31) return 2;
  if (bits >= 30) return Math.max(0, 2 ** (32 - bits) - 2);
  // Cap: для огромных subnet's (вряд ли) — считаем как Number
  return Math.max(0, 2 ** (32 - bits) - 2);
}

export function SubnetDetailPage() {
  const { folderId, uid: subnetId } = useParams();
  const navigate = useNavigate();
  const spec = REGISTRY["subnets"];

  const { data: subnet, isLoading, refetch: refetchSubnet } = useQuery({
    queryKey: ["subnet", subnetId],
    queryFn: () => api.get<Subnet>(`/vpc/v1/subnets/${subnetId}`),
    refetchInterval: 5000,
    enabled: !!subnetId,
  });

  const { data: used, refetch: refetchUsed } = useQuery({
    queryKey: ["subnet-used", subnetId],
    queryFn: () => api.get<{ addresses: UsedAddress[] }>(
      `/vpc/v1/subnets/${subnetId}/addresses?pageSize=500`),
    refetchInterval: 5000,
    enabled: !!subnetId,
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!subnet) return <div className="p-8 text-red-400">Subnet not found</div>;

  const cidrs = subnet.v4_cidr_blocks ?? [];
  const cidrBreakdown = cidrs.map((cidr) => {
    const total = usableIPv4(cidr);
    // Точное количество использованных в каждом CIDR без backend-помощи —
    // переберём used addresses и подсчитаем те, что попадают в этот CIDR.
    const used4 = (used?.addresses ?? []).filter((u) =>
      ipv4InCidr(u.address, cidr)).length;
    return { cidr, total, used: used4 };
  });
  const totalIPs = cidrBreakdown.reduce((acc, c) => acc + c.total, 0);
  const usedIPs = (used?.addresses ?? []).length;
  const refresh = () => { refetchSubnet(); refetchUsed(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/folders/${folderId}/subnets`)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{subnet.name || "(unnamed)"}</h1>
          <div className="text-xs text-muted-foreground flex gap-3 mt-0.5">
            <CopyableId id={subnetId ?? ""} />
            <span>zone: <span className="font-mono">{subnet.zone_id}</span></span>
            <span>network: <Link to={`/folders/${folderId}/networks/${subnet.network_id}`} className="font-mono text-blue-400 hover:underline">
              {subnet.network_id.slice(0, 12)}…
            </Link></span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RotateCw className="h-4 w-4" /> Refresh
        </Button>
        <ResourceFormDialog
          mode="edit"
          title={`Edit ${spec.singular}`}
          apiPath={`${spec.apiPath}/${subnetId}`}
          resourceId={spec.id}
          template={subnet}
          fields={spec.fields}
          folderUid={folderId}
          onSuccess={refresh}
          sanitize={spec.sanitize}
        />
        <DeleteButton
          apiPath={`${spec.apiPath}/${subnetId}`}
          resourceId={spec.id}
          name={subnet.name || (subnetId ?? "")}
          resourceLabel={spec.singular}
          folderUid={folderId}
          navigateTo={() => navigate(`/folders/${folderId}/subnets`)}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="addresses">Addresses ({usedIPs})</TabsTrigger>
          <TabsTrigger value="json">Raw JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 pt-4">
          <IpamUtilizationBar
            label="Subnet utilization"
            total={totalIPs}
            used={usedIPs}
          />
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Per-CIDR breakdown</div>
            <CIDRBreakdown cidrs={cidrBreakdown} />
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <Field label="Description">{subnet.description || "—"}</Field>
            <Field label="Network"><span className="font-mono">{subnet.network_id}</span></Field>
            <Field label="Zone"><span className="font-mono">{subnet.zone_id}</span></Field>
            <Field label="Route Table"><span className="font-mono">{subnet.route_table_id || "—"}</span></Field>
          </div>
        </TabsContent>

        <TabsContent value="addresses" className="pt-4">
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2">IP</th>
                  <th className="text-left px-3 py-2">Version</th>
                  <th className="text-left px-3 py-2">References</th>
                </tr>
              </thead>
              <tbody>
                {(used?.addresses ?? []).map((u, i) => (
                  <tr key={`${u.address}-${i}`} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono">{u.address}</td>
                    <td className="px-3 py-2 text-xs">{u.ip_version}</td>
                    <td className="px-3 py-2 text-xs">
                      {(u.references ?? []).map((r, j) =>
                        <div key={j} className="font-mono">{r.type}: {r.referrer}</div>)}
                      {!u.references?.length && "—"}
                    </td>
                  </tr>
                ))}
                {(!used?.addresses || used.addresses.length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                      No allocated addresses
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="json" className="pt-4">
          <JsonView data={subnet} />
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

// ipv4InCidr — простая проверка вхождения IP в CIDR.
function ipv4InCidr(ip: string, cidr: string): boolean {
  if (!ip || !cidr) return false;
  const [base, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  if (!bits || bits < 0 || bits > 32) return false;
  const ipN = ipv4ToInt(ip);
  const baseN = ipv4ToInt(base);
  if (ipN < 0 || baseN < 0) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipN & mask) === (baseN & mask);
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return -1;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}
