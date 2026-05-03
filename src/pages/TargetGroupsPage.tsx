import { useQuery } from "@tanstack/react-query";
import { tgApi } from "@/api/resources";
import { ResourceTable } from "@/components/ResourceTable";
import { StatusBadge } from "@/components/StatusBadge";
import { useFolderStore } from "@/lib/folder-store";
import { FolderRequiredEmpty } from "@/components/FolderRequiredEmpty";

export function TargetGroupsPage() {
  const folder = useFolderStore((s) => s.folder);
  const { data, isLoading, error } = useQuery({
    queryKey: ["tg.list", folder?.uid],
    queryFn: () =>
      tgApi.list({
        selectors: folder ? [{ field: "folder_id", op: "EQ", values: [folder.uid] }] : [],
      }),
    refetchInterval: 5_000,
    enabled: !!folder,
  });
  if (!folder) return <FolderRequiredEmpty resource="Target Groups" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Target Groups</h1>
      </div>
      {error && <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">Ошибка: {(error as Error).message}</div>}
      <ResourceTable
        rows={data?.targetGroups ?? []}
        loading={isLoading}
        rowKey={(t) => t.metadata.uid}
        columns={[
          { header: "Name", cell: (t) => <span className="font-medium">{t.metadata.name}</span> },
          { header: "Status", cell: (t) => <StatusBadge state={t.status?.state} /> },
          { header: "Region", cell: (t) => t.spec?.regionId ?? "—" },
          { header: "Targets", cell: (t) => t.spec?.targets?.length ?? 0 },
        ]}
      />
    </div>
  );
}
