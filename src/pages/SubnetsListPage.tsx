// SubnetsListPage — обёртка generic ResourceListPage + mount SubnetFormModal,
// чтобы модалка subnet-create / subnet-edit могла открываться поверх list-page
// (через query-флаг `?modal=subnet-create`).

import { useParams } from "react-router-dom";
import { ResourceListPage } from "@/components/ResourceListPage";
import { SubnetFormModal } from "@/components/SubnetFormModal";
import { REGISTRY } from "@/lib/resource-registry";

export function SubnetsListPage() {
  const { folderId } = useParams();
  return (
    <>
      <ResourceListPage
        spec={REGISTRY.subnets}
        parentField="folder_id"
        parentParam="folderId"
      />
      {folderId && <SubnetFormModal folderId={folderId} />}
    </>
  );
}
