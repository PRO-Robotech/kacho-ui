import { useQuery } from "@tanstack/react-query";
import { networksApi } from "@/api/resources";
import { ResourceTable } from "@/components/ResourceTable";
import { StatusBadge } from "@/components/StatusBadge";
import { useFolderStore } from "@/lib/folder-store";
import { FolderRequiredEmpty } from "@/components/FolderRequiredEmpty";

export function NetworksPage() {
  const folder = useFolderStore((s) => s.folder);
  const { data, isLoading, error } = useQuery({
    queryKey: ["networks.list", folder?.uid],
    queryFn: () =>
      networksApi.list({
        selectors: folder ? [{ field: "folder_id", op: "EQ", values: [folder.uid] }] : [],
      }),
    refetchInterval: 5_000,
    enabled: !!folder,
  });

  if (!folder) return <FolderRequiredEmpty resource="Networks" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Networks</h1>
        <p className="text-sm text-muted-foreground">
          VPC Networks в folder <code className="text-xs bg-muted px-1 py-0.5 rounded">{folder.name}</code>
        </p>
      </div>
      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">
          Ошибка: {(error as Error).message}
        </div>
      )}
      <ResourceTable
        rows={data?.networks ?? []}
        loading={isLoading}
        rowKey={(n) => n.metadata.uid}
        columns={[
          { header: "Name", cell: (n) => <span className="font-medium">{n.metadata.name}</span> },
          { header: "Status", cell: (n) => <StatusBadge state={n.status?.state} /> },
          { header: "Display Name", cell: (n) => n.spec?.displayName ?? "—" },
          {
            header: "UID",
            cell: (n) => (
              <code className="text-xs text-muted-foreground">{n.metadata.uid.slice(0, 8)}…</code>
            ),
          },
          {
            header: "Created",
            cell: (n) =>
              n.metadata.creationTimestamp
                ? new Date(n.metadata.creationTimestamp).toLocaleString()
                : "—",
            className: "text-muted-foreground text-xs",
          },
        ]}
      />
    </div>
  );
}
