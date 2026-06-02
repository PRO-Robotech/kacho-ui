// KAC-246: persisted collapse-state расширенного сайдбара.
//
// Чистая логика чтения/записи в localStorage вынесена в read/write-хелперы
// (юнит-тестируемы), а сам хук — тонкая обёртка с useState + setter, который
// синхронит state и localStorage.

import { useCallback, useState } from "react";

export const SIDEBAR_COLLAPSED_KEY = "kacho-sidebar-collapsed";

/** Прочитать persisted collapse-флаг. Дефолт — развёрнут (false). */
export function readSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Записать collapse-флаг в localStorage. Ошибки storage — глотаем. */
export function writeSidebarCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // ignore (private mode / quota)
  }
}

/** Хук collapse-состояния сайдбара: [collapsed, toggle, setCollapsed]. */
export function useSidebarCollapsed(): [boolean, () => void, (v: boolean) => void] {
  const [collapsed, setCollapsedState] = useState<boolean>(() => readSidebarCollapsed());

  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v);
    writeSidebarCollapsed(v);
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      writeSidebarCollapsed(next);
      return next;
    });
  }, []);

  return [collapsed, toggle, setCollapsed];
}
