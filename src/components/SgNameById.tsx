// SgNameById — показывает имя SecurityGroup по id со ссылкой на её detail.
// Список SG'шек folder'а закешируется один раз (TanStack staleTime), все строки
// таблицы используют один query.

import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useFolderStore } from "@/lib/folder-store";

interface Props {
  /** ID security group из row.default_security_group_id. Может быть null/empty. */
  sgId: string | undefined | null;
  /** Optional folder override (если на странице с другим folder контекстом). */
  folderId?: string;
}

interface SgRow {
  id: string;
  name: string;
}

export function SgNameById({ sgId, folderId: folderOverride }: Props) {
  const params = useParams();
  const folder = useFolderStore((s) => s.folder);
  const folderId = folderOverride ?? params.folderId ?? folder?.id ?? null;

  const { data } = useQuery({
    queryKey: ["sg-name-lookup", folderId],
    queryFn: () =>
      api.list<{ security_groups: SgRow[] }>("/vpc/v1/securityGroups", {
        folder_id: folderId!,
        pageSize: "500",
      }),
    enabled: !!folderId && !!sgId,
    staleTime: 30_000,
  });

  if (!sgId) return <span className="text-muted-foreground">—</span>;

  const sg = data?.security_groups?.find((s) => s.id === sgId);
  const name = sg?.name || sgId.slice(0, 12) + "…";
  const href = folderId
    ? `/folders/${folderId}/security-groups/${sgId}`
    : null;

  if (!href) {
    return <span className="text-foreground">{name}</span>;
  }

  return (
    <Link
      to={href}
      onClick={(e) => e.stopPropagation()}
      className="text-primary hover:underline"
    >
      {name}
    </Link>
  );
}
