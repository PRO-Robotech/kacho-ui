import { useQuery } from "@tanstack/react-query";
import { instancesApi } from "@/api/resources";
import { ResourceTable } from "@/components/ResourceTable";
import { StatusBadge } from "@/components/StatusBadge";
import { useFolderStore } from "@/lib/folder-store";
import { FolderRequiredEmpty } from "@/components/FolderRequiredEmpty";

export function InstancesPage() {
  const folder = useFolderStore((s) => s.folder);
  const { data, isLoading, error } = useQuery({
    queryKey: ["instances.list", folder?.uid],
    queryFn: () =>
      instancesApi.list({
        selectors: folder ? [{ field: "folder_id", op: "EQ", values: [folder.uid] }] : [],
      }),
    refetchInterval: 3_000,
    enabled: !!folder,
  });
  if (!folder) return <FolderRequiredEmpty resource="Instances" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Instances</h1>
        <p className="text-sm text-muted-foreground">VM-instances в folder <code className="text-xs bg-muted px-1 py-0.5 rounded">{folder.name}</code></p>
      </div>
      {error && <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">Ошибка: {(error as Error).message}</div>}
      <ResourceTable
        rows={data?.instances ?? []}
        loading={isLoading}
        rowKey={(i) => i.metadata.uid}
        columns={[
          { header: "Name", cell: (i) => <span className="font-medium">{i.metadata.name}</span> },
          { header: "Status", cell: (i) => <StatusBadge state={i.status?.state} /> },
          { header: "Platform", cell: (i) => i.spec?.platformId ?? "—" },
          { header: "Zone", cell: (i) => i.spec?.zoneId ?? "—" },
          { header: "Internal IPs", cell: (i) => (i.status?.ips?.internal ?? []).join(", ") || "—", className: "text-xs" },
          { header: "Desired", cell: (i) => i.spec?.desiredPowerState?.replace("POWER_", "") ?? "—" },
        ]}
      />
    </div>
  );
}
