// DetailOverviewActions — действия в ШАПКЕ detail-страницы (правый слот хедера,
// рядом с хлебными крошками — ResourceShell через useHeaderRight; KAC-242, раньше
// были в табе «Обзор»): Редактировать (кнопка) + ⋮-меню (Удалить) + ext-actions.
//
// По требованию: «Переместить» в Обзоре НЕ показываем; «Удалить» спрятано за
// kebab-меню (три точки) как actions. Гейтинг как в RowActionsMenu
// (ops.update / ops.delete & not-default-SG). После удаления — переход на список.

import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Dropdown } from "antd";
import type { MenuProps } from "antd";
import { EditOutlined, DeleteOutlined, MoreOutlined } from "@ant-design/icons";
import { DeleteDialog } from "@/components/DeleteDialog";
import {
  getByPath,
  resourceProjectPath,
  type ResourceSpec,
} from "@/lib/resource-registry";

interface Props {
  spec: ResourceSpec;
  data: Record<string, unknown>;
  projectId: string | null;
  detailBase: string;
  /** Доменные действия расширения (ext.headerActions) — рендерятся первыми. */
  extActions?: ReactNode;
}

export function DetailOverviewActions({ spec, data, projectId, detailBase, extActions }: Props) {
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const id = getByPath<string>(data, "id") ?? "";
  const name = getByPath<string>(data, "name") ?? id;
  const apiPath = `${spec.apiPath}/${id}`;
  const listPath = resourceProjectPath(spec.id, projectId) ?? `/${spec.route}`;

  const isDefaultSg =
    spec.id === "security-groups" && Boolean(getByPath<boolean>(data, "default_for_network"));
  const showDelete = spec.ops.delete && !isDefaultSg;

  const menuItems: MenuProps["items"] = showDelete
    ? [
        {
          key: "delete",
          icon: <DeleteOutlined />,
          label: "Удалить",
          danger: true,
          onClick: () => setDeleteOpen(true),
        },
      ]
    : [];

  return (
    <>
      {extActions}
      {spec.ops.update && (
        <Button icon={<EditOutlined />} onClick={() => navigate(`${detailBase}/edit`)}>
          Редактировать
        </Button>
      )}
      {menuItems.length > 0 && (
        <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
          <Button type="text" icon={<MoreOutlined />} aria-label="Действия" />
        </Dropdown>
      )}

      {showDelete && (
        <DeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          apiPath={apiPath}
          resourceId={spec.id}
          resourceLabel={spec.singular}
          name={name}
          projectId={projectId}
          onSuccess={() => navigate(listPath)}
        />
      )}
    </>
  );
}
