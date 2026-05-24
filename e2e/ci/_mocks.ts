// e2e/ci — backend-free Playwright тесты для CI.
//
// UI обслуживается `vite preview` (см. playwright.ci.config.ts), весь REST
// (`/iam/v1/*`, `/vpc/v1/*`, `/compute/v1/*`, Kratos whoami) перехватывается
// `page.route` и отдаётся фикстурами. Поэтому тесты не требуют ни kind-стенда,
// ни авторизации, ни seed-данных — гоняются в рамках обычной CI-сборки.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import type { Page } from "@playwright/test";

// SPA shell — собранный dist/index.html. `vite preview` проксирует domain-
// prefixed пути (`/iam`, `/vpc`, `/compute`, `/operations`) на api-gateway
// (см. vite.config.ts server.proxy). Поэтому ПРЯМОЙ переход браузера на
// SPA-маршрут `/iam/users` уходит в proxy → ECONNREFUSED (бэкенда в CI нет) →
// 500, SPA не грузится. Перехватываем navigation-документ и отдаём index.html;
// React Router дальше отрабатывает client-side по той же URL.
const SPA_INDEX_HTML = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dist/index.html"),
  "utf-8",
);

// ─── Фикстуры IAM ────────────────────────────────────────────────────────────
export const ACCOUNT = {
  id: "acctest0000000000001",
  name: "e2e-account",
  description: "playwright fixture account",
  owner_user_id: "usrtest0000000000001",
  created_at: "2026-05-20T10:00:00Z",
};

export const PROJECTS = [
  { id: "prjtest0000000000001", account_id: ACCOUNT.id, name: "e2e-project-alpha", created_at: "2026-05-20T10:01:00Z" },
  { id: "prjtest0000000000002", account_id: ACCOUNT.id, name: "e2e-project-beta", created_at: "2026-05-20T10:02:00Z" },
  { id: "prjtest0000000000003", account_id: ACCOUNT.id, name: "e2e-project-gamma", created_at: "2026-05-20T10:03:00Z" },
];

export const USERS = [
  { id: "usrtest0000000000001", email: "admin@kacho.local", display_name: "Admin Kacho", account_id: ACCOUNT.id, invite_status: "ACTIVE", created_at: "2026-05-20T09:00:00Z" },
  { id: "usrtest0000000000002", email: "dev@kacho.local", display_name: "Dev User", account_id: ACCOUNT.id, invite_status: "PENDING", created_at: "2026-05-20T09:30:00Z" },
];

export const SERVICE_ACCOUNTS = [
  { id: "svatest0000000000001", account_id: ACCOUNT.id, name: "ci-bot", description: "CI service account", created_at: "2026-05-20T10:10:00Z" },
];

export const GROUPS = [
  { id: "grptest0000000000001", account_id: ACCOUNT.id, name: "developers", description: "dev group", created_at: "2026-05-20T10:20:00Z" },
];

export const ROLES = [
  { id: "role.system.admin", name: "admin", description: "system administrator", is_system: true, permissions: ["*"], created_at: "2026-05-01T00:00:00Z" },
  { id: "role.system.viewer", name: "viewer", description: "read-only", is_system: true, permissions: ["*.get", "*.list"], created_at: "2026-05-01T00:00:00Z" },
  { id: "roletest0000000000001", account_id: ACCOUNT.id, name: "custom-vpc-editor", description: "custom role", is_system: false, permissions: ["vpc.networks.read", "vpc.subnets.write"], created_at: "2026-05-20T10:30:00Z" },
];

export const ACCESS_BINDINGS = [
  { id: "abtest00000000000001", subject_type: "user", subject_id: USERS[0].id, role_id: "role.system.admin", resource_type: "account", resource_id: ACCOUNT.id, created_at: "2026-05-20T10:40:00Z" },
];

const KRATOS_SESSION = {
  id: "sess-e2e",
  active: true,
  expires_at: "2099-01-01T00:00:00Z",
  authenticated_at: "2026-05-20T10:00:00Z",
  authenticator_assurance_level: "aal1",
  identity: {
    id: USERS[0].id,
    schema_id: "default",
    traits: { email: USERS[0].email, name: { first: "Admin", last: "Kacho" } },
  },
};

const AUTH_ME = {
  user: { id: USERS[0].id, email: USERS[0].email, display_name: USERS[0].display_name, permissions: ["*"] },
};

