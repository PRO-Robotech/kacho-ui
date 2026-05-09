// SubnetDetailPage — расширение generic ResourceDetailPage с utilization-баром
// и tab "IP-адреса" (used addresses из ListUsedAddresses).
//
// Шапка/Edit/Delete — через ResourceDetailPage. Здесь только subnet-specific
// контент: utilization, CIDR breakdown, list used addresses.

import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ResourceDetailPage } from "@/components/ResourceDetailPage";
import { IpamUtilizationBar, CIDRBreakdown } from "@/components/IpamUtilizationBar";
import { api } from "@/api/client";
import { REGISTRY } from "@/lib/resource-registry";
import type { DetailTab } from "@/components/DetailShell";

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
  return Math.max(0, 2 ** (32 - bits) - 2);
}

export function SubnetDetailPage() {
  const { uid: subnetId } = useParams();
  const spec = REGISTRY["subnets"];

  const { data: used } = useQuery({
    queryKey: ["subnet-used", subnetId],
    queryFn: () =>
      api.get<{ addresses: UsedAddress[] }>(
        `/vpc/v1/subnets/${subnetId}/addresses?pageSize=500`,
      ),
    refetchInterval: 5000,
    enabled: !!subnetId,
  });

  const extraTabs = useMemo(
    () =>
      (data: Record<string, unknown>): DetailTab[] => {
        const cidrs = (data.v4_cidr_blocks as string[] | undefined) ?? [];
        const usedIPs = used?.addresses?.length ?? 0;
        const cidrBreakdown = cidrs.map((cidr) => {
          const total = usableIPv4(cidr);
          const used4 = (used?.addresses ?? []).filter((u) => ipv4InCidr(u.address, cidr)).length;
          return { cidr, total, used: used4 };
        });
        const totalIPs = cidrBreakdown.reduce((acc, c) => acc + c.total, 0);

        return [
          {
            id: "ipam",
            label: "Использование",
            render: () => (
              <div className="space-y-6">
                <IpamUtilizationBar
                  label="Утилизация подсети"
                  total={totalIPs}
                  used={usedIPs}
                />
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    По CIDR
                  </div>
                  <CIDRBreakdown cidrs={cidrBreakdown} />
                </div>
              </div>
            ),
          },
          {
            id: "addresses",
            label: "IP-адреса",
            count: usedIPs,
            render: () => (
              <div className="rounded-lg border border-border overflow-hidden bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-3 py-2">IP</th>
                      <th className="text-left px-3 py-2">Версия</th>
                      <th className="text-left px-3 py-2">Ссылки</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(used?.addresses ?? []).map((u, i) => (
                      <tr key={`${u.address}-${i}`} className="border-t border-border hover:bg-muted/20">
                        <td className="px-3 py-2 font-mono">{u.address}</td>
                        <td className="px-3 py-2 text-xs">{u.ip_version}</td>
                        <td className="px-3 py-2 text-xs">
                          {(u.references ?? []).map((r, j) => (
                            <div key={j} className="font-mono">
                              {r.type}: {r.referrer}
                            </div>
                          ))}
                          {!u.references?.length && "—"}
                        </td>
                      </tr>
                    ))}
                    {(!used?.addresses || used.addresses.length === 0) && (
                      <tr>
                        <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                          Нет занятых адресов
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
    [used],
  );

  return <ResourceDetailPage spec={spec} extraTabs={extraTabs} />;
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
