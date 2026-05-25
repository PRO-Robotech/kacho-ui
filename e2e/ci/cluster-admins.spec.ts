// KAC-196 Task 5 — /system/cluster/admins page e2e (CI, backend-free).
//
// Covers two acceptance flows (TDD-RED before implementation):
//   - KAC-196-14: admin grants new admin (S → /system/cluster/admins →
//     "Добавить admin" → searches "u2@" → selects U2 → "Выдать" →
//     U2 row appears within 5s, after Operation polling completes).
//   - KAC-196-15: ordinary user U3 navigates to /system/cluster/admins →
//     forbidden page rendered (testid `cluster-admins-forbidden`).
//
// Mocks Kratos whoami, /iam/v1/auth/me, /iam/v1/internal/cluster*, /iam/v1/users,
// /operations/*. No real stand required.

import { test, expect, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SPA_INDEX_HTML = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dist/index.html"),
  "utf-8",
);

const ADMIN_S = {
  id: "usr_01hkacho001adminuser",
  email: "s@prorobotech.ru",
  display_name: "S Admin",
  account_id: "acc_01hkacho00000000",
  permissions: ["*"],
};

const USER_U2 = {
  id: "usr_01hkacho02u2user000",
  email: "u2@prorobotech.ru",
  display_name: "U2 Тестовый",
  external_id: "kratos-u2",
  created_at: "2026-05-01T10:00:00Z",
};

const USER_U3 = {
  id: "usr_01hkacho03u3user000",
  email: "u3@prorobotech.ru",
  display_name: "U3 Обычный",
  permissions: [],
};

const INITIAL_ADMINS = [
  {
    cluster_admin_grant_id: "cag_01hkacho01initialgrt",
    subject_type: "USER",
    subject_id: ADMIN_S.id,
    subject_email: ADMIN_S.email,
    subject_display_name: ADMIN_S.display_name,
    granted_by_user_id: "bootstrap",
    granted_by_email: "",
    granted_at: "2026-05-01T09:00:00Z",
  },
];

