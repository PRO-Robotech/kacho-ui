import { useQuery } from "@tanstack/react-query";
import { cloudsApi } from "@/api/resources";
import { ResourceTable } from "@/components/ResourceTable";

export function CloudsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["clouds.list"],
    queryFn: () => cloudsApi.list({}),
    refetchInterval: 10_000,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clouds</h1>
        <p className="text-sm text-muted-foreground">
          Cloud — billing-scope внутри Organization. Folders группируются под Cloud.
        </p>
      </div>
      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">
          Ошибка: {(error as Error).message}
        </div>
      )}
      <ResourceTable
        rows={data?.clouds ?? []}
        loading={isLoading}
        rowKey={(c) => c.metadata.uid}
        columns={[
          { header: "Name", cell: (c) => <span className="font-medium">{c.metadata.name}</span> },
          { header: "Display Name", cell: (c) => c.spec?.displayName ?? "—" },
          {
            header: "Organization",
            cell: (c) => (
              <code className="text-xs text-muted-foreground">
                {(c.metadata.organizationId ?? "—").slice(0, 8)}…
              </code>
            ),
          },
          {
            header: "Created",
            cell: (c) =>
              c.metadata.creationTimestamp
                ? new Date(c.metadata.creationTimestamp).toLocaleString()
                : "—",
            className: "text-muted-foreground text-xs",
          },
        ]}
      />
    </div>
  );
}
