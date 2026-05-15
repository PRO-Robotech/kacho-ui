// SystemSearchPage — admin-search по resource ID и имени клиента.
// Запрашивает list endpoints всех ресурсов параллельно, фильтрует client-side
// substring match. Прорастает folder/cloud/org breadcrumbs для каждого хита.

import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api } from "@/api/client";

interface Hit {
  resource: string;
  id: string;
  name: string;
  folder_id?: string;
  cloud_id?: string;
  organization_id?: string;
  link: string;
  extras?: Record<string, string>;
}

const DOMAINS = [
  { resource: "organizations", path: "/organization-manager/v1/organizations", key: "organizations", linkBase: "/organizations/:id" },
  { resource: "clouds",        path: "/resource-manager/v1/clouds",            key: "clouds",        linkBase: "/clouds/:id" },
  { resource: "folders",       path: "/resource-manager/v1/folders",           key: "folders",       linkBase: "/folders/:id" },
  { resource: "networks",      path: "/vpc/v1/networks",                       key: "networks",      linkBase: "/folders/:folder_id/networks/:id" },
  { resource: "subnets",       path: "/vpc/v1/subnets",                        key: "subnets",       linkBase: "/folders/:folder_id/subnets/:id" },
  { resource: "addresses",     path: "/vpc/v1/addresses",                      key: "addresses",     linkBase: "/folders/:folder_id/addresses/:id" },
  { resource: "network-interfaces", path: "/vpc/v1/networkInterfaces",         key: "network_interfaces", linkBase: "/folders/:folder_id/network-interfaces/:id" },
  { resource: "address-pools", path: "/vpc/v1/addressPools",                   key: "pools",         linkBase: "/system/address-pools/:id" },
  { resource: "regions",       path: "/compute/v1/regions",                        key: "regions",       linkBase: "/system/regions/:id" },
  { resource: "zones",         path: "/compute/v1/zones",                          key: "zones",         linkBase: "/system/zones/:id" },
];

// ВАЖНО: VPC list endpoints (networks/subnets/addresses) обычно требуют folderId,
// но в нашем bекенде они работают и без него (cross-folder, вернут все).
// Тогда client-side filter сделает остальное.

export function SystemSearchPage() {
  const [q, setQ] = useState("");

  const queries = useQueries({
    queries: DOMAINS.map((d) => ({
      queryKey: ["search", d.resource],
      queryFn: () => api.list<Record<string, unknown>>(d.path, { pageSize: "500" }),
      staleTime: 10_000,
    })),
  });

  const hits: Hit[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];

    const out: Hit[] = [];
    queries.forEach((qry, i) => {
      const d = DOMAINS[i];
      if (!qry.data) return;
      const list = (qry.data[d.key] as Record<string, unknown>[] | undefined) ?? [];
      list.forEach((r) => {
        const id = String(r.id ?? "");
        const name = String(r.name ?? "");
        const matchesId = id.toLowerCase().includes(term);
        const matchesName = name.toLowerCase().includes(term);
        if (!matchesId && !matchesName) return;
        out.push({
          resource: d.resource,
          id,
          name,
          folder_id: r.folder_id as string | undefined,
          cloud_id: r.cloud_id as string | undefined,
          organization_id: r.organization_id as string | undefined,
          link: d.linkBase
            .replace(":folder_id", String(r.folder_id ?? ""))
            .replace(":id", id),
          extras: extractExtras(d.resource, r),
        });
      });
    });
    return out.slice(0, 100);
  }, [q, queries]);

  const loading = queries.some((q) => q.isLoading);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">System Search</h1>
        <p className="text-sm text-muted-foreground">
          Cross-resource поиск по ID и имени. Включает all org/cloud/folder и vpc-ресурсы (admin).
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ID, имя ресурса, имя клиента…"
          className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading && <div className="text-xs text-muted-foreground">Loading indices…</div>}
      <div className="text-xs text-muted-foreground">
        {q ? `${hits.length} match${hits.length === 1 ? "" : "es"}` : "Введите подстроку — ID или имя"}
      </div>

      {hits.length > 0 && (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2">Resource</th>
                <th className="text-left px-3 py-2">Name / ID</th>
                <th className="text-left px-3 py-2">Folder / Cloud / Org</th>
                <th className="text-left px-3 py-2">Extra</th>
              </tr>
            </thead>
            <tbody>
              {hits.map((h) => (
                <tr key={`${h.resource}-${h.id}`} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs uppercase">{h.resource}</td>
                  <td className="px-3 py-2">
                    <Link to={h.link} className="text-blue-400 hover:underline font-medium">
                      {h.name || "(unnamed)"}
                    </Link>
                    <div className="text-[10px] font-mono text-muted-foreground">{h.id}</div>
                  </td>
                  <td className="px-3 py-2 text-xs font-mono">
                    {h.folder_id && <div>F: {h.folder_id.slice(0, 12)}…</div>}
                    {h.cloud_id && <div>C: {h.cloud_id.slice(0, 12)}…</div>}
                    {h.organization_id && <div>O: {h.organization_id.slice(0, 12)}…</div>}
                    {!h.folder_id && !h.cloud_id && !h.organization_id && <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {Object.entries(h.extras ?? {}).map(([k, v]) => (
                      <div key={k}><span className="text-muted-foreground">{k}:</span> <span className="font-mono">{v}</span></div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function extractExtras(resource: string, r: Record<string, unknown>): Record<string, string> {
  const e: Record<string, string> = {};
  switch (resource) {
    case "addresses": {
      const ext = r.external_ipv4_address as Record<string, unknown> | undefined;
      const intn = r.internal_ipv4_address as Record<string, unknown> | undefined;
      if (ext?.address) e.ext = String(ext.address);
      if (intn?.address) e.int = String(intn.address);
      if (r.type) e.type = String(r.type);
      break;
    }
    case "subnets":
      if (r.zone_id) e.zone = String(r.zone_id);
      if (Array.isArray(r.v4_cidr_blocks)) e.cidrs = (r.v4_cidr_blocks as string[]).join(",");
      break;
    case "address-pools":
      if (r.zone_id) e.zone = String(r.zone_id);
      if (r.kind) e.kind = String(r.kind);
      if (Array.isArray(r.cidr_blocks)) e.cidrs = (r.cidr_blocks as string[]).join(",");
      break;
    case "zones":
      if (r.region_id) e.region = String(r.region_id);
      break;
  }
  return e;
}
