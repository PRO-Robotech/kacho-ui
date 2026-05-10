import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Dropdown } from "antd";
import type { MenuProps } from "antd";
import {
  MoreOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ArrowRightOutlined,
  DragOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { DeleteDialog } from "@/components/DeleteDialog";
import { MoveStubDialog } from "@/components/MoveStubDialog";
import { getByPath, type ResourceSpec } from "@/lib/resource-registry";

interface Props {
  spec: ResourceSpec;
  row: Record<string, unknown>;
  basePath: string;
  folderUid: string | null;
}

export function RowActionsMenu({ spec, row, basePath, folderUid }: Props) {
  const navigate = useNavigate();
  const params = useParams();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

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

  const isNetwork = spec.id === "networks";
  const currentFolderId = params.folderId ?? folderUid ?? null;

  const items: MenuProps["items"] = [
    {
      key: "open",
      icon: drillIsChild ? <ArrowRightOutlined /> : <EyeOutlined />,
      label: drillIsChild ? "Открыть" : "Просмотр",
      onClick: () => navigate(drillTarget),
    },
    isNetwork && currentFolderId
      ? {
          key: "create-subnet",
          icon: <PlusOutlined />,
          label: "Создать подсеть",
          onClick: () =>
            navigate(`/folders/${currentFolderId}/subnets/create?network_id=${id}`),
        }
      : null,
    spec.ops.update
      ? {
          key: "edit",
          icon: <EditOutlined />,
          label: "Редактировать",
          onClick: () => navigate(`${basePath}/${id}/edit`),
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

      {showDelete && (
        <DeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          apiPath={editPath}
          resourceId={spec.id}
          resourceLabel={spec.singular}
          name={name}
          folderUid={folderUid}
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
    </>
  );
}
