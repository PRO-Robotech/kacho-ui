// BreadcrumbSelector — Org → Cloud → Folder breadcrumbs.
// Каждая крошка:
//   - dropdown со списком ресурсов соответствующего уровня
//   - на каждом ряду — kebab (⋮) с Edit / Delete
//   - "+ Create new" внизу dropdown — создать новый

import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Cloud,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Check,
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { ApiError, api } from "@/api/client";
import {
  contextApi,
  useContext,
  type CloudRef,
  type FolderRef,
  type OrgRef,
} from "@/lib/context-store";
import { cn } from "@/lib/utils";
import { ResourceFormDialog } from "@/components/ResourceFormDialog";
import { OperationToastWatcher } from "@/components/OperationToastWatcher";
import { extractOperationId } from "@/components/OperationDialog";
import { useInvalidateResourceList } from "@/lib/use-operation";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { REGISTRY } from "@/lib/resource-registry";

type Level = "org" | "cloud" | "folder";

interface FormDialogState {
  level: Level;
  action: "create" | "edit";
  template: unknown;
}
interface DeleteDialogState {
  level: Level;
  apiPath: string;
  name: string;
  resourceLabel: string;
  // Callback после успешного удаления (например, сбросить selection в context).
  onSuccess?: () => void;
}

export function BreadcrumbSelector() {
  const org = useContext((s) => s.org);
  const cloud = useContext((s) => s.cloud);
  const folder = useContext((s) => s.folder);
  const navigate = useNavigate();
  const location = useLocation();

  const [formAction, setFormAction] = useState<FormDialogState | null>(null);
  const [deleteAction, setDeleteAction] = useState<DeleteDialogState | null>(null);

  // navigation actions: сначала обновляем context-store (со side-effect-ом
  // сброса дочерних уровней), затем навигируем. ContextUrlSync не повредит —
  // он не сбрасывает context при отсутствии IDs в URL.
  const goOrg = (id: string, name: string) => {
    contextApi.setOrg({ id, name }); // сбрасывает cloud+folder
    navigate(`/organizations/${id}/clouds`);
  };
  const goCloud = (id: string, name: string, orgId: string) => {
    contextApi.setCloud({ id, name, organizationId: orgId }); // сбрасывает folder
    navigate(`/clouds/${id}/folders`);
  };
  const goFolder = (id: string, name: string, cloudId: string, orgId: string) => {
    contextApi.setFolder({ id, uid: id, name, cloudId, organizationId: orgId });
    // Если уже на /folders/X/<resource> — сменить только folderId, сохранив resource.
    const m = location.pathname.match(/^\/folders\/[^/]+(\/.+)?$/);
    const tail = m && m[1] ? m[1] : "/networks";
    navigate(`/folders/${id}${tail}`);
  };
  const goRoot = () => {
    contextApi.setOrg(null);
    navigate("/organizations");
  };

  return (
    <div className="flex items-center text-sm">
      <OrgCrumb
        selected={org}
        onSelect={(it) => goOrg(it.id, it.name)}
        onClear={goRoot}
        onForm={setFormAction}
        onDelete={setDeleteAction}
      />
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mx-1 shrink-0" />
      <CloudCrumb
        selected={cloud}
        parentOrgId={org?.id ?? null}
        onSelect={(it) => goCloud(it.id, it.name, it.organization_id)}
        onForm={setFormAction}
        onDelete={setDeleteAction}
      />
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mx-1 shrink-0" />
      <FolderCrumb
        selected={folder}
        parentCloudId={cloud?.id ?? null}
        onSelect={(it) => goFolder(it.id, it.name, it.cloud_id, org?.id ?? "")}
        onForm={setFormAction}
        onDelete={setDeleteAction}
      />

      {formAction && (
        <CrumbFormDialog state={formAction} onClose={() => setFormAction(null)} />
      )}
      {deleteAction && (
        <CrumbDeleteDialog
          state={deleteAction}
          onClose={() => setDeleteAction(null)}
        />
      )}
    </div>
  );
}

// ====== Row data shapes (verbatim YC) ======

