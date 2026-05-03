import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  cloudsApi,
  disksApi,
  foldersApi,
  imagesApi,
  instancesApi,
  networksApi,
  nlbApi,
  orgsApi,
  subnetsApi,
  tgApi,
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
  const orgs = useQuery({ queryKey: ["dash.orgs"], queryFn: () => orgsApi.list({}), refetchInterval: 30_000 });
  const clouds = useQuery({ queryKey: ["dash.clouds"], queryFn: () => cloudsApi.list({}), refetchInterval: 30_000 });
  const folders = useQuery({ queryKey: ["dash.folders"], queryFn: () => foldersApi.list({}), refetchInterval: 30_000 });
  const networks = useQuery({ queryKey: ["dash.networks"], queryFn: () => networksApi.list({}), refetchInterval: 15_000 });
  const subnets = useQuery({ queryKey: ["dash.subnets"], queryFn: () => subnetsApi.list({}), refetchInterval: 15_000 });
  const instances = useQuery({ queryKey: ["dash.instances"], queryFn: () => instancesApi.list({}), refetchInterval: 5_000 });
  const disks = useQuery({ queryKey: ["dash.disks"], queryFn: () => disksApi.list({}), refetchInterval: 10_000 });
  const images = useQuery({ queryKey: ["dash.images"], queryFn: () => imagesApi.list({}), refetchInterval: 60_000 });
  const nlbs = useQuery({ queryKey: ["dash.nlb"], queryFn: () => nlbApi.list({}), refetchInterval: 10_000 });
  const tgs = useQuery({ queryKey: ["dash.tg"], queryFn: () => tgApi.list({}), refetchInterval: 10_000 });

  const stats: Stat[] = [
    { label: "Organizations", value: orgs.data?.organizations.length ?? "—", to: "/organizations" },
    { label: "Clouds", value: clouds.data?.clouds.length ?? "—", to: "/clouds" },
    { label: "Folders", value: folders.data?.folders.length ?? "—", to: "/folders" },
    { label: "Networks", value: networks.data?.networks.length ?? "—", to: "/networks", hint: "VPC layer" },
    { label: "Subnets", value: subnets.data?.subnets.length ?? "—", to: "/subnets" },
    { label: "Instances", value: instances.data?.instances.length ?? "—", to: "/instances", hint: "Compute layer" },
    { label: "Disks", value: disks.data?.disks.length ?? "—", to: "/disks" },
    { label: "Images", value: images.data?.images.length ?? "—", to: "/images", hint: "Read-only catalog" },
    { label: "NLBs", value: nlbs.data?.networkLoadBalancers.length ?? "—", to: "/network-load-balancers" },
    { label: "Target Groups", value: tgs.data?.targetGroups.length ?? "—", to: "/target-groups" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Kachō Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Декларативный control-plane: Organization → Cloud → Folder → ресурсы.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </div>

      <div className="rounded-lg border border-border p-5 bg-card">
        <h2 className="font-semibold mb-3">Подсказки</h2>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• Все запросы идут напрямую через <code className="text-xs bg-muted px-1 py-0.5 rounded">/v1/&lt;resource&gt;/list</code> на api-gateway.</li>
          <li>• Folder-scoped страницы (Networks, Instances и т.д.) требуют выбранный folder в шапке.</li>
          <li>• Live-обновление: TanStack Query polling 3-30s в зависимости от ресурса.</li>
          <li>• Для подробностей — смотрите <code className="text-xs bg-muted px-1 py-0.5 rounded">JSON view</code> на странице ресурса.</li>
        </ul>
      </div>
    </div>
  );
}
