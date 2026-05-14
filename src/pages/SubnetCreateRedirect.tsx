// SubnetCreateRedirect — перехватчик старого URL `/folders/.../networks/<n>/subnets/create`.
// Generic `ResourceCreatePage` (spec.fields-based form) — это «старая» форма
// подсети, доступная по этому URL по историческим причинам. Новая YC-style
// inline-форма живёт на Network detail (правая панель) и открывается через
// `overviewCreateOverride → setCreatingSubnet(true)`. Этот компонент
// перенаправляет на Network detail с query-флагом `?createSubnet=1`, чтобы
// NetworkDetailPage сразу развернул новую форму. Покрывает все entry-points
// «Создать подсеть» (RowActionsMenu в списке Networks, прямые ссылки, header).

import { Navigate, useParams } from "react-router-dom";

export function SubnetCreateRedirect() {
  const { folderId, networkId } = useParams();
  if (!folderId || !networkId) {
    // Защита от мисматча route — fallback на список сетей.
    return <Navigate to="/" replace />;
  }
  // Открываем модалку SubnetFormModal на Network detail.
  return (
    <Navigate
      to={`/folders/${folderId}/vpc/networks/${networkId}?modal=subnet-create&networkId=${networkId}`}
      replace
    />
  );
}
