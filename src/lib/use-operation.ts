// Hook для polling Operation до завершения.
// После Create/Update/Delete/action backend возвращает {operation: Operation}.
// Этот hook поллит GET /v1/operations/{id} каждые 1 сек до done=true.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { Operation } from "@/api/types";

/**
 * useOperation — поллит /v1/operations/{opId} каждые 1 сек.
 * Останавливается когда done=true.
 *
 * Передайте null чтобы деактивировать hook.
 */
export function useOperation(opId: string | null) {
  return useQuery({
    queryKey: ["operation", opId],
    queryFn: () => api.get<Operation>(`/v1/operations/${opId}`),
    refetchInterval: (query) =>
      query.state.data?.done ? false : 1_000,
    enabled: !!opId,
    staleTime: 0,
  });
}

/**
 * invalidateResourceList — хелпер: инвалидирует кэш list-query после завершения операции.
 * Вызывать после done=true.
 */
export function useInvalidateResourceList() {
  const qc = useQueryClient();
  return (resourceId: string, folderUid?: string | null) => {
    qc.invalidateQueries({ queryKey: [resourceId, "list", folderUid ?? null] });
  };
}