const json = (body: Record<string, unknown>) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function serveSpa(page: Page) {
  // SPA deep-link: navigation document для /system/cluster/admins должен
  // вернуть index.html, чтобы React Router отработал client-side.
  const handler = async (route: Route) => {
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
  await page.route("**/system/**", handler);
  await page.route("**/iam/**", handler);
}

async function mockSession(
  page: Page,
  user: typeof ADMIN_S | typeof USER_U3,
) {
  await page.route("**/.ory/kratos/public/sessions/whoami", (r) =>
    r.fulfill(
      json({
        id: "sess-1",
        active: true,
        authenticated_at: new Date().toISOString(),
        authenticator_assurance_level: "aal1",
        identity: {
          id: user.id,
          schema_id: "default",
          traits: { email: user.email },
        },
      }),
    ),
  );
  await page.route("**/iam/v1/auth/me", (r) => r.fulfill(json({ user })));
}

test.describe("KAC-196 — /system/cluster/admins", () => {
  test("KAC-196-14 admin grants new admin flow", async ({ page }) => {
    await serveSpa(page);
    await mockSession(page, ADMIN_S);

    // Cluster singleton GET — fields camelCase (grpc-gateway wire).
    await page.route("**/iam/v1/internal/cluster", async (route) => {
      const u = new URL(route.request().url());
      if (u.pathname.endsWith("/iam/v1/internal/cluster")) {
        return route.fulfill(
          json({
            id: "cluster_kacho_root",
            name: "Kacho Root Cluster",
            description: "",
            createdAt: "2026-01-01T00:00:00Z",
          }),
        );
      }
      return route.fallback();
    });

    // State machine for admins + operation polling.
    let admins = [...INITIAL_ADMINS];
    let nextOpDone = false;
    const opId = "op-grant-1";

    await page.route(
      "**/iam/v1/internal/cluster/admins",
      async (route: Route) => {
        const method = route.request().method();
        if (method === "GET") {
          return route.fulfill(json({ admins }));
        }
        if (method === "POST") {
          nextOpDone = false;
          setTimeout(() => {
            admins = [
              ...admins,
              {
                cluster_admin_grant_id: "cag_01hkacho02newgrant0",
                subject_type: "USER",
                subject_id: USER_U2.id,
                subject_email: USER_U2.email,
                subject_display_name: USER_U2.display_name,
                granted_by_user_id: ADMIN_S.id,
                granted_by_email: ADMIN_S.email,
                granted_at: new Date().toISOString(),
              },
            ];
            nextOpDone = true;
          }, 250);
          return route.fulfill(
            json({
              operation: {
                id: opId,
                done: false,
                metadata: {
                  "@type":
                    "type.googleapis.com/kacho.cloud.iam.v1.GrantClusterAdminMetadata",
                  clusterAdminGrantId: "cag_01hkacho02newgrant0",
                  subjectId: USER_U2.id,
                },
              },
            }),
          );
        }
        return route.fallback();
      },
    );

    // Generic /operations/** — для prefetch'ей других queries (e.g. invalidate
    // после успеха других мутаций). НЕ перехватывает наш конкретный opId —
    // специфичный хендлер ниже регистрируется позже и в Playwright LIFO
    // матчится первым.
    await page.route("**/operations/**", (r) => r.fulfill(json({ done: true })));
    await page.route(`**/operations/${opId}`, async (route) =>
      route.fulfill(
        json({
          id: opId,
          done: nextOpDone,
          ...(nextOpDone
            ? {
                response: {
                  "@type":
                    "type.googleapis.com/kacho.cloud.iam.v1.ClusterAdminGrant",
                  id: "cag_01hkacho02newgrant0",
                  subjectId: USER_U2.id,
                },
              }
            : {}),
        }),
      ),
    );

    // User search (AutoComplete) — /iam/v1/users?filter=...
    await page.route("**/iam/v1/users**", (r) => {
      const u = new URL(r.request().url());
      // Match exact list endpoint only.
      if (!u.pathname.endsWith("/iam/v1/users")) return r.fallback();
      return r.fulfill(json({ users: [USER_U2] }));
    });

    await page.goto("/system/cluster/admins");

    await expect(page.getByTestId("cluster-admins-page-title")).toBeVisible();
    await expect(page.getByText(ADMIN_S.email)).toBeVisible();

    await page.getByTestId("cluster-admins-grant-button").click();
    // AntD оставляет ant-modal-root в DOM с display:none — проверяем body,
    // который mount'ится только при open=true.
    await expect(page.getByTestId("grant-admin-modal-body")).toBeVisible();

    // AntD AutoComplete рендерит wrapper-div c data-testid + дочерний <input>.
    // Fill() требует input/textarea/contenteditable — берём nested input.
    const searchWrap = page.getByTestId("grant-admin-search");
    const searchInput = searchWrap.locator("input").first();
    await searchInput.click();
    await searchInput.fill("u2@");

    // Click the U2 option inside the AutoComplete portal.
    await page.getByText(USER_U2.email).first().click();

    await page.getByTestId("grant-admin-submit").click();

    // U2 appears in the table within 5s (Op polled 1Hz; mock flips at 250ms).
    // У AutoComplete тоже остаётся "u2@..." в poll-висячей виде — ловим именно
    // ту строку, которая внутри таблицы (`<strong>` cell в первой колонке).
    const u2RowCell = page
      .locator("table")
      .getByRole("strong")
      .filter({ hasText: USER_U2.email });
    await expect(u2RowCell).toBeVisible({ timeout: 5_000 });
  });

  test("KAC-196-15 ordinary user gets forbidden page", async ({ page }) => {
    await serveSpa(page);
    await mockSession(page, USER_U3);

    const forbidden = (r: Route) =>
      r.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          code: "PermissionDenied",
          message:
            "missing computed-permission admin@cluster:cluster_kacho_root",
        }),
      });
    await page.route("**/iam/v1/internal/cluster/admins**", forbidden);
    await page.route("**/iam/v1/internal/cluster", forbidden);

    // Other harmless endpoints still need to resolve for layout.
    await page.route("**/iam/v1/users**", (r) =>
      r.fulfill(json({ users: [] })),
    );
    await page.route("**/operations/**", (r) =>
      r.fulfill(json({ done: true })),
    );

    await page.goto("/system/cluster/admins");

    await expect(
      page.getByTestId("cluster-admins-forbidden"),
    ).toBeVisible({ timeout: 5_000 });
  });
});
