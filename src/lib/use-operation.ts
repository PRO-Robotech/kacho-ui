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
 * Вызывать после done=true. Также инвалидирует breadcrumb-pill queries и
 * dashboard-queries — чтобы новые org/cloud/folder/network/etc. сразу
 * появлялись в pills и в счётчиках без ручного refresh.
 *
 * useResourceList queryKey = [spec.id, "list", filterField, filterValue].
 * invalidateQueries с queryKey работает по prefix match — ["networks", "list"]
 * матчит все ["networks", "list", *, *] независимо от parent-фильтра.
 */
export function useInvalidateResourceList() {
  const qc = useQueryClient();
  return (resourceId: string, _folderUid?: string | null) => {
    void _folderUid;
    // Все list-варианты этого ресурса (любой parent-фильтр).
    qc.invalidateQueries({ queryKey: [resourceId, "list"] });
    // Detail этого ресурса (если открыт).
    qc.invalidateQueries({ queryKey: [resourceId, "detail"] });
    // RefNameLink lookup-кэш.
    qc.invalidateQueries({ queryKey: ["ref-name", resourceId] });
    // Breadcrumb pills (Org/Cloud/Folder dropdowns).
    qc.invalidateQueries({ queryKey: ["bc.orgs"] });
    qc.invalidateQueries({ queryKey: ["bc.clouds"] });
    qc.invalidateQueries({ queryKey: ["bc.folders"] });
    // Dashboard counts.
    qc.invalidateQueries({ queryKey: ["dash"] });
  };
}
