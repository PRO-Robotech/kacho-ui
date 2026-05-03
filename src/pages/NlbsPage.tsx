import { useQuery } from "@tanstack/react-query";
import { nlbApi } from "@/api/resources";
import { ResourceTable } from "@/components/ResourceTable";
import { StatusBadge } from "@/components/StatusBadge";
import { useFolderStore } from "@/lib/folder-store";
import { FolderRequiredEmpty } from "@/components/FolderRequiredEmpty";

export function NlbsPage() {
  const folder = useFolderStore((s) => s.folder);
  const { data, isLoading, error } = useQuery({
    queryKey: ["nlb.list", folder?.uid],
    queryFn: () =>
      nlbApi.list({
        selectors: folder ? [{ field: "folder_id", op: "EQ", values: [folder.uid] }] : [],
      }),
    refetchInterval: 3_000,
    enabled: !!folder,
  });
  if (!folder) return <FolderRequiredEmpty resource="Network Load Balancers" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Network Load Balancers</h1>
      </div>
      {error && <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">Ошибка: {(error as Error).message}</div>}
      <ResourceTable
        rows={data?.networkLoadBalancers ?? []}
        loading={isLoading}
        rowKey={(n) => n.metadata.uid}
        columns={[
          { header: "Name", cell: (n) => <span className="font-medium">{n.metadata.name}</span> },
          { header: "Status", cell: (n) => <StatusBadge state={n.status?.state} /> },
          { header: "External IPs", cell: (n) => (n.status?.externalIps ?? []).join(", ") || "—", className: "text-xs" },
          { header: "Listeners", cell: (n) => n.spec?.listeners?.length ?? 0 },
          { header: "TGs", cell: (n) => n.spec?.attachedTargetGroups?.length ?? 0 },
        ]}
      />
    </div>
  );
}
