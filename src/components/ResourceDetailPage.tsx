import { useNavigate, useParams, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonView } from "@/components/JsonView";
import { StatusBadge } from "@/components/StatusBadge";
import { ResourceFormDialog } from "@/components/ResourceFormDialog";
import { DeleteButton } from "@/components/DeleteButton";
import { WatchIndicator } from "@/components/ResourceListPage";
import { post } from "@/api/client";
import { useFolderStore } from "@/lib/folder-store";
import { ResourceSpec, getByPath } from "@/lib/resource-registry";
import { useResourceWatch } from "@/lib/use-resource-watch";

interface Props {
  spec: ResourceSpec;
}

export function ResourceDetailPage({ spec }: Props) {
  const { uid } = useParams();
  const navigate = useNavigate();
  const folder = useFolderStore((s) => s.folder);

  // Подписываемся на ту же list-watch (через folder-scope), потом выбираем
  // нужный uid в memory. Это даёт live-updates без отдельного watch-stream.
  const { items, status, error } = useResourceWatch(spec, folder);

  const data = items.find((it) => it.metadata.uid === uid) as
    | (Record<string, unknown> & { metadata: { uid: string } })
    | undefined;

  const restartMutation = useMutation({
    mutationFn: () => post(`/v1/${spec.apiPath}/restart`, { uid }),
  });

  if (status === "listing" && !data) {
    return <div className="p-6 text-sm text-muted-foreground">Загрузка…</div>;
  }

  if (status === "error" && !data) {
    return (
      <div className="p-6 space-y-3">
        <Button asChild variant="outline" size="sm">
          <Link to={`/${spec.route}`}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">
          Ошибка: {error}
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

  const name = getByPath<string>(data, "metadata.name") ?? "";
  const stateBadge = getByPath<string>(data, "status.state");
  const meta = (data.metadata as Record<string, unknown>) ?? {};
  const spec_ = data.spec as Record<string, unknown> | undefined;
  const status_ = data.status as Record<string, unknown> | undefined;

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
            {stateBadge && <StatusBadge state={stateBadge} />}
            <WatchIndicator status={status} />
          </div>
          <div className="text-xs text-muted-foreground font-mono">{uid}</div>
        </div>
        <div className="flex items-center gap-2">
          {spec.ops.restart && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => restartMutation.mutate()}
              disabled={restartMutation.isPending}
            >
              <RotateCw className={`h-4 w-4 ${restartMutation.isPending ? "animate-spin" : ""}`} />{" "}
              Restart
            </Button>
          )}
          {spec.ops.edit && (
            <ResourceFormDialog
              mode="edit"
              title={`Edit ${spec.singular}`}
              description="Upsert by uid (idempotent)."
              endpoint={`/v1/${spec.apiPath}/upsert`}
              payloadKey={spec.payloadKey}
              template={data}
              fields={spec.fields}
              invalidateQueryKeys={[]}
            />
          )}
          {spec.ops.delete && (
            <DeleteButton
              endpoint={`/v1/${spec.apiPath}/delete`}
              uid={uid!}
              name={name}
              resourceLabel={spec.singular}
              invalidateQueryKeys={[]}
              navigateTo={() => navigate(`/${spec.route}`)}
            />
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="spec">Spec</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="raw">Raw JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="rounded-lg border border-border p-4 space-y-2">
            <h3 className="font-semibold text-sm">Metadata</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <KV k="UID" v={meta.uid as string} mono />
              <KV k="Name" v={meta.name as string} />
              <KV k="Resource Version" v={meta.resourceVersion as string} mono />
              <KV k="Generation" v={meta.generation as string} mono />
              {meta.creationTimestamp ? (
                <KV k="Created" v={new Date(meta.creationTimestamp as string).toLocaleString()} />
              ) : null}
              {meta.deletionTimestamp ? (
                <KV
                  k="Deletion"
                  v={new Date(meta.deletionTimestamp as string).toLocaleString()}
                />
              ) : null}
              {meta.organizationId ? <KV k="Organization" v={meta.organizationId as string} mono /> : null}
              {meta.cloudId ? <KV k="Cloud" v={meta.cloudId as string} mono /> : null}
              {meta.folderId ? <KV k="Folder" v={meta.folderId as string} mono /> : null}
            </dl>
          </div>
        </TabsContent>

        <TabsContent value="spec">
          <JsonView data={spec_ ?? {}} />
        </TabsContent>
        <TabsContent value="status">
          <JsonView data={status_ ?? {}} />
        </TabsContent>
        <TabsContent value="raw">
          <JsonView data={data} />
        </TabsContent>
      </Tabs>
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
