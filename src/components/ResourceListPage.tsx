// ResourceListPage — generic страница списка ресурсов.
// Использует polling (3 сек) вместо Watch/WebSocket.
// spec.apiPath содержит полный path: /resource-manager/v1/clouds и т.д.

import { ReactNode, useMemo, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResourceTable, Column } from "@/components/ResourceTable";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyableId } from "@/components/CopyableId";
import { ResourceFormDialog } from "@/components/ResourceFormDialog";
import { RowActionsMenu } from "@/components/RowActionsMenu";
import { FolderRequiredEmpty } from "@/components/FolderRequiredEmpty";
import { useHeaderRight, useBreadcrumb } from "@/components/PageHeaderSlot";
import { ResourceSpec, getByPath } from "@/lib/resource-registry";
import { useResourceList } from "@/lib/use-resource-list";

interface Props {
  spec: ResourceSpec;
  /** API field name для фильтрации списка (organization_id / cloud_id / folder_id). */
  parentField?: string;
  /** URL-param name (orgId / cloudId / folderId) откуда брать значение filter. */
  parentParam?: string;
}

export function ResourceListPage({ spec, parentField, parentParam }: Props) {
  const params = useParams();
  const location = useLocation();
  const filterValue = parentParam ? (params[parentParam] ?? null) : null;
  const [query, setQuery] = useState("");

  const { data, isLoading, isError, error, isFetching } = useResourceList(
    spec,
    parentField ?? null,
    filterValue,
  );

  // Header slots: breadcrumb + primary CTA. Стабильные через useMemo, чтобы
  // не триггерить лишние setState в провайдере на каждом polling-rerender.
  const breadcrumb = useMemo(
    () => <span className="text-foreground">{spec.plural}</span>,
    [spec.plural],
  );
  useBreadcrumb(breadcrumb);

  // Create CTA — navigation на full-page форму /<basePath>/create.
  // Если у ресурса нет form-schema (fields), используем legacy modal с JSON-editor.
  const createBase = location.pathname.endsWith("/")
    ? location.pathname.slice(0, -1)
    : location.pathname;

  const cta = useMemo(() => {
    if (!spec.ops.create) return null;
    if (spec.fields) {
      return (
        <Button asChild size="sm">
          <Link to={`${createBase}/create`}>
            <Plus className="h-4 w-4" /> Создать {spec.singular.toLowerCase()}
          </Link>
        </Button>
      );
    }
    // Fallback на modal — для admin ресурсов (regions/zones/address-pools)
    // на этом этапе page-mode формы ещё не подняты под /system/*.
    const tpl = spec.template({
      folderId: parentField === "folder_id" ? (filterValue ?? undefined) : undefined,
      cloudId: parentField === "cloud_id" ? (filterValue ?? undefined) : undefined,
      organizationId:
        parentField === "organization_id" ? (filterValue ?? undefined) : undefined,
    });
    return (
      <ResourceFormDialog
        mode="create"
        title={`Создать ${spec.singular.toLowerCase()}`}
        apiPath={spec.apiPath}
        resourceId={spec.id}
        template={tpl}
        fields={spec.fields}
        folderUid={filterValue ?? null}
        sanitize={spec.sanitize}
      />
    );
  }, [spec, createBase, parentField, filterValue]);

  useHeaderRight(cta);

  // Если ресурс требует parent (например, /folders/:folderId/networks без folderId)
  if (parentField && !filterValue) return <FolderRequiredEmpty resource={spec.plural} />;

  const basePath = location.pathname.endsWith("/")
    ? location.pathname.slice(0, -1)
    : location.pathname;

  const items = (data?.[spec.payloadKey] as Record<string, unknown>[] | undefined) ?? [];

  // Local filter — substring match по name + id.
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => {
      const name = (getByPath<string>(row, "name") ?? "").toLowerCase();
      const id = (getByPath<string>(row, "id") ?? "").toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [items, query]);

  const columns: Column<Record<string, unknown>>[] = spec.columns.map((c) => ({
    header: c.header,
    className: c.className,
    cell: (row) => formatCell(c, row),
    // Sortable: name / id / created_at / любые text-колонки.
    sortKey:
      c.format === "datetime" || c.format === "text" || c.format === "uid-short"
        ? c.path
        : undefined,
  }));

  // Финальная action-колонка (kebab).
  columns.push({
    header: "",
    className: "text-right whitespace-nowrap w-10",
    cell: (row) => (
      <RowActionsMenu
        spec={spec}
        row={row}
        basePath={basePath}
        folderUid={filterValue ?? null}
      />
    ),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{spec.plural}</h1>
          {spec.description && (
            <p className="text-sm text-muted-foreground mt-1">{spec.description}</p>
          )}
        </div>
        <PollingIndicator isFetching={isFetching} isError={isError} />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Фильтр по имени или идентификатору"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {parentField && filterValue && (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
            <span>{parentField}:</span>
            <CopyableId id={filterValue} />
          </p>
        )}
      </div>

      {isError && (
        <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">
          Ошибка: {(error as Error).message}
        </div>
      )}

      <ResourceTable
        rows={filteredItems}
        loading={isLoading && items.length === 0}
        rowKey={(r) => getByPath<string>(r, "id") ?? Math.random().toString()}
        columns={columns}
      />
    </div>
  );
}

function PollingIndicator({
  isFetching,
  isError,
}: {
  isFetching: boolean;
  isError: boolean;
}) {
  if (isError) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-rose-400">
        <RefreshCw className="h-3 w-3" /> offline
      </span>
    );
  }
  if (isFetching) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> polling
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-emerald-400"
      title="Данные актуальны"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      live
    </span>
  );
}

function formatCell(c: { path: string; format?: string }, row: Record<string, unknown>): ReactNode {
  const v = getByPath(row, c.path);
  switch (c.format) {
    case "status":
      return <StatusBadge state={typeof v === "string" ? v : undefined} />;
    case "uid-short":
      return typeof v === "string" && v ? (
        <CopyableId id={v} />
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    case "datetime":
      return typeof v === "string" && v ? (
        <span className="text-xs text-muted-foreground">{new Date(v).toLocaleString()}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    case "code":
      return typeof v === "string" || typeof v === "number" ? (
        <code className="text-xs">{String(v)}</code>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    case "list":
      if (Array.isArray(v) && v.length > 0) {
        return <span className="text-xs">{v.join(", ")}</span>;
      }
      return <span className="text-muted-foreground">—</span>;
    case "text":
    default:
      if (v == null || v === "") return <span className="text-muted-foreground">—</span>;
      return String(v);
  }
}
