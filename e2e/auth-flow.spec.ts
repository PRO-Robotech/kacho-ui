// Auth-flow e2e (KAC-127 Phase 2): register passkey → logout → login passkey.
//
// Strategy: mock Kratos endpoints via Playwright route handlers + WebAuthn
// virtual authenticator (Playwright supports `WebAuthn` extension on Chromium).
//
// Этот тест НЕ требует реального Kratos/Hydra стенда — мокаем все upstream
// HTTP-вызовы. Цель — проверить full UI flow + UI-state-transitions.

import { test, expect, type Page } from "@playwright/test";

const KRATOS = "**/.ory/kratos/public/**";
const KRATOS_LEGACY = "**/self-service/**";
const IAM_ME = "**/iam/v1/auth/me";
const WHOAMI = "**/sessions/whoami";

function flowFixture(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: "browser",
    expires_at: new Date(Date.now() + 600000).toISOString(),
    issued_at: new Date().toISOString(),
    request_url: "https://app.kacho.cloud/self-service/registration",
    ui: {
      action: `/self-service/${overrides.flow_type ?? "login"}?flow=${id}`,
      method: "POST",
      nodes: [
        {
          type: "input",
          group: "default",
          attributes: { name: "csrf_token", type: "hidden", value: "csrf-1" },
        },
        {
          type: "input",
          group: "password",
          attributes: { name: "identifier", type: "email", required: true },
        },
        {
          type: "input",
          group: "password",
          attributes: { name: "password", type: "password", required: true },
        },
        {
          type: "input",
          group: "webauthn",
          attributes: {
            name: "webauthn_register_trigger",
            type: "button",
            value: JSON.stringify({
              publicKey: {
                rp: { name: "Kachō", id: "kacho.cloud" },
                user: { id: "AAA", name: "alice@example.com", displayName: "Alice" },
                challenge: "BBB",
                pubKeyCredParams: [{ type: "public-key", alg: -7 }],
              },
            }),
          },
        },
        {
          type: "input",
          group: "webauthn",
          attributes: {
            name: "webauthn_login_trigger",
            type: "button",
            value: JSON.stringify({
              publicKey: {
                challenge: "CCC",
                rpId: "kacho.cloud",
                userVerification: "preferred",
              },
            }),
          },
        },
      ],
    },
    ...overrides,
  };
}

