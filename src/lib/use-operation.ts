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
 * dashboard-queries — чтобы новые account/project/network/etc. сразу
 * появлялись в pills и в счётчиках без ручного refresh.
 *
 * useResourceList queryKey = [spec.id, "list", filterField, filterValue].
 * invalidateQueries с queryKey работает по prefix match — ["networks", "list"]
 * матчит все ["networks", "list", *, *] независимо от parent-фильтра.
 */
export function useInvalidateResourceList() {
  const qc = useQueryClient();
  return (resourceId: string, _projectId?: string | null) => {
    void _projectId;
    // Все list-варианты этого ресурса (любой parent-фильтр).
    qc.invalidateQueries({ queryKey: [resourceId, "list"] });
    // Detail этого ресурса (если открыт).
    qc.invalidateQueries({ queryKey: [resourceId, "detail"] });
    // KAC-239 (#3): RefNameLink резолвит имя по списку владельца. Инвалидируем
    // ВСЕ ref-name кэши (не только этого ресурса) — чтобы имя только что
    // созданного ресурса, включая порождённый side-effect'ом default-SG,
    // показывалось сразу, а не его id (рендер опережал резолв имени).
    qc.invalidateQueries({ queryKey: ["ref-name"] });
    // KAC-239 (#2): Network.Create side-effect'ом создаёт default Security Group
    // → обновить и список SG, иначе он не виден до собственного поллинга списка.
    if (resourceId === "networks") {
      qc.invalidateQueries({ queryKey: ["security-groups", "list"] });
      qc.invalidateQueries({ queryKey: ["security-groups", "detail"] });
    }
    // Breadcrumb pills (Account/Project dropdowns).
    qc.invalidateQueries({ queryKey: ["accounts-crumb"] });
    qc.invalidateQueries({ queryKey: ["projects-crumb"] });
    // Dashboard counts.
    qc.invalidateQueries({ queryKey: ["dash"] });
  };
}
