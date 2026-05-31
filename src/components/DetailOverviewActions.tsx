// DetailOverviewActions — блок действий в шапке таба «Обзор» detail-страницы
// (ResourceShell): Редактировать / Переместить / Удалить + ext-actions.
//
// Зеркалит RowActionsMenu (kebab в таблицах), но как кнопки в шапке Обзора.
// Каждое действие гейтится по spec.ops (update/move/delete). После удаления —
// переход на список ресурса.

import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "antd";
import { EditOutlined, DragOutlined } from "@ant-design/icons";
import { DeleteButton } from "@/components/DeleteButton";
import { MoveResourceDialog } from "@/components/MoveResourceDialog";
import { resourceProjectPath, type ResourceSpec } from "@/lib/resource-registry";
import { getByPath } from "@/lib/path";

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

  const id = getByPath<string>(data, "id") ?? "";
  const name = getByPath<string>(data, "name") || id;
  const listPath = resourceProjectPath(spec.id, projectId) ?? `/${spec.route}`;

  return (
    <>
      {extActions}
      {spec.ops.update && (
        <Button icon={<EditOutlined />} onClick={() => navigate(`${detailBase}/edit`)}>
          Редактировать
        </Button>
      )}
      {spec.ops.move && (
        <Button icon={<DragOutlined />} onClick={() => setMoveOpen(true)}>
          Переместить
        </Button>
      )}
      {spec.ops.delete && (
        <DeleteButton
          resourceId={spec.id}
          apiPath={spec.apiPath}
          id={id}
          name={name}
          projectId={projectId}
          onDeleted={() => navigate(listPath)}
        />
      )}
      {spec.ops.move && (
        <MoveResourceDialog
          spec={spec}
          open={moveOpen}
          onClose={() => setMoveOpen(false)}
          resourceId={id}
          currentParentId={projectId}
          name={name}
          row={data}
        />
      )}
    </>
  );
}