interface OrgRow {
  id: string;
  name: string;
  description?: string;
  title?: string;
  labels?: Record<string, string>;
}
interface CloudRow {
  id: string;
  name: string;
  description?: string;
  organization_id: string;
  labels?: Record<string, string>;
}
interface FolderRow {
  id: string;
  name: string;
  description?: string;
  cloud_id: string;
  labels?: Record<string, string>;
}

// ====== Org crumb ======

function OrgCrumb({
  selected,
  onSelect,
  onClear,
  onForm,
  onDelete,
}: {
  selected: OrgRef | null;
  onSelect: (row: OrgRow) => void;
  onClear: () => void;
  onForm: (s: FormDialogState) => void;
  onDelete: (s: DeleteDialogState) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["bc.orgs"],
    queryFn: () => api.list<{ organizations: OrgRow[] }>("/organization-manager/v1/organizations"),
    refetchInterval: 30_000,
  });
  const items = data?.organizations ?? [];
  // Если selected пришёл из URL без name — найди в загруженном списке.
  const resolvedName =
    selected?.name || items.find((it) => it.id === selected?.id)?.name;

  return (
    <Crumb
      icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
      label={resolvedName ?? (selected ? selected.id.slice(0, 8) + "…" : "Organization")}
      placeholder={!selected}
      loading={isLoading && items.length === 0}
      items={items.map((it) => ({
        id: it.id,
        label: it.name,
        sub: it.id.slice(0, 8),
        selected: selected?.id === it.id,
        onSelect: () => onSelect(it),
        onEdit: () => onForm({ level: "org", action: "edit", template: it }),
        onDelete: () =>
          onDelete({
            level: "org",
            apiPath: `/organization-manager/v1/organizations/${it.id}`,
            name: it.name,
            resourceLabel: "Organization",
            onSuccess: () => {
              if (selected?.id === it.id) onClear();
            },
          }),
      }))}
      onCreate={() =>
        onForm({
          level: "org",
          action: "create",
          template: { name: "", title: "", description: "" },
        })
      }
    />
  );
}

// ====== Cloud crumb ======

function CloudCrumb({
  selected,
  parentOrgId,
  onSelect,
  onForm,
  onDelete,
}: {
  selected: CloudRef | null;
  parentOrgId: string | null;
  onSelect: (row: CloudRow) => void;
  onForm: (s: FormDialogState) => void;
  onDelete: (s: DeleteDialogState) => void;
}) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["bc.clouds", parentOrgId],
    queryFn: () =>
      api.list<{ clouds: CloudRow[] }>("/resource-manager/v1/clouds", {
        organization_id: parentOrgId!,
      }),
    refetchInterval: 30_000,
    enabled: !!parentOrgId,
  });
  const items = data?.clouds ?? [];

  return (
    <Crumb
      icon={<Cloud className="h-4 w-4 text-muted-foreground" />}
      label={
        selected?.name ||
        items.find((it) => it.id === selected?.id)?.name ||
        (selected ? selected.id.slice(0, 8) + "…" : "Cloud")
      }
      placeholder={!selected}
      disabled={!parentOrgId}
      loading={isLoading && items.length === 0}
      disabledHint="Выберите Organization"
      items={items.map((it) => ({
        id: it.id,
        label: it.name,
        sub: it.id.slice(0, 8),
        selected: selected?.id === it.id,
        onSelect: () => onSelect(it),
        onEdit: () => onForm({ level: "cloud", action: "edit", template: it }),
        onDelete: () =>
          onDelete({
            level: "cloud",
            apiPath: `/resource-manager/v1/clouds/${it.id}`,
            name: it.name,
            resourceLabel: "Cloud",
            onSuccess: () => {
              if (selected?.id === it.id && parentOrgId)
                navigate(`/organizations/${parentOrgId}/clouds`);
            },
          }),
      }))}
      onCreate={
        parentOrgId
          ? () =>
              onForm({
                level: "cloud",
                action: "create",
                template: { name: "", organization_id: parentOrgId, description: "" },
              })
          : undefined
      }
    />
  );
}

// ====== Folder crumb ======

