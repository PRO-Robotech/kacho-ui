// ContextUrlSync — синхронизирует context-store с path-based URL.
// Source of truth: path. URL-формат:
//   /organizations                                    — корень: only org-list
//   /organizations/:orgId                              — org selected
//   /organizations/:orgId/clouds                       — org selected, clouds list
//   /clouds/:cloudId                                   — cloud selected
//   /clouds/:cloudId/folders                           — folders list
//   /folders/:folderId                                 — folder dashboard
//   /folders/:folderId/networks (subnets, ...)         — folder selected, vpc list
//   /folders/:folderId/networks/:uid                   — detail
//
// При смене URL → парсинг → обновление context-store. Имена ресурсов в context
// заполняются позже когда BreadcrumbSelector загрузит соответствующий list.
//
// При смене context (через крошки) — навигация делается прямо в BreadcrumbSelector
// через `navigate()`; context-store обновляется сам через path.

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { contextApi } from "@/lib/context-store";

export function ContextUrlSync() {
  const { pathname } = useLocation();

  useEffect(() => {
    const ids = parsePathIds(pathname);
    const cur = contextApi.get();
    const curOrg = cur.org?.id ?? null;
    const curCloud = cur.cloud?.id ?? null;
    const curFolder = cur.folder?.id ?? null;

    // Принцип: URL с explicit-ID меняет context; URL без ID — НЕ сбрасывает
    // существующий context (потому что URL `/folders/X/networks` не содержит
    // org/cloud, но они должны оставаться выбранными в крошках).
    //
    // Исключение: если pathname возвращается на root `/` или `/organizations`
    // — там пользователь явно "вышел из иерархии", сбрасываем всё ниже.

    if (ids.orgId && ids.orgId !== curOrg) {
      contextApi.setOrg({ id: ids.orgId, name: cur.org?.name ?? "" });
    }
    if (ids.cloudId && ids.cloudId !== curCloud) {
      contextApi.setCloud({
        id: ids.cloudId,
        name: cur.cloud?.name ?? "",
        // organizationId: предпочесть existing context, потом URL, потом empty.
        organizationId: cur.org?.id ?? ids.orgId ?? "",
      });
    }
    if (ids.folderId && ids.folderId !== curFolder) {
      contextApi.setFolder({
        id: ids.folderId,
        uid: ids.folderId,
        name: cur.folder?.name ?? "",
        cloudId: cur.cloud?.id ?? ids.cloudId ?? "",
        organizationId: cur.org?.id ?? ids.orgId ?? "",
      });
    }

    // Explicit reset, когда пользователь вышел в корень
    if (pathname === "/") {
      if (curOrg || curCloud || curFolder) {
        contextApi.setOrg(null);
      }
    }
  }, [pathname]);

  return null;
}

function parsePathIds(pathname: string): {
  orgId: string | null;
  cloudId: string | null;
  folderId: string | null;
} {
  const orgMatch = pathname.match(/^\/organizations\/([^/]+)/);
  const cloudMatch = pathname.match(/^\/clouds\/([^/]+)/);
  const folderMatch = pathname.match(/^\/folders\/([^/]+)/);
  return {
    orgId: orgMatch?.[1] ?? null,
    cloudId: cloudMatch?.[1] ?? null,
    folderId: folderMatch?.[1] ?? null,
  };
}
