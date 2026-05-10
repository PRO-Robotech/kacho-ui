// Hook для polling Operation до завершения.
// После Create/Update/Delete/action backend возвращает {operation: Operation}.
// Этот hook поллит GET /operations/{id} каждые 1 сек до done=true.
// URL verbatim из proto: operation/operation_service.proto → GET /operations/{operation_id}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { Operation } from "@/api/types";

/**
 * useOperation — поллит /operations/{opId} каждые 1 сек.
 * Останавливается когда done=true.
 *
 * Передайте null чтобы деактивировать hook.
 */
export function useOperation(opId: string | null) {
  return useQuery({
    queryKey: ["operation", opId],
    queryFn: () => api.get<Operation>(`/operations/${opId}`),
    refetchInterval: (query) =>
      query.state.data?.done ? false : 1_000,
    enabled: !!opId,
    staleTime: 0,
  });
}

/**
 * invalidateResourceList — хелпер: инвалидирует кэш list-query после завершения операции.
 * Вызывать после done=true. Также инвалидирует tree-queries (HierarchyTree) и
 * dashboard-queries (DashboardPage) — чтобы новые org/cloud/folder/network/etc.
 * сразу появлялись слева и в счётчиках без ручного refresh.
 */
export function useInvalidateResourceList() {
  const qc = useQueryClient();
  return (resourceId: string, folderUid?: string | null) => {
    qc.invalidateQueries({ queryKey: [resourceId, "list", folderUid ?? null] });
    // Tree всегда пересобираем — изменение Org/Cloud/Folder влияет на дерево.
    qc.invalidateQueries({ queryKey: ["tree"] });
    // Dashboard counts тоже зависят от ресурсов.
    qc.invalidateQueries({ queryKey: ["dash"] });
  };
}