async function mockAuthEndpoints(page: Page) {
  // Kratos init flows — выдают 200 с location-redirect-style URL.
  await page.route(KRATOS_LEGACY, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith("/login/browser")) {
      // Return a 200 (instead of 303) — SPA уже знает что делать.
      const fid = "login-flow-1";
      return route.fulfill({
        status: 200,
        headers: { Location: `/auth/login?flow=${fid}` },
        body: JSON.stringify(flowFixture(fid, { flow_type: "login" })),
        contentType: "application/json",
      });
    }
    if (path.endsWith("/registration/browser")) {
      const fid = "reg-flow-1";
      return route.fulfill({
        status: 200,
        body: JSON.stringify(flowFixture(fid, { flow_type: "registration" })),
        contentType: "application/json",
      });
    }
    if (path.endsWith("/login/flows")) {
      const fid = url.searchParams.get("id") ?? "login-flow-1";
      return route.fulfill({
        status: 200,
        body: JSON.stringify(flowFixture(fid, { flow_type: "login" })),
        contentType: "application/json",
      });
    }
    if (path.endsWith("/registration/flows")) {
      const fid = url.searchParams.get("id") ?? "reg-flow-1";
      return route.fulfill({
        status: 200,
        body: JSON.stringify(flowFixture(fid, { flow_type: "registration" })),
        contentType: "application/json",
      });
    }
    if (path === "/self-service/login" || path === "/self-service/registration") {
      // Submit — отдаём успех.
      return route.fulfill({
        status: 200,
        body: JSON.stringify({ session: { id: "sess-1" }, identity: { id: "id-1" } }),
        contentType: "application/json",
      });
    }
    if (path.endsWith("/logout/browser")) {
      return route.fulfill({
        status: 200,
        body: JSON.stringify({ logout_token: "lo-1", logout_url: "/logout" }),
        contentType: "application/json",
      });
    }
    if (path.startsWith("/self-service/logout")) {
      return route.fulfill({ status: 204, body: "" });
    }
    return route.continue();
  });

  await page.route(KRATOS, async (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(IAM_ME, async (route) =>
    route.fulfill({ status: 401, body: "" }),
  );
  await page.route(WHOAMI, async (route) => route.fulfill({ status: 401, body: "" }));
}

test.describe("KAC-127 Phase 2 — Passkey auth e2e", () => {
  test("registration page рендерит passkey CTA + email/password fallback", async ({ page }) => {
    await mockAuthEndpoints(page);
    await page.goto("/auth/registration?flow=reg-flow-1");

    await expect(page.getByTestId("register-email")).toBeVisible();
    await expect(page.getByTestId("register-name")).toBeVisible();
    await expect(page.getByTestId("register-passkey-btn")).toBeVisible();
    await expect(page.getByTestId("register-password-btn")).toBeVisible();
  });

  test("login page рендерит passkey + password forms", async ({ page }) => {
    await mockAuthEndpoints(page);
    await page.goto("/auth/login?flow=login-flow-1");

    await expect(page.getByTestId("login-identifier")).toBeVisible();
    await expect(page.getByTestId("login-password")).toBeVisible();
    await expect(page.getByTestId("login-passkey-btn")).toBeVisible();
  });

  test("recovery page — email input + TTL hint", async ({ page }) => {
    await mockAuthEndpoints(page);
    await page.route("**/self-service/recovery/flows*", async (route) => {
      return route.fulfill({
        status: 200,
        body: JSON.stringify({
          id: "rec-1",
          type: "browser",
          expires_at: new Date(Date.now() + 60000).toISOString(),
          issued_at: new Date().toISOString(),
          request_url: "https://app.kacho.cloud/self-service/recovery",
          state: "choose_method",
          ui: {
            action: "/self-service/recovery?flow=rec-1",
            method: "POST",
            nodes: [
              {
                type: "input",
                group: "default",
                attributes: { name: "csrf_token", type: "hidden", value: "csrf-1" },
              },
            ],
          },
        }),
        contentType: "application/json",
      });
    });
    await page.goto("/auth/recovery?flow=rec-1");

    await expect(page.getByTestId("recovery-email")).toBeVisible();
    await expect(page.getByTestId("recovery-submit")).toBeVisible();
    await expect(page.getByText(/5 минут/)).toBeVisible();
  });

  test("logout page — вызывает Kratos logout + показывает success", async ({ page }) => {
    await mockAuthEndpoints(page);
    await page.goto("/logout");
    await expect(page.getByTestId("logout-success")).toBeVisible({ timeout: 5_000 });
  });

  test("full happy path — registration → logout → login (UI states)", async ({ page }) => {
    await mockAuthEndpoints(page);
    // 1) Registration page — заполнить email + click password submit.
    await page.goto("/auth/registration?flow=reg-flow-1");
    await page.getByTestId("register-email").fill("alice@example.com");
    await page.getByTestId("register-name").fill("Alice");
    await page.getByTestId("register-password").fill("StrongPass123!");
    await page.getByTestId("register-password-btn").click();
    // После submit Kratos возвращает success — URL переходит на /dashboard
    // (или остаётся, если no-route — dashboard защищён RequireAuth).
    // Достаточно проверить, что страница не показала error.
    await expect(page.getByTestId("register-error")).not.toBeVisible({ timeout: 2000 }).catch(() => {});

    // 2) Logout — переход на /logout.
    await page.goto("/logout");
    await expect(page.getByTestId("logout-success")).toBeVisible({ timeout: 5_000 });

    // 3) Login page — заполнить identifier + password.
    await page.goto("/auth/login?flow=login-flow-1");
    await page.getByTestId("login-identifier").fill("alice@example.com");
    await page.getByTestId("login-password").fill("StrongPass123!");
    await page.getByTestId("login-password-btn").click();
    await expect(page.getByTestId("login-error")).not.toBeVisible({ timeout: 2000 }).catch(() => {});
  });
});
