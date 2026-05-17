// AuthContext — React-контекст для текущего user'а (из OIDC-сессии).
//
// На mount делает `GET /iam/v1/auth/me` (с credentials: 'include' для httpOnly
// session cookie). 200 → `user`, 401 / network-fail → `user=null` (не залогинен).
//
// API:
//   const { user, loading, login, logout, refresh } = useAuth();
//   if (loading) return <Spinner/>;
//   if (!user) return <LoginButton/>;
//
// На E0 (Zitadel не задеплоен) endpoint /iam/v1/auth/me вернёт 401 / 404 —
// UI грациозно отрисует state «не залогинен» (показ Login-кнопки) без поломок.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi, hasPermission as checkPerm, type AuthUser } from "@/api/auth";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  /** Старт OIDC-flow (full-page redirect). */
  login: () => void;
  /** Очистить session cookie + сбросить state. */
  logout: () => void;
  /** Принудительно перезапросить /me (после callback). */
  refresh: () => Promise<void>;
  /** Хелпер: проверить permission у текущего user'а. */
  hasPermission: (perm: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const resp = await authApi.me();
      setUser(resp.user ?? null);
    } catch {
      // 401 / network — нормальный «не залогинен», не пугаем consoles.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(() => {
    authApi.login();
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    // Full-page navigation на Kratos logout flow — он сам сбросит cookie + редирект.
    authApi.logout();
  }, []);

  const hasPermission = useCallback(
    (perm: string) => checkPerm(user, perm),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout, refresh, hasPermission }),
    [user, loading, login, logout, refresh, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook для доступа к auth state. Выбрасывает, если вызван вне AuthProvider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
