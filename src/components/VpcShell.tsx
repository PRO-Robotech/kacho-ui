// VpcShell — обёртка для list / detail VPC-страниц, добавляющая mount
// <ResourceFormModal/> для всех ресурсов (open через ?modal=<spec>-create
// или ?modal=<spec>-edit&id=<uid>).
//
// Один компонент per route — заменяет прямой mount ResourceListPage /
// ResourceDetailPage в роутинге, чтобы у каждой VPC-страницы автоматически
// был mount-point модалки.

import { useParams } from "react-router-dom";
import { ResourceListPage } from "@/components/ResourceListPage";
import { ResourceDetailPage } from "@/components/ResourceDetailPage";
import { ResourceFormModal } from "@/components/ResourceFormModal";
import type { ResourceSpec } from "@/lib/resource-registry";

interface ListProps {
  spec: ResourceSpec;
  parentField?: string;
  parentParam?: string;
}

export function VpcListShell({ spec, parentField, parentParam }: ListProps) {
  const { folderId } = useParams();
  return (
    <>
      <ResourceListPage spec={spec} parentField={parentField} parentParam={parentParam} />
      {folderId && <ResourceFormModal folderId={folderId} />}
    </>
  );
}

interface DetailProps {
  spec: ResourceSpec;
  paramKey?: string;
}

export function VpcDetailShell({ spec, paramKey }: DetailProps) {
  const { folderId } = useParams();
  return (
    <>
      <ResourceDetailPage spec={spec} paramKey={paramKey} />
      {folderId && <ResourceFormModal folderId={folderId} />}
    </>
  );
}
