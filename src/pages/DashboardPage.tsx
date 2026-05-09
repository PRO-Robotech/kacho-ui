// DashboardPage — root экран /. YC-style: один tile «Virtual Private Cloud»
// со счётчиками в выбранном folder. Прочих сервисов (Cloud DNS, IAM) у
// нас нет — соответствующие tile'ы намеренно не показываем.
//
// Если folder не выбран — empty state с CTA выбрать folder через
// header-pills.

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Network, ArrowRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBreadcrumb, useHeaderRight, usePageTitle } from "@/components/PageHeaderSlot";
import { api } from "@/api/client";
import { useFolderStore } from "@/lib/folder-store";

type ListResp = Record<string, unknown>;

function useFolderResourceCount(
  resource: string,
  apiPath: string,
  folderId: string | null,
  payloadKey: string,
): number | null {
  const { data } = useQuery({
    queryKey: ["dash", resource, folderId],
    queryFn: () =>
      api.list<ListResp>(apiPath, {
        folder_id: folderId!,
        pageSize: "1000",
      }),
    refetchInterval: 15_000,
    enabled: !!folderId,
  });
  if (!data) return null;
  const arr = data[payloadKey];
  return Array.isArray(arr) ? arr.length : 0;
}

export function DashboardPage() {
  const folder = useFolderStore((s) => s.folder);
  const folderId = folder?.id ?? null;

  const networks = useFolderResourceCount("networks", "/vpc/v1/networks", folderId, "networks");
  const subnets = useFolderResourceCount("subnets", "/vpc/v1/subnets", folderId, "subnets");
  const sgs = useFolderResourceCount(
    "security-groups",
    "/vpc/v1/securityGroups",
    folderId,
    "security_groups",
  );

  // Header slots — пустые на dashboard (только заголовок Console в pills).
  useBreadcrumb(useMemo(() => <span className="text-foreground">Дашборд</span>, []));
  useHeaderRight(null);
  usePageTitle(null); // dashboard title рендерим в page-body, не в header

  const stats = [
    {
      label: "Сетей",
      value: networks,
      to: folderId ? `/folders/${folderId}/networks` : null,
    },
    {
      label: "Подсетей",
      value: subnets,
      to: folderId ? `/folders/${folderId}/subnets` : null,
    },
    {
      label: "Групп безопасности",
      value: sgs,
      to: folderId ? `/folders/${folderId}/security-groups` : null,
    },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Дашборд</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Краткая сводка ресурсов в текущем каталоге.
        </p>
      </div>

      {!folder ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center space-y-3">
          <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto" />
          <div className="text-base font-medium">Каталог не выбран</div>
          <div className="text-sm text-muted-foreground">
            Выберите Cloud и Folder в шапке наверху, чтобы увидеть ресурсы.
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/organizations">
              Перейти к Organizations <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to={`/folders/${folderId}/networks`}
            className="group rounded-lg border border-border bg-card p-5 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-blue-400" />
                  <h2 className="text-base font-semibold">Virtual Private Cloud</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Сети, подсети, группы безопасности, адреса.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            <dl className="mt-5 grid grid-cols-3 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="rounded-md bg-muted/40 px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {s.label}
                  </dt>
                  <dd className="text-xl font-semibold tabular-nums mt-0.5">
                    {s.value === null ? "—" : s.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Link>
        </div>
      )}
    </div>
  );
}
