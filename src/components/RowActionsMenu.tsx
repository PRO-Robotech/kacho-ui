import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  ArrowRight,
  Move,
  Globe2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ResourceFormDialog } from "@/components/ResourceFormDialog";
import { DeleteConfirmStub } from "@/components/DeleteConfirmStub";
import { MoveStubDialog } from "@/components/MoveStubDialog";
import { SubnetRelocateDialog } from "@/components/SubnetRelocateDialog";
import { getByPath, type ResourceSpec } from "@/lib/resource-registry";

interface Props {
  spec: ResourceSpec;
  row: Record<string, unknown>;
  basePath: string;
  folderUid: string | null;
}

export function RowActionsMenu({ spec, row, basePath, folderUid }: Props) {
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [relocateOpen, setRelocateOpen] = useState(false);

  const id = getByPath<string>(row, "id") ?? "";
  const name = getByPath<string>(row, "name") ?? id;
  const drillTarget = spec.childRoute ? spec.childRoute.replace(":id", id) : `${basePath}/${id}`;
  const drillIsChild = !!spec.childRoute;
  const editPath = `${spec.apiPath}/${id}`;

  // Per-resource overrides:
  // - SG default_for_network=true → не показывать Удалить (FK RESTRICT,
  //   verbatim YC: default SG нельзя удалить отдельно от Network).
  const isDefaultSg =
    spec.id === "security-groups" &&
    Boolean(getByPath<boolean>(row, "default_for_network"));
  const showDelete = spec.ops.delete && !isDefaultSg;

  // Move-action — поддержка Move на бэкенде есть для Network/Subnet/
  // RouteTable/Address/SecurityGroup/Gateway. Org/Cloud/Folder — нет
  // (они сами и есть hierarchy nodes), и Region/Zone/AddressPool — глобальные.
  const moveCapable = ![
    "organizations",
    "clouds",
    "folders",
    "regions",
    "zones",
    "address-pools",
  ].includes(spec.id);

  // Subnet «Перенести в другую зону» — отдельный action с реальным
  // POST /vpc/v1/subnets/{id}:relocate (см. SubnetRelocateDialog).
  const isSubnet = spec.id === "subnets";
  const currentZone = getByPath<string>(row, "zone_id") ?? "";

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
            className="z-30 min-w-[220px] rounded-md border border-border bg-card shadow-md p-1"
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

            {moveCapable && (
              <DropdownMenu.Item
                onSelect={(e) => {
                  e.preventDefault();
                  setMoveOpen(true);
                }}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer outline-none data-[highlighted]:bg-accent"
              >
                <Move className="h-4 w-4" />
                Переместить
              </DropdownMenu.Item>
            )}

            {isSubnet && (
              <DropdownMenu.Item
                onSelect={(e) => {
                  e.preventDefault();
                  setRelocateOpen(true);
                }}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer outline-none data-[highlighted]:bg-accent"
              >
                <Globe2 className="h-4 w-4" />
                Перенести в другую зону
              </DropdownMenu.Item>
            )}

            {showDelete && (
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

      {showDelete && (
        <DeleteConfirmStub
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          resourceLabel={spec.singular}
          name={name}
          apiPath={editPath}
        />
      )}

      {moveCapable && (
        <MoveStubDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          resourceLabel={spec.singular}
          name={name}
          apiPath={editPath}
        />
      )}

      {isSubnet && (
        <SubnetRelocateDialog
          open={relocateOpen}
          onOpenChange={setRelocateOpen}
          subnetId={id}
          subnetName={name}
          currentZone={currentZone}
          folderUid={folderUid}
        />
      )}
    </>
  );
}
