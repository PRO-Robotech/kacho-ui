// ResourceListPage — generic страница списка ресурсов.
// Использует polling (3 сек) вместо Watch/WebSocket.
// spec.apiPath содержит полный path: /resource-manager/v1/clouds и т.д.

import { ReactNode } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { Eye, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResourceTable, Column } from "@/components/ResourceTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ResourceFormDialog } from "@/components/ResourceFormDialog";
import { DeleteButton } from "@/components/DeleteButton";
import { FolderRequiredEmpty } from "@/components/FolderRequiredEmpty";
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

  const { data, isLoading, isError, error, isFetching } = useResourceList(
    spec,
    parentField ?? null,
    filterValue,
  );

  // Если ресурс требует parent (например, /folders/:folderId/networks без folderId)
  if (parentField && !filterValue) return <FolderRequiredEmpty resource={spec.plural} />;

  // Текущий path-prefix — для построения link на detail (preserve nested path).
  // Например, /folders/X/networks → detail на /folders/X/networks/{id}.
  const basePath = location.pathname.endsWith("/")
    ? location.pathname.slice(0, -1)
    : location.pathname;

  const items = (data?.[spec.payloadKey] as Record<string, unknown>[] | undefined) ?? [];

  const columns: Column<Record<string, unknown>>[] = spec.columns.map((c) => ({
    header: c.header,
    className: c.className,
    cell: (row) => formatCell(c, row),
  }));

  // Колонка действий
  columns.push({
    header: "",
    className: "text-right whitespace-nowrap",
    cell: (row) => {
      const id = getByPath<string>(row, "id") ?? "";
      const name = getByPath<string>(row, "name") ?? id;
      return (
        <div className="flex items-center justify-end gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link to={`${basePath}/${id}`}>
              <Eye className="h-4 w-4" /> View
            </Link>
          </Button>
          {spec.ops.update && (
            <ResourceFormDialog
              mode="edit"
              title={`Edit ${spec.singular}`}
              description="Изменяет ресурс; status пишется только сервером."
              apiPath={`${spec.apiPath}/${id}`}
              resourceId={spec.id}
              template={row}
              fields={spec.fields}
              folderUid={filterValue ?? null}
              sanitize={spec.sanitize}
            />
          )}
          {spec.ops.delete && (
            <DeleteButton
              apiPath={`${spec.apiPath}/${id}`}
              resourceId={spec.id}
              name={name}
              resourceLabel={spec.singular}
              folderUid={filterValue ?? null}
              triggerLabel=""
            />
          )}
        </div>
      );
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{spec.plural}</h1>
            <PollingIndicator isFetching={isFetching} isError={isError} />
          </div>
          {spec.description && (
            <p className="text-sm text-muted-foreground">{spec.description}</p>
          )}
          {parentField && filterValue && (
            <p className="text-xs text-muted-foreground mt-1">
              {parentField}: <code className="bg-muted px-1 py-0.5 rounded">{filterValue.slice(0, 8)}…</code>
            </p>
          )}
        </div>
        {spec.ops.create && (
          <ResourceFormDialog
            mode="create"
            title={`Create ${spec.singular}`}
            apiPath={spec.apiPath}
            resourceId={spec.id}
            template={spec.template({
              folderId: parentField === "folder_id" ? (filterValue ?? undefined) : undefined,
              cloudId: parentField === "cloud_id" ? (filterValue ?? undefined) : undefined,
              organizationId:
                parentField === "organization_id" ? (filterValue ?? undefined) : undefined,
            })}
            fields={spec.fields}
            folderUid={filterValue ?? null}
            sanitize={spec.sanitize}
          />
        )}
      </div>

      {isError && (
        <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">
          Ошибка: {(error as Error).message}
        </div>
      )}

      <ResourceTable
        rows={items}
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
      <span className="inline-flex items-center gap-1 text-xs text-rose-600">
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
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600" title="Данные актуальны">
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
        <code className="text-xs text-muted-foreground">{v.slice(0, 8)}…</code>
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
