// SubnetCreatePage — legacy /vpc/subnets/create. После перехода на модалки
// (KAC-69) этот route — редирект-обёртка: открывает модалку
// SubnetFormModal на /vpc/subnets (list-page) через query-флаг.

import { Navigate, useParams, useSearchParams } from "react-router-dom";

export function SubnetCreatePage() {
  const { folderId } = useParams();
  const [searchParams] = useSearchParams();
  const networkId = searchParams.get("networkId");

  if (!folderId) return <Navigate to="/" replace />;

  const params = new URLSearchParams();
  params.set("modal", "subnet-create");
  if (networkId) params.set("networkId", networkId);

  // Если networkId известен — открываем модалку на Network detail (контекст
  // ближе к user'у); иначе — на /vpc/subnets list.
  const base = networkId
    ? `/folders/${folderId}/vpc/networks/${networkId}`
    : `/folders/${folderId}/vpc/subnets`;

  return <Navigate to={`${base}?${params.toString()}`} replace />;
}
