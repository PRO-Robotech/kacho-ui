import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, FolderOpen } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { foldersApi } from "@/api/resources";
import { folderStoreApi, useFolderStore } from "@/lib/folder-store";
import { cn } from "@/lib/utils";
import type { Folder } from "@/api/types";

export function FolderSelector() {
  const folder = useFolderStore((s) => s.folder);

  const { data, isLoading } = useQuery({
    queryKey: ["folders.list"],
    queryFn: () => foldersApi.list(),
    refetchInterval: 30_000,
  });

  const folders: Folder[] = data?.folders ?? [];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium min-w-[260px] justify-between">
          <span className="flex items-center gap-2 truncate">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            {folder ? (
              <span className="truncate">{folder.name}</span>
            ) : (
              <span className="text-muted-foreground">Выбрать folder…</span>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-30 min-w-[260px] rounded-md border border-border bg-popover bg-background shadow-md p-1"
        >
          {isLoading && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Загрузка…</div>
          )}
          {!isLoading && folders.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Нет folder-ов</div>
          )}
          {folders.map((f) => {
            const selected = folder?.uid === f.id;
            return (
              <DropdownMenu.Item
                key={f.id}
                onSelect={() =>
                  folderStoreApi.set({
                    uid: f.id,
                    name: f.name,
                    cloudId: f.cloud_id,
                    organizationId: undefined,
                  })
                }
                className={cn(
                  "flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer outline-none",
                  "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
                )}
              >
                <Check className={cn("h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                <span className="truncate flex-1">{f.name}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {f.id.slice(0, 8)}
                </span>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
