// Context store: Account → Project breadcrumb-state.
//
// KAC-117: модель Account/Project замещает Organization/Cloud/Folder
// (см. workspace CLAUDE.md «Что это за проект» — Account = top-level tenant,
// Project = child Account). Old Org/Cloud/Folder selectors удалены из UI,
// но `folder` field остаётся как **read-only alias на project**, чтобы
// legacy-страницы (useFolderStore, folder.id) продолжали работать без правок.
//
// Persist в localStorage (`kacho.context.v2`).

import { useSyncExternalStore } from "react";

export interface AccountRef {
  id: string;
  name: string;
}

export interface ProjectRef {
  id: string;
  name: string;
  accountId: string;
}

/**
 * FolderRef — legacy-alias на ProjectRef для backward-compat (см. shape `useFolderStore`).
 * После полного refactor'а можно удалить.
 */
export interface FolderRef {
  id: string;
  name: string;
  // Mapped: project.accountId
  cloudId: string;
  // Mapped: project.accountId (Org collapsed)
  organizationId: string;
  uid: string;
}

// Старые типы (re-exported для совместимости, чтобы импорты не ломались).
export type OrgRef = AccountRef;
export type CloudRef = ProjectRef;

interface State {
  account: AccountRef | null;
  project: ProjectRef | null;
  // Derived legacy aliases (KAC-117 backward-compat — useFolderStore,
  // useContext(s => s.cloud/org)).
  folder: FolderRef | null;
  org: AccountRef | null;
  cloud: (ProjectRef & { organizationId: string }) | null;
}

const KEY = "kacho.context.v2";

function projectToFolder(p: ProjectRef | null): FolderRef | null {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    cloudId: p.accountId,
    organizationId: p.accountId,
    uid: p.id,
  };
}

function migrateV1ToV2(raw: any): State {
  // KAC-117 migration: старая v1-форма {org, cloud, folder} → v2 {account, project}.
  const oldFolder = raw?.folder;
  const oldCloud = raw?.cloud;
  if (oldFolder?.id) {
    const project: ProjectRef = {
      id: oldFolder.id,
      name: oldFolder.name ?? "",
      accountId: oldCloud?.id ?? "",
    };
    const account = oldCloud ? { id: oldCloud.id, name: oldCloud.name ?? "" } : null;
    return composeState(account, project);
  }
  return emptyState();
}

function composeState(account: AccountRef | null, project: ProjectRef | null): State {
  return {
    account,
    project,
    folder: projectToFolder(project),
    org: account,
    cloud: project ? { ...project, organizationId: project.accountId } : null,
  };
}

function emptyState(): State {
  return { account: null, project: null, folder: null, org: null, cloud: null };
}

function load(): State {
  if (typeof window === "undefined") return emptyState();
  try {
    // Сначала пытаемся v2.
    const raw2 = window.localStorage.getItem(KEY);
    if (raw2) {
      const parsed = JSON.parse(raw2);
      return composeState(parsed.account ?? null, parsed.project ?? null);
    }
    // Fallback на v1 (если был).
    const raw1 = window.localStorage.getItem("kacho.context.v1");
    if (raw1) {
      const migrated = migrateV1ToV2(JSON.parse(raw1));
      window.localStorage.setItem(KEY, JSON.stringify({ account: migrated.account, project: migrated.project }));
      return migrated;
    }
  } catch {
    // ignore
  }
  return emptyState();
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ account: state.account, project: state.project }));
  } catch {
    // ignore
  }
}

function setState(next: { account: AccountRef | null; project: ProjectRef | null }) {
  state = {
    ...next,
    folder: projectToFolder(next.project),
    org: next.account,
    cloud: next.project
      ? { ...next.project, organizationId: next.project.accountId }
      : null,
  };
  persist();
  listeners.forEach((l) => l());
}

export const contextApi = {
  get: () => state,

  setAccount(account: AccountRef | null) {
    // Сменили Account — сбрасываем Project.
    setState({ account, project: null });
  },

  setProject(project: ProjectRef | null) {
    if (!project) {
      setState({ account: state.account, project: null });
      return;
    }
    // KAC-120: если проект из другого Account — переключаем account-ref на новый id
    // (name догрузится через ContextUrlSync hydration). Это решает проблему "выбор
    // аккаунта не работает" — теперь setProject автоматически syncs Account.
    const account =
      state.account && state.account.id === project.accountId
        ? state.account
        : { id: project.accountId, name: "" }; // name fresh из hydration
    setState({ account, project });
  },

  /** Patch — обновить отдельные поля без сброса потомков. */
  hydrate(patch: { account?: Partial<AccountRef>; project?: Partial<ProjectRef> }) {
    const next: { account: AccountRef | null; project: ProjectRef | null } = {
      account: state.account,
      project: state.project,
    };
    if (patch.account) {
      if (state.account) {
        next.account = { ...state.account, ...patch.account };
      } else if (patch.account.id) {
        next.account = { id: patch.account.id, name: patch.account.name ?? "" };
      }
    }
    if (patch.project && state.project) {
      next.project = { ...state.project, ...patch.project };
    } else if (patch.project?.id) {
      next.project = {
        id: patch.project.id,
        name: patch.project.name ?? "",
        accountId: patch.project.accountId ?? state.account?.id ?? "",
      };
    }
    setState(next);
  },

  // Legacy aliases (KAC-117 backward-compat).
  setOrg(org: AccountRef | null) {
    contextApi.setAccount(org);
  },
  setCloud(cloud: ProjectRef | null) {
    contextApi.setProject(cloud);
  },
  setFolder(folder: FolderRef | null) {
    if (!folder) {
      contextApi.setProject(null);
      return;
    }
    contextApi.setProject({
      id: folder.id,
      name: folder.name,
      accountId: folder.cloudId || folder.organizationId || state.account?.id || "",
    });
  },

  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useContext<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    contextApi.subscribe,
    () => selector(state),
    () => selector(state),
  );
}

// Project store (preferred).
export function useProjectStore<T>(selector: (s: { project: ProjectRef | null }) => T): T {
  return useSyncExternalStore(
    contextApi.subscribe,
    () => selector({ project: state.project }),
    () => selector({ project: state.project }),
  );
}

// Backward-compat: useFolderStore(s => s.folder) — старые страницы используют это.
export function useFolderStore<T>(selector: (s: { folder: FolderRef | null }) => T): T {
  return useSyncExternalStore(
    contextApi.subscribe,
    () => selector({ folder: state.folder }),
    () => selector({ folder: state.folder }),
  );
}

export const folderStoreApi = {
  set: (folder: FolderRef | null) => contextApi.setFolder(folder),
};
