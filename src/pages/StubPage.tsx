import { useQuery } from "@tanstack/react-query";
import { post } from "@/api/client";
import { useFolderStore } from "@/lib/folder-store";
import { FolderRequiredEmpty } from "@/components/FolderRequiredEmpty";
import { JsonView } from "@/components/JsonView";

interface Props {
  title: string;
  description?: string;
  endpoint: string;
  resourceKey: string;
  scope: "global" | "folder";
}

// StubPage — generic JSON-list для ресурсов без отдельного типизированного UI.
// Полезно для security-groups, route-tables, addresses, snapshots — пока им
// не нужен богатый custom-render.
export function StubPage({ title, description, endpoint, resourceKey, scope }: Props) {
  const folder = useFolderStore((s) => s.folder);
  const { data, isLoading, error } = useQuery({
    queryKey: [endpoint, folder?.uid],
    queryFn: () =>
      post<unknown, Record<string, unknown>>(endpoint, {
        selectors:
          scope === "folder" && folder
            ? [{ field: "folder_id", op: "EQ", values: [folder.uid] }]
            : [],
      }),
    refetchInterval: 5_000,
    enabled: scope === "global" || !!folder,
  });

  if (scope === "folder" && !folder) return <FolderRequiredEmpty resource={title} />;

  const items = (data?.[resourceKey] as unknown[]) ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {error && <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">Ошибка: {(error as Error).message}</div>}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Ресурсов нет.
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{items.length} объектов (raw JSON)</p>
          <JsonView data={items} />
        </div>
      )}
    </div>
  );
}