type Json = Record<string, unknown>;
const json = (body: Json) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

/**
 * installIamMocks — вешает на page все route-перехваты: IAM REST, Kratos
 * whoami, auth/me, плюс пустые ответы для vpc/compute/operations (dashboard
 * stat-плашки). Вызывать в beforeEach ДО первого page.goto.
 */
export async function installIamMocks(page: Page): Promise<void> {
  // SPA-deep-link fix: navigation-документ на domain-prefixed путь
  // (`/iam/users`, `/projects/<id>/dashboard`, …) `vite preview` проксирует на
  // бэкенд. Перехватываем top-level document-запрос и отдаём dist/index.html —
  // SPA загружается, React Router разбирает путь client-side. Не-document
  // запросы (XHR `/iam/v1/*`) пропускаем дальше — их ловят JSON-моки ниже.
  const serveSpa = async (route: import("@playwright/test").Route) => {
    if (route.request().resourceType() === "document") {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: SPA_INDEX_HTML,
      });
    } else {
      await route.fallback();
    }
  };
  await page.route("**/iam/**", serveSpa);
  await page.route("**/projects/**", serveSpa);
  await page.route("**/accounts/**", serveSpa);

  // Kratos session — «залогинен», чтобы AuthProvider не считал anon.
  await page.route("**/.ory/kratos/public/sessions/whoami", (r) => r.fulfill(json(KRATOS_SESSION)));
  await page.route("**/iam/v1/auth/me", (r) => r.fulfill(json(AUTH_ME)));

  // AccessBinding — custom-verbs :listByResource / :listBySubject + базовый list.
  await page.route("**/iam/v1/accessBindings**", (r) => r.fulfill(json({ access_bindings: ACCESS_BINDINGS })));
  await page.route("**/iam/v1/accounts**", (r) => r.fulfill(json({ accounts: [ACCOUNT] })));
  await page.route("**/iam/v1/projects**", (r) => r.fulfill(json({ projects: PROJECTS })));
  await page.route("**/iam/v1/serviceAccounts**", (r) => r.fulfill(json({ service_accounts: SERVICE_ACCOUNTS })));
  await page.route("**/iam/v1/users**", (r) => r.fulfill(json({ users: USERS })));
  // :invite POST — Playwright matches routes last-registered-first, поэтому этот
  // более специфичный handler перехватит `POST /iam/v1/users:invite` раньше
  // общего `users**` выше. Возвращаем metadata.magic_link_url (snake_case —
  // как читает UsersPage: resp.metadata?.magic_link_url).
  await page.route("**/iam/v1/users:invite", (r) => {
    if (r.request().method() !== "POST") return r.fallback();
    return r.fulfill(
      json({
        id: "usrtest0000000000099",
        metadata: { user_id: "usrtest0000000000099", account_id: ACCOUNT.id, magic_link_url: "https://test/link" },
      }),
    );
  });
  await page.route("**/iam/v1/groups**", (r) => r.fulfill(json({ groups: GROUPS })));
  await page.route("**/iam/v1/roles**", (r) => r.fulfill(json({ roles: ROLES })));

  // Dashboard stat-плашки опрашивают vpc/compute — отдаём пустые списки.
  await page.route("**/vpc/v1/**", (r) => r.fulfill(json({ networks: [], subnets: [], security_groups: [] })));
  await page.route("**/compute/v1/**", (r) => r.fulfill(json({ instances: [], disks: [], images: [] })));
  await page.route("**/operations/**", (r) => r.fulfill(json({ done: true })));
}

/**
 * seedContext — кладёт выбранный Account (и опц. Project) в localStorage до
 * загрузки SPA, чтобы account-scoped страницы (Projects / ServiceAccounts) и
 * шапка-breadcrumb имели контекст.
 */
export async function seedContext(page: Page, withProject = false): Promise<void> {
  await page.addInitScript(
    ({ acc, prj }) => {
      window.localStorage.setItem(
        "kacho.context.v2",
        JSON.stringify({
          account: { id: acc.id, name: acc.name },
          project: prj ? { id: prj.id, name: prj.name, accountId: acc.id } : null,
        }),
      );
    },
    { acc: ACCOUNT, prj: withProject ? PROJECTS[0] : null },
  );
}
