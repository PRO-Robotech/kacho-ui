// RefNameLink — name+ссылка на detail для любого folder-scoped ресурса по id.
// Заменяет SgNameById. Берёт spec из registry, делает один folder-scoped list-query
// (дедуплицируется TanStack по (specId, folderId)), находит row.name по id.
// При клике stopPropagation чтобы не триггерить row-click таблицы-родителя.

import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Tag } from "antd";
import { api } from "@/api/client";
import { useFolderStore } from "@/lib/folder-store";
import { REGISTRY } from "@/lib/resource-registry";

interface Props {
  specId: string;       // "networks" | "route-tables" | "security-groups" | ...
  refId: string | null | undefined;
  folderId?: string;
  /** Render как antd Tag (chip-стиль). Default — обычная ссылка. */
  asTag?: boolean;
}

export function RefNameLink({ specId, refId, folderId: folderOverride, asTag }: Props) {
  const params = useParams();
  const folder = useFolderStore((s) => s.folder);
  const folderId = folderOverride ?? params.folderId ?? folder?.id ?? null;
  const spec = REGISTRY[specId];

  const { data } = useQuery({
    queryKey: ["ref-name", specId, folderId],
    queryFn: () =>
      api.list<Record<string, Array<{ id: string; name?: string }>>>(spec!.apiPath, {
        folder_id: folderId!,
        pageSize: "500",
      }),
    enabled: !!spec && !!folderId && !!refId,
    staleTime: 30_000,
  });

  if (!refId) return <span className="text-muted-foreground">—</span>;
  if (!spec) return <span className="text-muted-foreground">{refId}</span>;

  const items = data?.[spec.payloadKey] ?? [];
  const row = items.find((r) => r.id === refId);
  const display = row?.name || refId.slice(0, 12) + "…";
  const href = folderId ? `/folders/${folderId}/${spec.route}/${refId}` : null;

  const inner = href ? (
    <Link
      to={href}
      onClick={(e) => e.stopPropagation()}
      className="text-primary hover:underline"
    >
      {display}
    </Link>
  ) : (
    <span className="text-foreground">{display}</span>
  );

  if (asTag) {
    return (
      <Tag style={{ margin: 0, padding: "0 6px", lineHeight: "20px" }}>{inner}</Tag>
    );
  }
  return inner;
}
