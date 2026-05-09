// ResourceDetailPage — детальная страница ресурса (flat API, 1.0).
// Поллит GET <spec.apiPath>/{id} каждые 3 сек.
// Restart/Start/Stop → POST <spec.apiPath>/{id}:verb → Operation.

import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, RotateCw, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JsonView } from "@/components/JsonView";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyableId } from "@/components/CopyableId";
import { ResourceFormDialog } from "@/components/ResourceFormDialog";
import { DeleteConfirmStub } from "@/components/DeleteConfirmStub";
import { OperationDialog, extractOperationId } from "@/components/OperationDialog";
import { SubnetCidrManager } from "@/components/SubnetCidrManager";
import { DetailShell, type DetailTab } from "@/components/DetailShell";
import { useBreadcrumb, useHeaderRight } from "@/components/PageHeaderSlot";
import { api, ApiError } from "@/api/client";
import { useFolderStore } from "@/lib/folder-store";
import { ResourceSpec, getByPath } from "@/lib/resource-registry";
import { useInvalidateResourceList } from "@/lib/use-operation";

interface Props {
  spec: ResourceSpec;
  // Имя URL-параметра в роуте (default "uid"). Org/Cloud detail используют
  // "orgId"/"cloudId", потому что эти же ключи фигурируют в дочерних list-роутах.
  paramKey?: string;
  /** Дополнительные tabs (Subnet "IP-адреса", SG "Входящий/Исходящий"). */
  extraTabs?: (data: Record<string, unknown>) => DetailTab[];
}

