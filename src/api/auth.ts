// Auth API — обращения к api-gateway endpoints под /iam/v1/auth/*.
//
// Контракт (см. KAC-107 / KAC-104 DoD #1):
//   GET  /iam/v1/auth/login          → 302 redirect на Zitadel /oauth/v2/authorize
//                                      (api-gateway генерирует state + PKCE и хранит в cookie)
//   GET  /iam/v1/auth/callback?code&state
//                                    → api-gateway обменивает code на JWT, ставит httpOnly
//                                      session cookie, 302 на `/`.
//                                      Альтернативно: UI шлёт sам POST на этот endpoint —
//                                      используем GET-redirect через `window.location` (см. login()).
//   GET  /iam/v1/auth/me             → 200 {user, permissions[]} | 401 если нет cookie
//   POST /iam/v1/auth/logout         → 204, clear cookie
//
// Все запросы — `credentials: 'include'` для httpOnly session cookie.
// На E0 (Zitadel выключен) — endpoint /iam/v1/auth/me вернёт 401 или 404,
// AuthContext грациозно отрисует `user=null` и покажет LoginButton.

import { camelToSnake } from "@/lib/case";

export type SubjectType = "user" | "service_account" | "system";

export interface AuthUser {
  /** Внутренний User.id (`usr-...`) либо ServiceAccount.id (`sva-...`). */
  id: string;
  /** Display name из Zitadel (email или ФИО). */
  display_name?: string;
  email?: string;
  subject_type: SubjectType;
  /** Account.id (если default-account резолвится). E0 — может быть пусто. */
  account_id?: string;
  /** Effective permissions (E3 OpenFGA). E0 — может быть пусто или содержать `*` для admin. */
  permissions?: string[];
}

export interface AuthMeResponse {
  user: AuthUser;
}

async function fetchAuth<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(camelToSnake(body));
  }
  const res = await fetch(path, init);
  if (!res.ok) {
    // 401 — нормальный «не залогинен» сигнал, не Error.
    const err = new Error(`${res.status} ${res.statusText}`) as Error & {
      status: number;
    };
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const authApi = {
  /** Начать OIDC-flow — full-page redirect на api-gateway /iam/v1/auth/login. */
  login(): void {
    // Не XHR — нужен 302 redirect на Zitadel. Используем `window.location.assign`,
    // api-gateway ставит state-cookie и редиректит дальше.
    window.location.assign("/iam/v1/auth/login");
  },

  /** Завершить OIDC-flow — POST code+state в api-gateway, получить session cookie. */
  callback(code: string, state: string): Promise<void> {
    return fetchAuth<void>(
      "POST",
      `/iam/v1/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    );
  },

  /** Получить текущего user'а. 401 → AuthContext выставит user=null. */
  me(): Promise<AuthMeResponse> {
    return fetchAuth<AuthMeResponse>("GET", "/iam/v1/auth/me");
  },

  /** Сбросить session cookie. */
  logout(): Promise<void> {
    return fetchAuth<void>("POST", "/iam/v1/auth/logout");
  },
};

/** Проверка permission, толерантная к admin `*` wildcard. */
export function hasPermission(user: AuthUser | null, perm: string): boolean {
  if (!user) return false;
  const perms = user.permissions ?? [];
  return perms.includes("*") || perms.includes(perm);
}
