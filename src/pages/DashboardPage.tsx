import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  cloudsApi,
  foldersApi,
  networksApi,
  orgsApi,
  subnetsApi,
  addressesApi,
  routeTablesApi,
} from "@/api/resources";
import { cn } from "@/lib/utils";

interface Stat {
  label: string;
  value: string | number;
  to: string;
  hint?: string;
}

function StatCard({ stat }: { stat: Stat }) {
  return (
    <Link
      to={stat.to}
      className={cn(
        "group rounded-lg border border-border p-5 hover:border-primary/40 hover:shadow-sm transition-all bg-card",
      )}
    >
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
        {stat.label}
      </div>
      <div className="text-3xl font-bold tabular-nums mt-1">{stat.value}</div>
      {stat.hint && <div className="text-xs text-muted-foreground mt-2">{stat.hint}</div>}
    </Link>
  );
}

export function DashboardPage() {
  const orgs = useQuery({ queryKey: ["dash.orgs"], queryFn: () => orgsApi.list(), refetchInterval: 30_000 });
  const clouds = useQuery({ queryKey: ["dash.clouds"], queryFn: () => cloudsApi.list(), refetchInterval: 30_000 });
  const folders = useQuery({ queryKey: ["dash.folders"], queryFn: () => foldersApi.list(), refetchInterval: 30_000 });
  const networks = useQuery({ queryKey: ["dash.networks"], queryFn: () => networksApi.list(), refetchInterval: 15_000 });
  const subnets = useQuery({ queryKey: ["dash.subnets"], queryFn: () => subnetsApi.list(), refetchInterval: 15_000 });
  const addresses = useQuery({ queryKey: ["dash.addresses"], queryFn: () => addressesApi.list(), refetchInterval: 15_000 });
  const routeTables = useQuery({ queryKey: ["dash.route-tables"], queryFn: () => routeTablesApi.list(), refetchInterval: 15_000 });

  const stats: Stat[] = [
    { label: "Organizations", value: orgs.data?.organizations.length ?? "—", to: "/organizations" },
    { label: "Clouds", value: clouds.data?.clouds.length ?? "—", to: "/clouds" },
    { label: "Folders", value: folders.data?.folders.length ?? "—", to: "/folders" },
    { label: "Networks", value: networks.data?.networks.length ?? "—", to: "/networks", hint: "VPC layer" },
    { label: "Subnets", value: subnets.data?.subnets.length ?? "—", to: "/subnets" },
    { label: "Addresses", value: addresses.data?.addresses.length ?? "—", to: "/addresses" },
    { label: "Route Tables", value: routeTables.data?.route_tables.length ?? "—", to: "/route-tables" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Kachō Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Декларативный control-plane: Organization → Cloud → Folder → ресурсы.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </div>

      <div className="rounded-lg border border-border p-5 bg-card">
        <h2 className="font-semibold mb-3">Подсказки</h2>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>
            • Get/List: синхронные{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">GET /&lt;domain&gt;/v1/&lt;resource&gt;</code> с query-параметрами.
          </li>
          <li>
            • Create/Update/Delete возвращают{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">Operation</code> — UI поллит{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">GET /operations/{"{id}"}</code>{" "}
            до <code className="text-xs bg-muted px-1 py-0.5 rounded">done=true</code>.
          </li>
          <li>
            • Folder-scoped страницы (Networks, Subnets и т.д.) требуют выбранный folder в шапке.
          </li>
          <li>
            • Live-обновление: polling 3–30s в зависимости от ресурса.
          </li>
          <li>
            • Для подробностей — смотрите{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">Raw JSON</code> на странице ресурса.
          </li>
        </ul>
      </div>
    </div>
  );
}
