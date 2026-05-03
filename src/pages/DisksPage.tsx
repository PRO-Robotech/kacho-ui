import { useQuery } from "@tanstack/react-query";
import { disksApi } from "@/api/resources";
import { ResourceTable } from "@/components/ResourceTable";
import { StatusBadge } from "@/components/StatusBadge";
import { useFolderStore } from "@/lib/folder-store";
import { FolderRequiredEmpty } from "@/components/FolderRequiredEmpty";

export function DisksPage() {
  const folder = useFolderStore((s) => s.folder);
  const { data, isLoading, error } = useQuery({
    queryKey: ["disks.list", folder?.uid],
    queryFn: () =>
      disksApi.list({
        selectors: folder ? [{ field: "folder_id", op: "EQ", values: [folder.uid] }] : [],
      }),
    refetchInterval: 3_000,
    enabled: !!folder,
  });
  if (!folder) return <FolderRequiredEmpty resource="Disks" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Disks</h1>
        <p className="text-sm text-muted-foreground">Block storage disks в folder <code className="text-xs bg-muted px-1 py-0.5 rounded">{folder.name}</code></p>
      </div>
      {error && <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">Ошибка: {(error as Error).message}</div>}
      <ResourceTable
        rows={data?.disks ?? []}
        loading={isLoading}
        rowKey={(d) => d.metadata.uid}
        columns={[
          { header: "Name", cell: (d) => <span className="font-medium">{d.metadata.name}</span> },
          { header: "Status", cell: (d) => <StatusBadge state={d.status?.state} /> },
          { header: "Type", cell: (d) => d.spec?.diskTypeId ?? "—" },
          { header: "Size", cell: (d) => d.spec?.size ?? "—" },
          { header: "Zone", cell: (d) => d.spec?.zoneId ?? "—" },
        ]}
      />
    </div>
  );
}
