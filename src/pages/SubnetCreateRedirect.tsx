// SubnetCreateRedirect — перехватчик старого URL `/folders/.../networks/<n>/subnets/create`.
// KAC-102: редирект на новый URL pattern — `/networks/<n>/create-subnet`,
// который рендерит NetworkDetailPage с формой Subnet вместо «Общее».

import { Navigate, useParams } from "react-router-dom";

export function SubnetCreateRedirect() {
  const { folderId, networkId } = useParams();
  if (!folderId || !networkId) {
    // Защита от мисматча route — fallback на список сетей.
    return <Navigate to="/" replace />;
  }
  return (
    <Navigate
      to={`/folders/${folderId}/vpc/networks/${networkId}/create-subnet`}
      replace
    />
  );
}
