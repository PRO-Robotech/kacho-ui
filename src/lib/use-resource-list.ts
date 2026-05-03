// Polling hook для получения списка ресурсов через REST GET.
// Заменяет useResourceWatch (Watch/WebSocket убран в sub-phase 1.0).
// spec.apiPath содержит полный path: /resource-manager/v1/clouds, /vpc/v1/networks и т.д.

import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { ResourceSpec } from "./resource-registry";

interface FolderRef {
  uid: string;
}

/**
 * useResourceList — поллит GET <spec.apiPath>?folder_id=<uid> каждые 3 сек.
 *
 * Для global-scoped ресурсов folder не передаётся.
 * Для folder-scoped ресурсов — enabled только когда folder выбран.
 */
export function useResourceList<T = Record<string, unknown>>(
  spec: ResourceSpec,
  folder: FolderRef | null,
) {
  const folderRequired = spec.scope === "folder";
  const folderUid = folder?.uid ?? null;

  return useQuery({
    queryKey: [spec.id, "list", folderUid],
    queryFn: () => {
      const q: Record<string, string> = {};
      if (folderUid) q["folder_id"] = folderUid;
      return api.list<Record<string, T[]>>(spec.apiPath, q);
    },
    refetchInterval: 3_000,
    enabled: folderRequired ? !!folderUid : true,
    staleTime: 0,
  });
}
