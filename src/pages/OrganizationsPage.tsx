import { useQuery } from "@tanstack/react-query";
import { orgsApi } from "@/api/resources";
import { ResourceTable } from "@/components/ResourceTable";

export function OrganizationsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["organizations.list"],
    queryFn: () => orgsApi.list({}),
    refetchInterval: 10_000,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
        <p className="text-sm text-muted-foreground">
          Корневой уровень иерархии Kachō. Cluster-scoped — нельзя сменить через folder-selector.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">
          Ошибка: {(error as Error).message}
        </div>
      )}

      <ResourceTable
        rows={data?.organizations ?? []}
        loading={isLoading}
        rowKey={(o) => o.metadata.uid}
        columns={[
          { header: "Name", cell: (o) => <span className="font-medium">{o.metadata.name}</span> },
          {
            header: "Display Name",
            cell: (o) => o.spec?.displayName ?? "—",
          },
          {
            header: "UID",
            cell: (o) => (
              <code className="text-xs text-muted-foreground">{o.metadata.uid.slice(0, 8)}…</code>
            ),
          },
          {
            header: "Created",
            cell: (o) =>
              o.metadata.creationTimestamp
                ? new Date(o.metadata.creationTimestamp).toLocaleString()
                : "—",
            className: "text-muted-foreground text-xs",
          },
          {
            header: "RV",
            cell: (o) => (
              <code className="text-xs text-muted-foreground">{o.metadata.resourceVersion ?? "—"}</code>
            ),
          },
        ]}
      />
    </div>
  );
}
