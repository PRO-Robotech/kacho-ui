// BreadcrumbSelector — Account → Project breadcrumbs (pills).
//
// KAC-117: модель Organization/Cloud/Folder заменена на Account/Project
// (workspace CLAUDE.md «Что это за проект»: Account = top-level tenant,
// Project = child Account). Old Org/Cloud/Folder селекторы удалены.
//
// Каждая крошка — dropdown со списком + Create-кнопка (navigate to /iam/...)
// + per-row Edit/Delete.

import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import {
  Building,
  ChevronDown,
  FolderOpen,
  Check,
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { api } from "@/api/client";
import {
  contextApi,
  useContext,
  type AccountRef,
  type ProjectRef,
} from "@/lib/context-store";
import { cn } from "@/lib/utils";
import { DeleteDialog } from "@/components/DeleteDialog";
import { CopyableId } from "@/components/CopyableId";

const ACCOUNT_API_PATH = "/iam/v1/accounts";
const PROJECT_API_PATH = "/iam/v1/projects";

interface DeleteState {
  apiPath: string;
  name: string;
  resourceId: string;
  resourceLabel: string;
  onSuccess?: () => void;
}

export function BreadcrumbSelector() {
  const account = useContext((s) => s.account);
  const project = useContext((s) => s.project);
  const navigate = useNavigate();

  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);

  const goAccount = (id: string, name: string) => {
    contextApi.setAccount({ id, name });
    navigate(`/accounts/${id}/projects`);
  };
  const goProject = (id: string, name: string, accountId: string) => {
    contextApi.setProject({ id, name, accountId });
    navigate(`/projects/${id}/dashboard`);
  };

  return (
    <>
      <div className="flex items-center gap-1.5 text-sm">
        <AccountCrumb
          current={account}
          onSelect={goAccount}
          onDelete={(a) =>
            setDeleteState({
              apiPath: `${ACCOUNT_API_PATH}/${a.id}`,
              name: a.name,
              resourceId: a.id,
              resourceLabel: "аккаунт",
              onSuccess: () => {
                if (account?.id === a.id) contextApi.setAccount(null);
              },
            })
          }
        />
        {account ? (
          <>
            <ChevronDown className="size-3.5 -rotate-90 text-zinc-500" />
            <ProjectCrumb
              current={project}
              accountId={account.id}
              onSelect={(id, name) => goProject(id, name, account.id)}
              onDelete={(p) =>
                setDeleteState({
                  apiPath: `${PROJECT_API_PATH}/${p.id}`,
                  name: p.name,
                  resourceId: p.id,
                  resourceLabel: "проект",
                  onSuccess: () => {
                    if (project?.id === p.id) contextApi.setProject(null);
                  },
                })
              }
            />
          </>
        ) : null}
      </div>
      {deleteState ? (
        <DeleteDialog
          open
          onOpenChange={(o) => {
            if (!o) setDeleteState(null);
          }}
          name={deleteState.name}
          resourceId={deleteState.resourceId}
          resourceLabel={deleteState.resourceLabel}
          apiPath={deleteState.apiPath}
          onSuccess={() => {
            deleteState.onSuccess?.();
            setDeleteState(null);
          }}
        />
      ) : null}
    </>
  );
}

// ── AccountCrumb ────────────────────────────────────────────────────────────

interface AccountCrumbProps {
  current: AccountRef | null;
  onSelect: (id: string, name: string) => void;
  onDelete: (a: { id: string; name: string }) => void;
}

function AccountCrumb({ current, onSelect, onDelete }: AccountCrumbProps) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["accounts-crumb"],
    queryFn: async () => {
      const r = await api.get<{ accounts: Array<{ id: string; name: string }> }>(ACCOUNT_API_PATH);
      return r.accounts ?? [];
    },
    staleTime: 30_000,
  });

  return (
    <Crumb
      icon={<Building className="size-4" />}
      label={current?.name || "Выберите аккаунт"}
      labelMuted={!current}
    >
      <DropdownMenu.Label className="px-2 py-1 text-xs text-zinc-500">
        Аккаунты {isLoading ? "(загрузка...)" : ""}
      </DropdownMenu.Label>
      {(data ?? []).map((a) => (
        <DropdownRow
          key={a.id}
          name={a.name}
          id={a.id}
          selected={current?.id === a.id}
          onClick={() => onSelect(a.id, a.name)}
          onEdit={() => navigate(`/iam/accounts?modal=accounts-edit&id=${a.id}`)}
          onDelete={() => onDelete({ id: a.id, name: a.name })}
        />
      ))}
      <DropdownMenu.Separator className="my-1 h-px bg-zinc-700" />
      <DropdownMenu.Item
        onClick={() => navigate("/iam/accounts?modal=accounts-create")}
        className="cursor-pointer rounded px-2 py-1.5 text-sm hover:bg-zinc-700/50 flex items-center gap-2"
      >
        <Plus className="size-4" />
        Создать аккаунт
      </DropdownMenu.Item>
    </Crumb>
  );
}