export function ResourceDetailPage({ spec, paramKey = "uid", extraTabs }: Props) {
  const params = useParams();
  const uid = params[paramKey];
  const navigate = useNavigate();
  const folder = useFolderStore((s) => s.folder);
  const invalidate = useInvalidateResourceList();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  const handleActionDone = useCallback(() => {
    setActionOpId(null);
    invalidate(spec.id, folder?.uid);
  }, [invalidate, spec.id, folder?.uid]);

  const actionMutation = useMutation({
    mutationFn: (verb: string) => api.action(`${spec.apiPath}/${uid}:${verb}`),
    onSuccess: (resp) => {
      setActionErr(null);
      const id = extractOperationId(resp);
      if (id) setActionOpId(id);
      else invalidate(spec.id, folder?.uid);
    },
    onError: (e) => {
      setActionErr(e instanceof ApiError ? `${e.code}: ${e.message}` : (e as Error).message);
    },
  });

  const doAction = (verb: string, title: string) => {
    setActionTitle(title);
    setActionErr(null);
    actionMutation.mutate(verb);
  };

  const name = data ? (getByPath<string>(data, "name") ?? "") : "";
  const statusValue = data ? getByPath<string>(data, "status") : undefined;
  const resourceId = data ? (getByPath<string>(data, "id") ?? uid ?? "") : uid ?? "";
  const editPath = `${spec.apiPath}/${resourceId}`;

  // Back-link учитывает parent-context из URL.
  const backHref = useMemo(() => {
    const folderId = params.folderId;
    if (folderId) return `/folders/${folderId}/${spec.route}`;
    if (spec.id === "clouds" && data) {
      const orgId = getByPath<string>(data, "organization_id");
      return orgId ? `/organizations/${orgId}/clouds` : "/organizations";
    }
    if (spec.id === "folders" && data) {
      const cloudId = getByPath<string>(data, "cloud_id");
      return cloudId ? `/clouds/${cloudId}/folders` : "/organizations";
    }
    return "/organizations";
  }, [params.folderId, spec.id, spec.route, data]);

  // Breadcrumb: <Plural> / <Name>
  const breadcrumb = useMemo(
    () => (
      <>
        <Link to={backHref} className="text-muted-foreground hover:text-foreground">
          {spec.plural}
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground truncate">{name || resourceId}</span>
      </>
    ),
    [backHref, spec.plural, name, resourceId],
  );
  useBreadcrumb(breadcrumb);

  // Header CTA: Edit / Restart / Start / Stop / Delete
  const headerActions = useMemo(
    () => (
      <>
        {spec.ops.restart && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => doAction("restart", "Restarting")}
            disabled={actionMutation.isPending}
          >
            <RotateCw
              className={`h-4 w-4 ${actionMutation.isPending && actionMutation.variables === "restart" ? "animate-spin" : ""}`}
            />
            Restart
          </Button>
        )}
        {spec.ops.start && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => doAction("start", "Starting")}
            disabled={actionMutation.isPending}
          >
            <Play className="h-4 w-4" /> Start
          </Button>
        )}
        {spec.ops.stop && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => doAction("stop", "Stopping")}
            disabled={actionMutation.isPending}
          >
            <Square className="h-4 w-4" /> Stop
          </Button>
        )}
        {spec.ops.update && data && (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Редактировать
          </Button>
        )}
        {spec.ops.delete && data && (
          <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
            Удалить
          </Button>
        )}
      </>
    ),
    // doAction / actionMutation стабильны через useCallback в реальности? нет —
    // пересоздаются каждый рендер. Но ReactNode сравнивается shallow в провайдере
    // через setState, лишний rerender провайдера тривиален.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec, data, actionMutation.isPending, actionMutation.variables],
  );
  useHeaderRight(headerActions);

  if (isLoading && !data) {
    return <div className="p-6 text-sm text-muted-foreground">Загрузка…</div>;
  }

  if (isError && !data) {
    return (
      <div className="p-6 space-y-3">
        <Button asChild variant="outline" size="sm">
          <Link to={backHref}>
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
          <Link to={backHref}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Ресурс не найден.
        </div>
      </div>
    );
  }

  const tabs: DetailTab[] = [
    {
      id: "overview",
      label: "Обзор",
      render: () => (
        <div className="space-y-4">
          {actionErr && (
            <div className="rounded-md bg-destructive/10 text-destructive p-2 text-xs">
              {actionErr}
            </div>
          )}
          {spec.id === "subnets" && (
            <SubnetCidrManager
              subnetId={resourceId}
              blocks={(getByPath<string[]>(data, "v4_cidr_blocks") ?? []) as string[]}
            />
          )}
          <Section title="Общее">
            <KV k="ID" v={resourceId} copyId />
            <KV k="Имя" v={name} />
            {statusValue ? <KV k="Статус" v={statusValue} /> : null}
            {getByPath<string>(data, "created_at") ? (
              <KV
                k="Дата создания"
                v={new Date(getByPath<string>(data, "created_at")!).toLocaleString()}
              />
            ) : null}
            {getByPath<string>(data, "folder_id") ? (
              <KV k="Folder" v={getByPath<string>(data, "folder_id")!} copyId />
            ) : null}
            {getByPath<string>(data, "cloud_id") ? (
              <KV k="Cloud" v={getByPath<string>(data, "cloud_id")!} copyId />
            ) : null}
            {getByPath<string>(data, "organization_id") ? (
              <KV k="Organization" v={getByPath<string>(data, "organization_id")!} copyId />
            ) : null}
            {getByPath<string>(data, "zone_id") ? (
              <KV k="Зона" v={getByPath<string>(data, "zone_id")!} mono />
            ) : null}
            {getByPath<string>(data, "network_id") ? (
              <KV k="Сеть" v={getByPath<string>(data, "network_id")!} copyId />
            ) : null}
            {getByPath<string>(data, "description") ? (
              <KV k="Описание" v={getByPath<string>(data, "description")!} />
            ) : null}
          </Section>
        </div>
      ),
    },
    ...(extraTabs ? extraTabs(data) : []),
    {
      id: "raw",
      label: "JSON",
      render: () => <JsonView data={data} />,
    },
  ];

  return (
    <>
      <DetailShell
        resourceLabel={spec.singular}
        resourceName={name || resourceId}
        badges={statusValue ? <StatusBadge state={statusValue} /> : null}
        tabs={tabs}
      />

      {spec.ops.update && (
        <ResourceFormDialog
          mode="edit"
          title={`Edit ${spec.singular}`}
          description="Изменяет ресурс."
          apiPath={editPath}
          resourceId={spec.id}
          template={data}
          fields={spec.fields}
          folderUid={folder?.uid}
          sanitize={spec.sanitize}
          controlledOpen={{ open: editOpen, setOpen: setEditOpen }}
        />
      )}
      {spec.ops.delete && (
        <DeleteConfirmStub
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          resourceLabel={spec.singular}
          name={name || resourceId}
          apiPath={editPath}
        />
      )}

      <OperationDialog
        opId={actionOpId}
        title={actionTitle}
        onSuccess={handleActionDone}
        onClose={handleActionDone}
      />
    </>
  );

  // Suppress unused-warning на navigate — оставляем для будущих delete-flows.
  void navigate;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-2.5 border-b border-border text-sm font-medium">{title}</div>
      <dl className="grid grid-cols-[200px_1fr] gap-x-6 gap-y-2 px-4 py-3 text-sm">
        {children}
      </dl>
    </div>
  );
}

function KV({
  k,
  v,
  mono,
  copyId,
}: {
  k: string;
  v?: string;
  mono?: boolean;
  copyId?: boolean;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={mono ? "font-mono text-xs" : ""}>
        {copyId && v ? <CopyableId id={v} /> : v || "—"}
      </dd>
    </>
  );
}
