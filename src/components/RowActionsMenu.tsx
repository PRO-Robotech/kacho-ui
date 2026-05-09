import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, Eye, Pencil, Trash2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResourceFormDialog } from "@/components/ResourceFormDialog";
import { DeleteConfirmStub } from "@/components/DeleteConfirmStub";
import { getByPath, type ResourceSpec } from "@/lib/resource-registry";

interface Props {
  spec: ResourceSpec;
  row: Record<string, unknown>;
  /** Базовый path списка (`/folders/X/networks`). Для leaf-ресурсов
   *  detail = `${basePath}/${id}`. Для иерархических (Org/Cloud/Folder) —
   *  spec.childRoute. */
  basePath: string;
  /** Folder uid из контекста (для invalidate query на Edit). */
  folderUid: string | null;
}

export function RowActionsMenu({ spec, row, basePath, folderUid }: Props) {
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const id = getByPath<string>(row, "id") ?? "";
  const name = getByPath<string>(row, "name") ?? id;
  const drillTarget = spec.childRoute ? spec.childRoute.replace(":id", id) : `${basePath}/${id}`;
  const drillIsChild = !!spec.childRoute;

  const editPath = `${spec.apiPath}/${id}`;

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Действия"
            className={cn(
              "h-7 w-7 inline-flex items-center justify-center rounded-md",
              "text-muted-foreground hover:bg-accent hover:text-foreground",
              "data-[state=open]:bg-accent",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-30 min-w-[200px] rounded-md border border-border bg-card shadow-md p-1"
          >
            <DropdownMenu.Item
              onSelect={() => navigate(drillTarget)}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer outline-none data-[highlighted]:bg-accent"
            >
              {drillIsChild ? <ArrowRight className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {drillIsChild ? "Открыть" : "Просмотр"}
            </DropdownMenu.Item>

            {spec.ops.update && (
              <DropdownMenu.Item
                onSelect={(e) => {
                  e.preventDefault();
                  setEditOpen(true);
                }}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer outline-none data-[highlighted]:bg-accent"
              >
                <Pencil className="h-4 w-4" />
                Редактировать
              </DropdownMenu.Item>
            )}

            {spec.ops.delete && (
              <>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item
                  onSelect={(e) => {
                    e.preventDefault();
                    setDeleteOpen(true);
                  }}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer outline-none text-rose-400 data-[highlighted]:bg-rose-950/40 data-[highlighted]:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                  Удалить
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {spec.ops.update && (
        <ResourceFormDialog
          mode="edit"
          title={`Edit ${spec.singular}`}
          description="Изменяет ресурс; status пишется только сервером."
          apiPath={editPath}
          resourceId={spec.id}
          template={row}
          fields={spec.fields}
          folderUid={folderUid}
          sanitize={spec.sanitize}
          controlledOpen={{ open: editOpen, setOpen: setEditOpen }}
        />
      )}

      {spec.ops.delete && (
        <DeleteConfirmStub
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          resourceLabel={spec.singular}
          name={name}
          apiPath={editPath}
        />
      )}
    </>
  );
}
