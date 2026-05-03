// ResourceDetailPage — детальная страница ресурса (flat API, 1.0).
// Поллит GET <spec.apiPath>/{id} каждые 3 сек.
// Restart/Start/Stop → POST <spec.apiPath>/{id}:verb → Operation.

import { useCallback, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, RotateCw, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonView } from "@/components/JsonView";
import { StatusBadge } from "@/components/StatusBadge";
import { ResourceFormDialog } from "@/components/ResourceFormDialog";
import { DeleteButton } from "@/components/DeleteButton";
import { OperationDialog, extractOperationId } from "@/components/OperationDialog";
import { api, ApiError } from "@/api/client";
import { useFolderStore } from "@/lib/folder-store";
import { ResourceSpec, getByPath } from "@/lib/resource-registry";
import { useInvalidateResourceList } from "@/lib/use-operation";

interface Props {
  spec: ResourceSpec;
}

export function ResourceDetailPage({ spec }: Props) {
  const { uid } = useParams();
  const navigate = useNavigate();
  const folder = useFolderStore((s) => s.folder);
  const invalidate = useInvalidateResourceList();

  // Polling GET /v1/<plural>/{id}
  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: [spec.id, "detail", uid],
    queryFn: () => api.get<Record<string, unknown>>(`${spec.apiPath}/${uid}`),
    refetchInterval: 3_000,
    enabled: !!uid,
    staleTime: 0,
  });

  const [actionOpId, setActionOpId] = useState<string | null>(null);
  const [actionTitle, setActionTitle] = useState("Action");
  const [actionErr, setActionErr] = useState<string | null>(null);

  const handleActionSuccess = useCallback(() => {
    setActionOpId(null);
    invalidate(spec.id, folder?.uid);
  }, [invalidate, spec.id, folder?.uid]);

  const handleActionClose = useCallback(() => {
    setActionOpId(null);
    invalidate(spec.id, folder?.uid);
  }, [invalidate, spec.id, folder?.uid]);

  const actionMutation = useMutation({
    mutationFn: (verb: string) =>
      api.action(`${spec.apiPath}/${uid}:${verb}`),
    onSuccess: (resp) => {
      setActionErr(null);
      const id = extractOperationId(resp);
      if (id) {
        setActionOpId(id);
      } else {
        invalidate(spec.id, folder?.uid);
      }
    },
    onError: (e) => {
      setActionErr(
        e instanceof ApiError ? `${e.code}: ${e.message}` : (e as Error).message,
      );
    },
  });

  const doAction = (verb: string, title: string) => {
    setActionTitle(title);
    setActionErr(null);
    actionMutation.mutate(verb);
  };

  if (isLoading && !data) {
    return <div className="p-6 text-sm text-muted-foreground">Загрузка…</div>;
  }

  if (isError && !data) {
    return (
      <div className="p-6 space-y-3">
        <Button asChild variant="outline" size="sm">
          <Link to={`/${spec.route}`}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">
          Ошибка: {(error as Error).message}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link to={`/${spec.route}`}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Ресурс не найден.
        </div>
      </div>
    );
  }

  const name = getByPath<string>(data, "name") ?? "";
  const statusValue = getByPath<string>(data, "status");
  const resourceId = getByPath<string>(data, "id") ?? uid ?? "";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="h-7 px-2 -ml-2">
            <Link to={`/${spec.route}`}>
              <ArrowLeft className="h-4 w-4" /> {spec.plural}
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
            {statusValue && <StatusBadge state={statusValue} />}
          </div>
          <div className="text-xs text-muted-foreground font-mono">{resourceId}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {spec.ops.restart && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => doAction("restart", "Restarting Instance")}
              disabled={actionMutation.isPending}
            >
              <RotateCw
                className={`h-4 w-4 ${actionMutation.isPending && actionMutation.variables === "restart" ? "animate-spin" : ""}`}
              />{" "}
              Restart
            </Button>
          )}
          {spec.ops.start && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => doAction("start", "Starting Instance")}
              disabled={actionMutation.isPending}
            >
              <Play className="h-4 w-4" /> Start
            </Button>
          )}
          {spec.ops.stop && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => doAction("stop", "Stopping Instance")}
              disabled={actionMutation.isPending}
            >
              <Square className="h-4 w-4" /> Stop
            </Button>
          )}
          {spec.ops.update && (
            <ResourceFormDialog
              mode="edit"
              title={`Edit ${spec.singular}`}
              description="Изменяет ресурс."
              apiPath={`${spec.apiPath}/${resourceId}`}
              resourceId={spec.id}
              template={data}
              fields={spec.fields}
              folderUid={folder?.uid}
              sanitize={spec.sanitize}
            />
          )}
          {spec.ops.delete && (
            <DeleteButton
              apiPath={`${spec.apiPath}/${resourceId}`}
              resourceId={spec.id}
              name={name}
              resourceLabel={spec.singular}
              folderUid={folder?.uid}
              navigateTo={() => navigate(`/${spec.route}`)}
            />
          )}
        </div>
      </div>

      {actionErr && (
        <div className="rounded-md bg-destructive/10 text-destructive p-2 text-xs">
          {actionErr}
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="raw">Raw JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="rounded-lg border border-border p-4 space-y-2">
            <h3 className="font-semibold text-sm">Resource fields</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <KV k="ID" v={resourceId} mono />
              <KV k="Name" v={name} />
              {statusValue ? <KV k="Status" v={statusValue} /> : null}
              {getByPath<string>(data, "created_at") ? (
                <KV
                  k="Created"
                  v={new Date(getByPath<string>(data, "created_at")!).toLocaleString()}
                />
              ) : null}
              {getByPath<string>(data, "folder_id") ? (
                <KV k="Folder" v={getByPath<string>(data, "folder_id")!} mono />
              ) : null}
              {getByPath<string>(data, "cloud_id") ? (
                <KV k="Cloud" v={getByPath<string>(data, "cloud_id")!} mono />
              ) : null}
              {getByPath<string>(data, "organization_id") ? (
                <KV k="Organization" v={getByPath<string>(data, "organization_id")!} mono />
              ) : null}
              {getByPath<string>(data, "zone_id") ? (
                <KV k="Zone" v={getByPath<string>(data, "zone_id")!} />
              ) : null}
              {getByPath<string>(data, "display_name") ? (
                <KV k="Display Name" v={getByPath<string>(data, "display_name")!} />
              ) : null}
              {getByPath<string>(data, "description") ? (
                <KV k="Description" v={getByPath<string>(data, "description")!} />
              ) : null}
            </dl>
          </div>
        </TabsContent>

        <TabsContent value="raw">
          <JsonView data={data} />
        </TabsContent>
      </Tabs>

      <OperationDialog
        opId={actionOpId}
        title={actionTitle}
        onSuccess={handleActionSuccess}
        onClose={handleActionClose}
      />
    </div>
  );
}

function KV({ k, v, mono }: { k: string; v?: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={mono ? "font-mono text-xs" : ""}>{v || "—"}</dd>
    </>
  );
}