function FolderCrumb({
  selected,
  parentCloudId,
  onSelect,
  onForm,
  onDelete,
}: {
  selected: FolderRef | null;
  parentCloudId: string | null;
  onSelect: (row: FolderRow) => void;
  onForm: (s: FormDialogState) => void;
  onDelete: (s: DeleteDialogState) => void;
}) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["bc.folders", parentCloudId],
    queryFn: () =>
      api.list<{ folders: FolderRow[] }>("/resource-manager/v1/folders", {
        cloud_id: parentCloudId!,
      }),
    refetchInterval: 30_000,
    enabled: !!parentCloudId,
  });
  const items = data?.folders ?? [];

  return (
    <Crumb
      icon={<FolderOpen className="h-4 w-4 text-muted-foreground" />}
      label={
        selected?.name ||
        items.find((it) => it.id === selected?.id)?.name ||
        (selected ? selected.id.slice(0, 8) + "…" : "Folder")
      }
      placeholder={!selected}
      disabled={!parentCloudId}
      loading={isLoading && items.length === 0}
      disabledHint="Выберите Cloud"
      items={items.map((it) => ({
        id: it.id,
        label: it.name,
        sub: it.id.slice(0, 8),
        selected: selected?.id === it.id,
        onSelect: () => onSelect(it),
        onEdit: () => onForm({ level: "folder", action: "edit", template: it }),
        onDelete: () =>
          onDelete({
            level: "folder",
            apiPath: `/resource-manager/v1/folders/${it.id}`,
            name: it.name,
            resourceLabel: "Folder",
            onSuccess: () => {
              if (selected?.id === it.id && parentCloudId)
                navigate(`/clouds/${parentCloudId}/folders`);
            },
          }),
      }))}
      onCreate={
        parentCloudId
          ? () =>
              onForm({
                level: "folder",
                action: "create",
                template: { name: "", cloud_id: parentCloudId, description: "" },
              })
          : undefined
      }
    />
  );
}

// ====== Crumb primitive ======

interface CrumbItem {
  id: string;
  label: string;
  sub?: string;
  selected: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

interface CrumbProps {
  icon: ReactNode;
  label: string;
  placeholder?: boolean;
  disabled?: boolean;
  loading?: boolean;
  items: CrumbItem[];
  disabledHint?: string;
  onCreate?: () => void;
}

function Crumb({
  icon,
  label,
  placeholder,
  disabled,
  loading,
  items,
  disabledHint,
  onCreate,
}: CrumbProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md hover:bg-accent transition-colors max-w-[200px]",
            disabled && "opacity-50 cursor-not-allowed hover:bg-transparent",
          )}
          title={disabled ? disabledHint : label}
        >
          {icon}
          <span className={cn("truncate", placeholder && "text-muted-foreground italic")}>
            {label}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-30 min-w-[280px] max-h-[60vh] overflow-y-auto rounded-md border border-border bg-background shadow-md p-1"
        >
          {loading && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Загрузка…</div>
          )}
          {!loading && items.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground italic">
              Список пуст. Создайте первый элемент.
            </div>
          )}
          {items.map((it) => (
            <CrumbRow key={it.id} item={it} />
          ))}

          {onCreate && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                onSelect={() => onCreate()}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer outline-none data-[highlighted]:bg-accent text-emerald-700 font-medium"
              >
                <Plus className="h-4 w-4" />
                <span>Create new</span>
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function CrumbRow({ item }: { item: CrumbItem }) {
  const hasActions = !!item.onEdit || !!item.onDelete;
  return (
    <div className="flex items-stretch rounded hover:bg-accent group">
      {/* Select-area — занимает основное место, click → onSelect */}
      <DropdownMenu.Item
        onSelect={() => item.onSelect()}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer outline-none flex-1 min-w-0 rounded",
          "data-[highlighted]:bg-accent",
        )}
      >
        <Check
          className={cn("h-4 w-4 shrink-0", item.selected ? "opacity-100" : "opacity-0")}
        />
        <span className="truncate flex-1">{item.label}</span>
        {item.sub && (
          <span className="text-xs text-muted-foreground font-mono shrink-0">{item.sub}</span>
        )}
      </DropdownMenu.Item>

      {hasActions && (
        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger
            className={cn(
              "flex items-center justify-center px-1.5 rounded outline-none",
              "opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100",
              "data-[highlighted]:bg-accent",
            )}
            onClick={(e) => e.stopPropagation()}
            aria-label="Действия"
          >
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </DropdownMenu.SubTrigger>
          <DropdownMenu.Portal>
            <DropdownMenu.SubContent
              sideOffset={4}
              className="z-40 min-w-[160px] rounded-md border border-border bg-background shadow-md p-1"
            >
              {item.onEdit && (
                <DropdownMenu.Item
                  onSelect={() => item.onEdit?.()}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer outline-none data-[highlighted]:bg-accent"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </DropdownMenu.Item>
              )}
              {item.onDelete && (
                <DropdownMenu.Item
                  onSelect={() => item.onDelete?.()}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer outline-none data-[highlighted]:bg-rose-50 data-[highlighted]:text-rose-900 text-rose-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenu.Item>
              )}
            </DropdownMenu.SubContent>
          </DropdownMenu.Portal>
        </DropdownMenu.Sub>
      )}
    </div>
  );
}

