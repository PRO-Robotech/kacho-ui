// Минимальный store без zustand: useSyncExternalStore + localStorage.
// Хранит выбранный folder UID + name для отображения; используется FolderSelector + страницами.

import { useSyncExternalStore } from "react";

const KEY = "kacho.folder.v1";

interface FolderRef {
  uid: string;
  name: string;
  cloudId?: string;
  organizationId?: string;
}

interface State {
  folder: FolderRef | null;
}

let state: State = load();
const listeners = new Set<() => void>();

function load(): State {
  if (typeof window === "undefined") return { folder: null };
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { folder: null };
  } catch {
    return { folder: null };
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

export const folderStoreApi = {
  get: () => state,
  set: (folder: FolderRef | null) => setState({ folder }),
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useFolderStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    folderStoreApi.subscribe,
    () => selector(state),
    () => selector(state),
  );
}
