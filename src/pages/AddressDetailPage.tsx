// AddressDetailPage — обёртка над generic ResourceDetailPage,
// собирающая nested-breadcrumb когда Address открыт под subnet detail
// под network detail (URL
// `/folders/<f>/networks/<n>/subnets/<s>/addresses/<id>`).
//
// Folder-level Address (внешний IP) использует flat-маршрут и обычный breadcrumb.

import { useParams } from "react-router-dom";
import { ResourceDetailPage } from "@/components/ResourceDetailPage";
import { REGISTRY } from "@/lib/resource-registry";
import { useNestedBreadcrumb } from "@/lib/use-nested-breadcrumb";

export function AddressDetailPage() {
  const { folderId, networkId, subnetId } = useParams();
  const spec = REGISTRY["addresses"];

  // "IP-адреса" в breadcrumb ведёт на subnet-detail с активным tab=addresses.
  const addressesTabHref =
    folderId && subnetId
      ? networkId
        ? `/folders/${folderId}/vpc/networks/${networkId}/subnets/${subnetId}?tab=addresses`
        : `/folders/${folderId}/vpc/subnets/${subnetId}?tab=addresses`
      : undefined;

  const { segments: breadcrumbSegments, backHref: backHrefOverride } =
    useNestedBreadcrumb({
      folderId,
      networkId,
      subnetId,
      currentResourcePlural: "IP-адреса",
      currentResourceListHref: addressesTabHref,
    });

  return (
    <ResourceDetailPage
      spec={spec}
      backHrefOverride={backHrefOverride}
      breadcrumbSegments={breadcrumbSegments}
    />
  );
}