// ====== Form / Delete dialogs (Create+Edit и confirmation) ======

function CrumbFormDialog({
  state,
  onClose,
}: {
  state: FormDialogState;
  onClose: () => void;
}) {
  const spec = REGISTRY[levelToRegistryKey(state.level)];
  if (!spec) return null;

  const tplObj = state.template as { id?: string };
  const apiPath =
    state.action === "create" ? spec.apiPath : `${spec.apiPath}/${tplObj.id ?? ""}`;
  const dialogTitle =
    state.action === "create" ? `Create ${spec.singular}` : `Edit ${spec.singular}`;

  return (
    <ResourceFormDialog
      mode={state.action}
      title={dialogTitle}
      apiPath={apiPath}
      resourceId={spec.id}
      template={state.template}
      fields={spec.fields}
      onSuccess={onClose}
      // Скрытый trigger — auto-open сразу при mount.
      trigger={
        <button
          style={{ display: "none" }}
          aria-hidden
          ref={(el) => {
            // Defer click до mount: запускаем 1 раз
            if (el && !el.dataset.clicked) {
              el.dataset.clicked = "1";
              el.click();
            }
          }}
        />
      }
    />
  );
}

function CrumbDeleteDialog({
  state,
  onClose,
}: {
  state: DeleteDialogState;
  onClose: () => void;
}) {
  const [opId, setOpId] = useState<string | null>(null);
  const invalidate = useInvalidateResourceList();
  const resourceId = levelToRegistryKey(state.level);

  const mutation = useMutation({
    mutationFn: () => api.delete(state.apiPath),
    onSuccess: (resp) => {
      const id = extractOperationId(resp);
      if (id) {
        setOpId(id);
      } else {
        invalidate(resourceId, null);
        state.onSuccess?.();
        onClose();
      }
    },
    onError: (e) => {
      const m = e instanceof ApiError ? `${e.code}: ${e.message}` : (e as Error).message;
      toast.error(`Delete ${state.resourceLabel} ${state.name}: ${m}`);
    },
  });

  const closeIfIdle = () => {
    if (!mutation.isPending && !opId) onClose();
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && closeIfIdle()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить {state.resourceLabel}?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{state.name}</span>
              <br />
              <code className="text-xs text-muted-foreground">{state.apiPath}</code>
              <br />
              Действие необратимо.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => closeIfIdle()}
              disabled={mutation.isPending || opId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || opId !== null}
            >
              {mutation.isPending
                ? "Deleting…"
                : opId !== null
                ? "Выполнение…"
                : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OperationToastWatcher
        opId={opId}
        title={`Deleting ${state.resourceLabel} ${state.name}`}
        onDone={(success) => {
          setOpId(null);
          invalidate(resourceId, null);
          if (success) {
            state.onSuccess?.();
            onClose();
          }
          // При error диалог закрываем (юзер уже сделал выбор), toast показал ошибку.
          else onClose();
        }}
      />
    </>
  );
}

function levelToRegistryKey(l: Level): string {
  if (l === "org") return "organizations";
  if (l === "cloud") return "clouds";
  return "folders";
}
