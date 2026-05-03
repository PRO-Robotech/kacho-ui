import { useQuery } from "@tanstack/react-query";
import { imagesApi } from "@/api/resources";
import { ResourceTable } from "@/components/ResourceTable";

export function ImagesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["images.list"],
    queryFn: () => imagesApi.list({}),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Images</h1>
        <p className="text-sm text-muted-foreground">
          Read-only catalog. Доступен глобально, не привязан к folder.
        </p>
      </div>
      {error && <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">Ошибка: {(error as Error).message}</div>}
      <ResourceTable
        rows={data?.images ?? []}
        loading={isLoading}
        rowKey={(i) => i.metadata.uid}
        columns={[
          { header: "Name", cell: (i) => <span className="font-medium">{i.metadata.name}</span> },
          { header: "Family", cell: (i) => i.spec?.family ?? "—" },
          { header: "OS", cell: (i) => i.spec?.osType ?? "—" },
          { header: "Description", cell: (i) => <span className="text-xs text-muted-foreground">{i.spec?.description ?? "—"}</span> },
        ]}
      />
    </div>
  );
}
