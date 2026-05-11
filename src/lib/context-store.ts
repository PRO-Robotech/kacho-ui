// Context store: Org → Cloud → Folder breadcrumb-state.
// Каждый уровень — ссылка на ресурс + parent-id для фильтрации в дочерних API-вызовах.
// Persist в localStorage.

import { useSyncExternalStore } from "react";

export interface OrgRef {
  id: string;
  name: string;
}

export interface CloudRef {
  id: string;
  name: string;
  organizationId: string;
}

export interface FolderRef {
  id: string;
  name: string;
  cloudId: string;
  organizationId: string;
  // Backward-compat alias для существующего кода (folder.uid)
  uid: string;
}

interface State {
  org: OrgRef | null;
  cloud: CloudRef | null;
  folder: FolderRef | null;
}

const KEY = "kacho.context.v1";

let state: State = load();
const listeners = new Set<() => void>();

function load(): State {
  if (typeof window === "undefined") return { org: null, cloud: null, folder: null };
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { org: null, cloud: null, folder: null };
  } catch {
    return { org: null, cloud: null, folder: null };
  }
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function setState(next: State) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

export const contextApi = {
  get: () => state,

  // Установка Org — сбрасывает Cloud + Folder.
  setOrg(org: OrgRef | null) {
    setState({ org, cloud: null, folder: null });
  },
  // Установка Cloud — сбрасывает Folder. Если cloud.organizationId не совпадает
  // с текущим org — обновляем org через id (но без name; UI всё равно перезальёт).
  setCloud(cloud: CloudRef | null) {
    if (!cloud) {
      setState({ ...state, cloud: null, folder: null });
      return;
    }
    const org =
      state.org && state.org.id === cloud.organizationId
        ? state.org
        : { id: cloud.organizationId, name: state.org?.name ?? "" };
    setState({ org, cloud, folder: null });
  },
  // Установка Folder — обновляет cloud + org контекст из folder.
  setFolder(folder: FolderRef | null) {
    if (!folder) {
      setState({ ...state, folder: null });
      return;
    }
    const org =
      state.org && state.org.id === folder.organizationId
        ? state.org
        : { id: folder.organizationId, name: state.org?.name ?? "" };
    const cloud =
      state.cloud && state.cloud.id === folder.cloudId
        ? state.cloud
        : { id: folder.cloudId, name: state.cloud?.name ?? "", organizationId: folder.organizationId };
    setState({ org, cloud, folder });
  },

  /** Patch — обновить отдельные поля org/cloud/folder без сброса потомков.
   *  Используется для hydration после прямого URL: догрузить name/parent
   *  не теряя текущий folder selection. Если уровень ещё не установлен и
   *  patch содержит id — создаём с пустыми остальными полями. */
  hydrate(patch: { org?: Partial<OrgRef>; cloud?: Partial<CloudRef>; folder?: Partial<FolderRef> }) {
    const next: State = { ...state };
    if (patch.org) {
      if (state.org) {
        next.org = { ...state.org, ...patch.org };
      } else if (patch.org.id) {
        next.org = { id: patch.org.id, name: patch.org.name ?? "" };
      }
    }
    if (patch.cloud) {
      if (state.cloud) {
        next.cloud = { ...state.cloud, ...patch.cloud };
      } else if (patch.cloud.id) {
        next.cloud = {
          id: patch.cloud.id,
          name: patch.cloud.name ?? "",
          organizationId: patch.cloud.organizationId ?? "",
        };
      }
    }
    if (patch.folder && state.folder) {
      next.folder = { ...state.folder, ...patch.folder };
    }
    setState(next);
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
