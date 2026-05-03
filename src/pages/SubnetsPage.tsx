import { useQuery } from "@tanstack/react-query";
import { subnetsApi } from "@/api/resources";
import { ResourceTable } from "@/components/ResourceTable";
import { StatusBadge } from "@/components/StatusBadge";
import { useFolderStore } from "@/lib/folder-store";
import { FolderRequiredEmpty } from "@/components/FolderRequiredEmpty";

export function SubnetsPage() {
  const folder = useFolderStore((s) => s.folder);
  const { data, isLoading, error } = useQuery({
    queryKey: ["subnets.list", folder?.uid],
    queryFn: () =>
      subnetsApi.list({
        selectors: folder ? [{ field: "folder_id", op: "EQ", values: [folder.uid] }] : [],
      }),
    refetchInterval: 5_000,
    enabled: !!folder,
  });
  if (!folder) return <FolderRequiredEmpty resource="Subnets" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Subnets</h1>
        <p className="text-sm text-muted-foreground">VPC Subnets в folder <code className="text-xs bg-muted px-1 py-0.5 rounded">{folder.name}</code></p>
      </div>
      {error && <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">Ошибка: {(error as Error).message}</div>}
      <ResourceTable
        rows={data?.subnets ?? []}
        loading={isLoading}
        rowKey={(s) => s.metadata.uid}
        columns={[
          { header: "Name", cell: (s) => <span className="font-medium">{s.metadata.name}</span> },
          { header: "Status", cell: (s) => <StatusBadge state={s.status?.state} /> },
          { header: "Network", cell: (s) => <code className="text-xs text-muted-foreground">{(s.spec?.networkId ?? "—").slice(0, 8)}…</code> },
          { header: "Zone", cell: (s) => s.spec?.zoneId ?? "—" },
          { header: "CIDR", cell: (s) => <code className="text-xs">{s.spec?.cidrBlock ?? "—"}</code> },
        ]}
      />
    </div>
  );
}
