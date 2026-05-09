import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Dropdown } from "antd";
import type { MenuProps } from "antd";
import {
  MoreOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ArrowRightOutlined,
  DragOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
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

  const isDefaultSg =
    spec.id === "security-groups" &&
    Boolean(getByPath<boolean>(row, "default_for_network"));
  const showDelete = spec.ops.delete && !isDefaultSg;

  const moveCapable = ![
    "organizations",
    "clouds",
    "folders",
    "regions",
    "zones",
    "address-pools",
  ].includes(spec.id);

  const isSubnet = spec.id === "subnets";
  const currentZone = getByPath<string>(row, "zone_id") ?? "";

  const items: MenuProps["items"] = [
    {
      key: "open",
      icon: drillIsChild ? <ArrowRightOutlined /> : <EyeOutlined />,
      label: drillIsChild ? "Открыть" : "Просмотр",
      onClick: () => navigate(drillTarget),
    },
    spec.ops.update
      ? {
          key: "edit",
          icon: <EditOutlined />,
          label: "Редактировать",
          onClick: () => setEditOpen(true),
        }
      : null,
    moveCapable
      ? {
          key: "move",
          icon: <DragOutlined />,
          label: "Переместить",
          onClick: () => setMoveOpen(true),
        }
      : null,
    isSubnet
      ? {
          key: "relocate",
          icon: <GlobalOutlined />,
          label: "Перенести в другую зону",
          onClick: () => setRelocateOpen(true),
        }
      : null,
    showDelete ? { type: "divider" as const } : null,
    showDelete
      ? {
          key: "delete",
          icon: <DeleteOutlined />,
          label: "Удалить",
          danger: true,
          onClick: () => setDeleteOpen(true),
        }
      : null,
  ].filter(Boolean) as MenuProps["items"];

  return (
    <>
      <Dropdown menu={{ items }} trigger={["click"]} placement="bottomRight">
        <Button
          type="text"
          size="small"
          icon={<MoreOutlined />}
          onClick={(e) => e.stopPropagation()}
          aria-label="Действия"
        />
      </Dropdown>

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
