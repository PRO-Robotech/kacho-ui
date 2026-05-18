// Auth API — обращения к Ory Kratos self-service endpoints + api-gateway /iam/v1/auth/me.
//
// Контракт (KAC-115 Ory stack):
//   GET  /login                       → Kratos self-service Login UI
//                                       (Kratos выставляет ory_kratos_session cookie)
//   GET  /registration                → Kratos self-service Registration UI
//   GET  /.ory/kratos/public/sessions/whoami
//                                    → 200 session.identity | 401 если cookie не валидна
//   GET  /iam/v1/auth/me             → 200 {user, permissions[]} | 401 если нет session
//                                       (api-gateway резолвит principal по Kratos session)
//   GET  /logout                      → Kratos self-service logout flow (token-based)
//
// Все запросы — `credentials: 'include'` для cookie ory_kratos_session.

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
  /** Перейти на Kratos self-service login page. */
  login(): void {
    window.location.assign("/login");
  },

  /** Перейти на Kratos self-service registration page. */
  register(): void {
    window.location.assign("/registration");
  },

  /** Получить текущего user'а. 401 → AuthContext выставит user=null. */
  me(): Promise<AuthMeResponse> {
    return fetchAuth<AuthMeResponse>("GET", "/iam/v1/auth/me");
  },

  /** Запустить Kratos logout flow — POST к /.ory/kratos/public/self-service/logout/browser
   * сначала получит logout_token, потом редирект на logout-url. Простейший вариант — full-page nav. */
  logout(): void {
    window.location.assign("/.ory/kratos/public/self-service/logout/browser");
  },
};

/** Проверка permission, толерантная к admin `*` wildcard. */
export function hasPermission(user: AuthUser | null, perm: string): boolean {
  if (!user) return false;
  const perms = user.permissions ?? [];
  return perms.includes("*") || perms.includes(perm);
}
