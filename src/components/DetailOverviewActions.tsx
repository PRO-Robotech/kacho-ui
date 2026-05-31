// DetailOverviewActions — действия в шапке таба «Обзор» detail-страницы
// (ResourceShell): Редактировать / Переместить / Удалить + ext-actions.
//
// Зеркалит RowActionsMenu (kebab в таблицах), но как кнопки в шапке Обзора,
// переиспользуя те же контролируемые диалоги (DeleteDialog/MoveStubDialog) и
// те же правила гейтинга (ops.update, moveCapable allowlist, ops.delete +
// not-default-SG). После удаления — переход на список ресурса.

import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "antd";
import { EditOutlined, DragOutlined, DeleteOutlined } from "@ant-design/icons";
import { DeleteDialog } from "@/components/DeleteDialog";
import { MoveStubDialog } from "@/components/MoveStubDialog";
import {
  getByPath,
  resourceProjectPath,
  type ResourceSpec,
} from "@/lib/resource-registry";

// Ресурсы, для которых Move неприменим (зеркало RowActionsMenu.moveCapable).
const MOVE_INCAPABLE = ["accounts", "projects", "regions", "zones", "address-pools"];

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
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const id = getByPath<string>(data, "id") ?? "";
  const name = getByPath<string>(data, "name") ?? id;
  const apiPath = `${spec.apiPath}/${id}`;
  const listPath = resourceProjectPath(spec.id, projectId) ?? `/${spec.route}`;

  const moveCapable = !MOVE_INCAPABLE.includes(spec.id);
  const isDefaultSg =
    spec.id === "security-groups" && Boolean(getByPath<boolean>(data, "default_for_network"));
  const showDelete = spec.ops.delete && !isDefaultSg;

  return (
    <>
      {extActions}
      {spec.ops.update && (
        <Button icon={<EditOutlined />} onClick={() => navigate(`${detailBase}/edit`)}>
          Редактировать
        </Button>
      )}
      {moveCapable && (
        <Button icon={<DragOutlined />} onClick={() => setMoveOpen(true)}>
          Переместить
        </Button>
      )}
      {showDelete && (
        <Button danger icon={<DeleteOutlined />} onClick={() => setDeleteOpen(true)}>
          Удалить
        </Button>
      )}

      {moveCapable && (
        <MoveStubDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          resourceLabel={spec.singular}
          name={name}
          apiPath={apiPath}
        />
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
