import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Eye, Wifi, WifiOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResourceTable, Column } from "@/components/ResourceTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ResourceFormDialog } from "@/components/ResourceFormDialog";
import { DeleteButton } from "@/components/DeleteButton";
import { FolderRequiredEmpty } from "@/components/FolderRequiredEmpty";
import { useFolderStore } from "@/lib/folder-store";
import { ResourceSpec, getByPath } from "@/lib/resource-registry";
import { useResourceWatch, type WatchStatus } from "@/lib/use-resource-watch";

interface Props {
  spec: ResourceSpec;
}

export function ResourceListPage({ spec }: Props) {
  const folder = useFolderStore((s) => s.folder);
  const folderRequired = spec.scope === "folder";

  const { items, status, error } = useResourceWatch(spec, folder);

  if (folderRequired && !folder) return <FolderRequiredEmpty resource={spec.plural} />;

  const rows = items as Record<string, unknown>[];

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
              fields={spec.fields}
              invalidateQueryKeys={[]}
            />
          )}
          {spec.ops.delete && (
            <DeleteButton
              endpoint={`/v1/${spec.apiPath}/delete`}
              uid={uid}
              name={name}
              resourceLabel={spec.singular}
              invalidateQueryKeys={[]}
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
            <WatchIndicator status={status} />
          </div>
          {spec.description && <p className="text-sm text-muted-foreground">{spec.description}</p>}
          {folderRequired && folder && (
            <p className="text-xs text-muted-foreground mt-1">
              Folder:{" "}
              <code className="bg-muted px-1 py-0.5 rounded">{folder.name}</code>
            </p>
          )}
        </div>
        {spec.ops.create && (
          <ResourceFormDialog
            mode="create"
            title={`Create ${spec.singular}`}
            description="Upsert: server-side генерирует UID если не задан."
            endpoint={`/v1/${spec.apiPath}/upsert`}
            payloadKey={spec.payloadKey}
            template={spec.template({
              folderId: folder?.uid,
              cloudId: folder?.cloudId,
              organizationId: folder?.organizationId,
            })}
            fields={spec.fields}
            invalidateQueryKeys={[]}
          />
        )}
      </div>

      {error && status === "error" && (
        <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">
          Ошибка: {error}
        </div>
      )}
      {error && status === "reconnecting" && (
        <div className="rounded-md bg-amber-50 text-amber-800 p-3 text-sm flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Переподключение к Watch-стриму… ({error})
        </div>
      )}

      <ResourceTable
        rows={rows}
        loading={status === "listing" && rows.length === 0}
        rowKey={(r) => getByPath<string>(r, "metadata.uid") ?? Math.random().toString()}
        columns={columns}
      />
    </div>
  );
}

function WatchIndicator({ status }: { status: WatchStatus }) {
  if (status === "watching") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-emerald-600"
        title="Live: подписаны на Watch-стрим"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        live
      </span>
    );
  }
  if (status === "listing") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> listing
      </span>
    );
  }
  if (status === "reconnecting") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
        <WifiOff className="h-3 w-3" /> reconnecting
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-rose-600">
        <WifiOff className="h-3 w-3" /> offline
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Wifi className="h-3 w-3" /> idle
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

export { WatchIndicator };