// ── ProjectCrumb ────────────────────────────────────────────────────────────

interface ProjectCrumbProps {
  current: ProjectRef | null;
  accountId: string;
  onSelect: (id: string, name: string) => void;
  onDelete: (p: { id: string; name: string }) => void;
}

function ProjectCrumb({ current, accountId, onSelect, onDelete }: ProjectCrumbProps) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["projects-crumb", accountId],
    queryFn: async () => {
      const r = await api.get<{ projects: Array<{ id: string; name: string; accountId: string }> }>(
        `${PROJECT_API_PATH}?accountId=${encodeURIComponent(accountId)}`,
      );
      return r.projects ?? [];
    },
    enabled: !!accountId,
    staleTime: 30_000,
  });

  return (
    <Crumb
      icon={<FolderOpen className="size-4" />}
      label={current?.name || "Выберите проект"}
      labelMuted={!current}
    >
      <DropdownMenu.Label className="px-2 py-1 text-xs text-zinc-500">
        Проекты {isLoading ? "(загрузка...)" : ""}
      </DropdownMenu.Label>
      {(data ?? []).map((p) => (
        <DropdownRow
          key={p.id}
          name={p.name}
          id={p.id}
          selected={current?.id === p.id}
          onClick={() => onSelect(p.id, p.name)}
          onEdit={() => navigate(`/iam/projects?modal=projects-edit&id=${p.id}`)}
          onDelete={() => onDelete({ id: p.id, name: p.name })}
        />
      ))}
      <DropdownMenu.Separator className="my-1 h-px bg-zinc-700" />
      <DropdownMenu.Item
        onClick={() =>
          navigate(`/iam/projects?modal=projects-create&accountId=${encodeURIComponent(accountId)}`)
        }
        className="cursor-pointer rounded px-2 py-1.5 text-sm hover:bg-zinc-700/50 flex items-center gap-2"
      >
        <Plus className="size-4" />
        Создать проект
      </DropdownMenu.Item>
    </Crumb>
  );
}

// ── Crumb shell ─────────────────────────────────────────────────────────────

function Crumb({
  icon,
  label,
  labelMuted,
  children,
}: {
  icon: ReactNode;
  label: string;
  labelMuted?: boolean;
  children: ReactNode;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-zinc-700/40 text-sm",
          labelMuted ? "text-zinc-500" : "text-zinc-100",
        )}
      >
        {icon}
        <span>{label}</span>
        <ChevronDown className="size-3.5 opacity-70" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-50 min-w-[260px] max-h-[400px] overflow-auto rounded-md border border-zinc-700 bg-zinc-900 p-1 shadow-lg"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function DropdownRow({
  name,
  id,
  selected,
  onClick,
  onEdit,
  onDelete,
}: {
  name: string;
  id: string;
  selected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-zinc-700/50">
      <button
        onClick={onClick}
        className="flex flex-1 items-center gap-2 text-left text-sm"
      >
        {selected ? <Check className="size-3.5 text-emerald-400" /> : <span className="size-3.5" />}
        <span className="truncate">{name || id}</span>
      </button>
      <CopyableId id={id} className="text-xs opacity-60" />
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-zinc-600/50">
          <MoreVertical className="size-3.5" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={2}
            className="z-[60] min-w-[120px] rounded-md border border-zinc-700 bg-zinc-900 p-1 shadow-lg"
          >
            <DropdownMenu.Item
              onClick={onEdit}
              className="cursor-pointer rounded px-2 py-1.5 text-sm hover:bg-zinc-700/50 flex items-center gap-2"
            >
              <Pencil className="size-3.5" />
              Изменить
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onClick={onDelete}
              className="cursor-pointer rounded px-2 py-1.5 text-sm hover:bg-zinc-700/50 text-red-400 flex items-center gap-2"
            >
              <Trash2 className="size-3.5" />
              Удалить
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
