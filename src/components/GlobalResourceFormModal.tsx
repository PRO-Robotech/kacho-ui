// GlobalResourceFormModal — глобальный mount-point для Create/Edit модалок.
// Mountится один раз в Layout, читает URL (любого вида:
// /folders/.../vpc/..., /folders/.../compute/..., /organizations/...,
// /clouds/..., /system/...) и определяет «активный контейнер» (folder /
// cloud / organization / system) — пробрасывает его как `containerId`
// в ResourceFormModal.
//
// Это позволяет любой странице ставить `?modal=<spec.id>-create` и не
// заботиться о mount'е — модалка работает автоматически.

import { useLocation } from "react-router-dom";
import { ResourceFormModal } from "@/components/ResourceFormModal";

export function GlobalResourceFormModal() {
  const location = useLocation();

  // Парсим из pathname id активного контейнера.
  // /folders/<id>/...        → folderId
  // /clouds/<id>/...         → cloudId  (Cloud-scoped resources)
  // /organizations/<id>/...  → orgId    (Org-scoped resources)
  // /system/...              → "system" (admin cluster-scoped ресурсы,
  //                            не требуют конкретного container id).
  const containerId = (() => {
    const folder = location.pathname.match(/^\/folders\/([^/]+)/);
    if (folder) return folder[1];
    const cloud = location.pathname.match(/^\/clouds\/([^/]+)/);
    if (cloud) return cloud[1];
    const org = location.pathname.match(/^\/organizations\/([^/]+)/);
    if (org) return org[1];
    if (location.pathname.startsWith("/system/")) return "system";
    return null;
  })();

  if (!containerId) return null;
  return <ResourceFormModal folderId={containerId} />;
}
