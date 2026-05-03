import { useQuery } from "@tanstack/react-query";
import { foldersApi } from "@/api/resources";
import { ResourceTable } from "@/components/ResourceTable";
import { folderStoreApi, useFolderStore } from "@/lib/folder-store";
import { Button } from "@/components/ui/button";

export function FoldersPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["folders.list"],
    queryFn: () => foldersApi.list({}),
    refetchInterval: 10_000,
  });
  const current = useFolderStore((s) => s.folder);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Folders</h1>
        <p className="text-sm text-muted-foreground">
          Folder = isolation-scope для всех domain-ресурсов (Network, Instance, NLB).
          Выберите folder здесь — пункты sidebar-а активируются.
        </p>
      </div>
      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">
          Ошибка: {(error as Error).message}
        </div>
      )}
      <ResourceTable
        rows={data?.folders ?? []}
        loading={isLoading}
        rowKey={(f) => f.metadata.uid}
        columns={[
          { header: "Name", cell: (f) => <span className="font-medium">{f.metadata.name}</span> },
          { header: "Display Name", cell: (f) => f.spec?.displayName ?? "—" },
          {
            header: "Cloud",
            cell: (f) => (
              <code className="text-xs text-muted-foreground">
                {(f.metadata.cloudId ?? "—").slice(0, 8)}…
              </code>
            ),
          },
          {
            header: "Selected",
            cell: (f) =>
              current?.uid === f.metadata.uid ? (
                <span className="text-xs font-medium text-emerald-600">current</span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    folderStoreApi.set({
                      uid: f.metadata.uid,
                      name: f.metadata.name,
                      cloudId: f.metadata.cloudId,
                      organizationId: f.metadata.organizationId,
                    })
                  }
                >
                  Select
                </Button>
              ),
          },
        ]}
      />
    </div>
  );
}
