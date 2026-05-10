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
// Hydration: если URL содержит folderId/cloudId/orgId но context из localStorage
// пустой (например — открыли прямую ссылку в инкогнито), мы догружаем parent'ов
// через GET /<resource>/{id} цепочкой, чтобы pills заполнились name'ами и парами.
//
// При смене context (через крошки) — навигация делается прямо в BreadcrumbSelector
// через `navigate()`; context-store обновляется сам через path.

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { contextApi, useContext } from "@/lib/context-store";

interface FolderApi {
  id: string;
  name: string;
  cloud_id: string;
}
interface CloudApi {
  id: string;
  name: string;
  organization_id: string;
}
interface OrgApi {
  id: string;
  name: string;
}

export function ContextUrlSync() {
  const { pathname } = useLocation();
  const ctx = useContext((s) => s);

  // Hydration: GET для parent ресурсов когда у нас в context есть id но
  // нет name/parent. Срабатывает на первой загрузке прямой ссылки.
  const folderHydrate = useQuery({
    queryKey: ["hydrate-folder", ctx.folder?.id],
    queryFn: () =>
      api.get<FolderApi>(`/resource-manager/v1/folders/${ctx.folder!.id}`),
    enabled: !!ctx.folder?.id && (!ctx.folder.name || !ctx.folder.cloudId),
    staleTime: 60_000,
  });
  const cloudHydrate = useQuery({
    queryKey: ["hydrate-cloud", ctx.cloud?.id],
    queryFn: () =>
      api.get<CloudApi>(`/resource-manager/v1/clouds/${ctx.cloud!.id}`),
    enabled: !!ctx.cloud?.id && (!ctx.cloud.name || !ctx.cloud.organizationId),
    staleTime: 60_000,
  });
  const orgHydrate = useQuery({
    queryKey: ["hydrate-org", ctx.org?.id],
    queryFn: () =>
      api.get<OrgApi>(`/organization-manager/v1/organizations/${ctx.org!.id}`),
    enabled: !!ctx.org?.id && !ctx.org.name,
    staleTime: 60_000,
  });

  // Применяем результаты hydration в context (через hydrate-patch — НЕ
  // через setFolder/setCloud, т.к. те сбрасывают потомков).
  useEffect(() => {
    if (folderHydrate.data && ctx.folder?.id === folderHydrate.data.id) {
      const f = folderHydrate.data;
      const needName = !ctx.folder.name && !!f.name;
      const needCloud = !ctx.folder.cloudId && !!f.cloud_id;
      if (needName || needCloud) {
        contextApi.hydrate({
          folder: { name: f.name, cloudId: f.cloud_id },
          // Поднимаем cloud-id в state.cloud чтобы cloudHydrate сработал.
          cloud: needCloud
            ? { id: f.cloud_id, name: "", organizationId: "" }
            : undefined,
        });
      }
    }
  }, [folderHydrate.data, ctx.folder]);

  useEffect(() => {
    if (cloudHydrate.data && ctx.cloud?.id === cloudHydrate.data.id) {
      const c = cloudHydrate.data;
      const needName = !ctx.cloud.name && !!c.name;
      const needOrg = !ctx.cloud.organizationId && !!c.organization_id;
      if (needName || needOrg) {
        contextApi.hydrate({
          cloud: { name: c.name, organizationId: c.organization_id },
          // hydrate умеет создавать org если он null. Не сбрасывает cloud/folder.
          org: needOrg && (!ctx.org || ctx.org.id !== c.organization_id)
            ? { id: c.organization_id, name: ctx.org?.name ?? "" }
            : undefined,
        });
      }
    }
  }, [cloudHydrate.data, ctx.cloud, ctx.org]);

  useEffect(() => {
    if (orgHydrate.data && ctx.org?.id === orgHydrate.data.id) {
      const o = orgHydrate.data;
      if (!ctx.org.name && o.name) {
        contextApi.hydrate({ org: { name: o.name } });
      }
    }
  }, [orgHydrate.data, ctx.org]);

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
