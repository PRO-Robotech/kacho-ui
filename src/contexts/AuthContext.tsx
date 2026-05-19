// AuthContext — централизованный auth state для kacho-ui (KAC-127 Phase 2).
//
// Что внутри:
//   - user / session (из api-gateway /iam/v1/auth/me + Kratos /sessions/whoami)
//   - access-token (in-memory только; никогда не в localStorage)
//   - mfaFreshUntil (timestamp) — для step-up RequireMFAFresh-guard
//   - login() / logout() / refresh() — высокоуровневые actions
//
// Подключает `apiClient` (см. lib/api-client.ts) — настраивает callbacks для:
//   - getAccessToken — отдаёт текущий in-memory token
//   - onTokenExpired — refresh через Kratos whoami (session cookie) +
//     Hydra refresh-token (httpOnly cookie). На E2 — single-source-of-truth.
//   - onStepUpRequired — открывает StepUpModal и ждёт success
//
// Backward-compat для KAC-115 (Logout, HeaderAuth, LoginButton, UserMenu) —
// `useAuth` экспозит те же поля `user / loading / login / logout / refresh /
// hasPermission` плюс новые расширения. Старые consumers продолжают работать.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { authApi, hasPermission as checkPerm, type AuthUser } from "@/api/auth";
import { kratos, type KratosSession } from "@/lib/kratos";
import { apiClient } from "@/lib/api-client";
import { clearDpopKeyPair, ensureDpopKeyPair } from "@/lib/dpop";
import { config } from "@/lib/config";

export interface AuthContextValue {
  user: AuthUser | null;
  session: KratosSession | null;
  loading: boolean;
  accessToken: string | null;
  /** Unix-seconds timestamp, до которого MFA «свежий». */
  mfaFreshUntil: number;

  /** Старт self-service login flow (Kratos browser redirect). */
  login: (returnTo?: string) => void;
  /** Logout: Kratos token-flow + Hydra BCL + clear DPoP key. */
  logout: () => Promise<void>;
  /** Перезапросить /me + whoami. */
  refresh: () => Promise<void>;
  /** Установить access-token (после Hydra token-exchange). */
  setAccessToken: (token: string | null) => void;
  /** Установить mfa-fresh timestamp (после успешного step-up). */
  markMfaFresh: (ttlSec?: number) => void;
  /** Проверка permission (admin `*` wildcard). */
  hasPermission: (perm: string) => boolean;
  /** Зарегистрировать step-up handler — обычно StepUpModal. */
  setStepUpHandler: (handler: ((acr?: string) => Promise<void>) | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<KratosSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [mfaFreshUntil, setMfaFreshUntil] = useState<number>(0);

  // Refs для apiClient callbacks (mutable без re-render-ов).
  const tokenRef = useRef<string | null>(null);
  const stepUpHandlerRef = useRef<((acr?: string) => Promise<void>) | null>(null);

  tokenRef.current = accessToken;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [meResp, whoamiResp] = await Promise.allSettled([
        authApi.me(),
        kratos.whoami(),
      ]);
      if (meResp.status === "fulfilled") {
        setUser(meResp.value.user ?? null);
      } else {
        setUser(null);
      }
      if (whoamiResp.status === "fulfilled") {
        setSession(whoamiResp.value);
        // Kratos AAL2 → considered MFA-fresh; user_verification флаг — на бэке.
        if (whoamiResp.value?.authenticator_assurance_level === "aal2") {
          const lastAuth =
            new Date(whoamiResp.value.authenticated_at).getTime() / 1000;
          setMfaFreshUntil(lastAuth + config.mfaFreshTtlMin * 60);
        }
      } else {
        setSession(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Init: keypair + initial refresh + apiClient hookup.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureDpopKeyPair();
      } catch {
        // WebCrypto / IDB недоступны (private window?) — продолжаем без DPoP.
      }
      apiClient.configure({
        getAccessToken: () => tokenRef.current,
        onTokenExpired: async () => {
          // Стратегия: re-fetch /me — Kratos session cookie должна выписать
          // новый access-token через Hydra refresh-flow (api-gateway middleware).
          // Если /me возвращает 401 — token не обновился, user должен залогиниться.
          try {
            const resp = await authApi.me();
            if (resp?.user) {
              await refresh();
              return tokenRef.current;
            }
          } catch {
            // fallthrough
          }
          return null;
        },
        onStepUpRequired: async (acr?: string) => {
          const handler = stepUpHandlerRef.current;
          if (!handler) {
            window.location.assign(
              kratos.loginUrl(window.location.pathname + window.location.search),
            );
            return;
          }
          await handler(acr);
        },
      });
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const login = useCallback((returnTo?: string) => {
    window.location.assign(kratos.loginUrl(returnTo));
  }, []);

  const logout = useCallback(async () => {
    try {
      const { logout_token } = await kratos.initLogout();
      await kratos.submitLogout(logout_token);
    } catch {
      // Session уже истекла — игнорируем.
    }
    await clearDpopKeyPair();
    setUser(null);
    setSession(null);
    setAccessTokenState(null);
    tokenRef.current = null;
    setMfaFreshUntil(0);
    try {
      authApi.logout();
    } catch {
      window.location.assign("/");
    }
  }, []);

  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    tokenRef.current = token;
  }, []);

  const markMfaFresh = useCallback((ttlSec?: number) => {
    const ttl = ttlSec ?? config.mfaFreshTtlMin * 60;
    setMfaFreshUntil(Math.floor(Date.now() / 1000) + ttl);
  }, []);

  const hasPermission = useCallback(
    (perm: string) => checkPerm(user, perm),
    [user],
  );

  const setStepUpHandler = useCallback(
    (handler: ((acr?: string) => Promise<void>) | null) => {
      stepUpHandlerRef.current = handler;
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      accessToken,
      mfaFreshUntil,
      login,
      logout,
      refresh,
      setAccessToken,
      markMfaFresh,
      hasPermission,
      setStepUpHandler,
    }),
    [
      user,
      session,
      loading,
      accessToken,
      mfaFreshUntil,
      login,
      logout,
      refresh,
      setAccessToken,
      markMfaFresh,
      hasPermission,
      setStepUpHandler,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook для доступа к auth state. Throws вне AuthProvider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}

/** True если MFA свежий (для RequireMFAFresh guard). */
export function isMfaFresh(value: { mfaFreshUntil: number }): boolean {
  return value.mfaFreshUntil > Math.floor(Date.now() / 1000);
}
