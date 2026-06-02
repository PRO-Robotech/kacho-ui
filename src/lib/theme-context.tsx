// KAC-246: ThemeProvider + useThemeMode — runtime-переключатель dark/light.
//
// Начальное значение: localStorage `kacho-theme` → prefers-color-scheme: light →
// иначе "dark". setMode пишет localStorage и ставит document.documentElement.
// dataset.theme = mode (это активирует :root[data-theme="…"] CSS-vars в index.css).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ThemeMode } from "@/lib/theme";

const STORAGE_KEY = "kacho-theme";

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Резолвит начальный режим: localStorage → prefers-color-scheme → dark. */
function resolveInitialMode(): ThemeMode {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") return stored;
    } catch {
      // localStorage недоступен (private mode / SSR) — игнорируем.
    }
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: light)").matches
    ) {
      return "light";
    }
  }
  return "dark";
}

/** Пишет dataset.theme на <html> — активирует CSS-vars соответствующей темы. */
function applyDatasetTheme(mode: ThemeMode) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = mode;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(resolveInitialMode);

  // Синхронизируем <html data-theme> при mount и на каждое изменение mode.
  useEffect(() => {
    applyDatasetTheme(mode);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage недоступен — тема всё равно применится через dataset.
    }
    applyDatasetTheme(next);
  }, []);

  const toggle = useCallback(() => {
    setModeState((cur) => {
      const next: ThemeMode = cur === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      applyDatasetTheme(next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, setMode, toggle }),
    [mode, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeMode must be used within <ThemeProvider>");
  }
  return ctx;
}
