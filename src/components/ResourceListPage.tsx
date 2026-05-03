import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResourceTable, Column } from "@/components/ResourceTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ResourceFormDialog } from "@/components/ResourceFormDialog";
import { DeleteButton } from "@/components/DeleteButton";
import { FolderRequiredEmpty } from "@/components/FolderRequiredEmpty";
import { post } from "@/api/client";
import { useFolderStore } from "@/lib/folder-store";
import { ResourceSpec, getByPath } from "@/lib/resource-registry";

interface Props {
  spec: ResourceSpec;
}

export function ResourceListPage({ spec }: Props) {
  const folder = useFolderStore((s) => s.folder);
  const folderRequired = spec.scope === "folder";

  const queryKey = [`${spec.id}.list`, folder?.uid ?? null];
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey,
    queryFn: () =>
      post<unknown, Record<string, unknown>>(`/v1/${spec.apiPath}/list`, {
        selectors:
          folderRequired && folder
            ? [{ field: "folder_id", op: "EQ", values: [folder.uid] }]
            : [],
      }),
    refetchInterval: 5_000,
    enabled: !folderRequired || !!folder,
  });

  if (folderRequired && !folder) return <FolderRequiredEmpty resource={spec.plural} />;

  const rows = ((data?.[spec.payloadKey] as unknown[]) ?? []) as Record<string, unknown>[];

  const columns: Column<Record<string, unknown>>[] = spec.columns.map((c) => ({
    header: c.header,
    className: c.className,
    cell: (row) => formatCell(c, row),
  }));

  // Action column
  columns.push({
    header: "",
    className: "text-right whitespace-nowrap",
    cell: (row) => {
      const uid = getByPath<string>(row, "metadata.uid") ?? "";
      const name = getByPath<string>(row, "metadata.name") ?? uid;
      return (
        <div className="flex items-center justify-end gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link to={`/${spec.route}/${uid}`}>
              <Eye className="h-4 w-4" /> View
            </Link>
          </Button>
          {spec.ops.edit && (
            <ResourceFormDialog
              mode="edit"
              title={`Edit ${spec.singular}`}
              description={`Upsert by uid (idempotent). Изменяет spec; status пишется только сервером.`}
              endpoint={`/v1/${spec.apiPath}/upsert`}
              payloadKey={spec.payloadKey}
              template={row}
              invalidateQueryKeys={[queryKey]}
            />
          )}
          {spec.ops.delete && (
            <DeleteButton
              endpoint={`/v1/${spec.apiPath}/delete`}
              uid={uid}
              name={name}
              resourceLabel={spec.singular}
              invalidateQueryKeys={[queryKey]}
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
          <h1 className="text-2xl font-semibold tracking-tight">{spec.plural}</h1>
          {spec.description && <p className="text-sm text-muted-foreground">{spec.description}</p>}
          {folderRequired && folder && (
            <p className="text-xs text-muted-foreground mt-1">
              Folder:{" "}
              <code className="bg-muted px-1 py-0.5 rounded">{folder.name}</code>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
          {spec.ops.create && (
            <ResourceFormDialog
              mode="create"
              title={`Create ${spec.singular}`}
              description="Upsert: server-side genarates UID если не задан."
              endpoint={`/v1/${spec.apiPath}/upsert`}
              payloadKey={spec.payloadKey}
              template={spec.template({
                folderId: folder?.uid,
                cloudId: folder?.cloudId,
                organizationId: folder?.organizationId,
              })}
              invalidateQueryKeys={[queryKey]}
            />
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">
          Ошибка: {(error as Error).message}
        </div>
      )}

      <ResourceTable
        rows={rows}
        loading={isLoading}
        rowKey={(r) => getByPath<string>(r, "metadata.uid") ?? Math.random().toString()}
        columns={columns}
      />
    </div>
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
