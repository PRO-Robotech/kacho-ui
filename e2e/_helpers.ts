// e2e helpers: setup тестового org/cloud/folder через REST API.
//
// Запросы делаются через page.evaluate(() => fetch(...)), потому что:
//   1) APIRequestContext в playwright использует node.js network stack
//      и не наследует --host-resolver-rules (chromium-only флаг).
//   2) page.evaluate выполняется внутри браузера, который умеет резолвить
//      api.kacho.local → 127.0.0.1 благодаря host-resolver-rules.

import type { Page } from "@playwright/test";

export interface Fixture {
  orgId: string;
  cloudId: string;
  folderId: string;
}

// UI deployment проксирует /v1/* на api-gateway через own nginx
// (см. deploy/nginx.conf). Same-origin запросы — никаких CORS проблем.
const API = "";

interface OperationResp {
  id: string;
  done: boolean;
  metadata?: Record<string, string>;
  response?: Record<string, unknown>;
  error?: { code: number; message: string };
}

interface FetchOpts {
  method?: "GET" | "POST";
  body?: unknown;
}

async function browserFetch<T>(page: Page, path: string, opts: FetchOpts = {}): Promise<T> {
  return page.evaluate(
    async ({ url, opts }) => {
      const r = await fetch(url, {
        method: opts.method ?? "GET",
        headers: { "Content-Type": "application/json" },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
      const text = await r.text();
      if (!r.ok) {
        throw new Error(`${opts.method ?? "GET"} ${url} → ${r.status}: ${text.slice(0, 200)}`);
      }
      return text ? JSON.parse(text) : {};
    },
    { url: `${API}${path}`, opts },
  ) as Promise<T>;
}

async function awaitOperation(page: Page, opId: string, attempts = 30): Promise<OperationResp> {
  for (let i = 0; i < attempts; i++) {
    try {
      const op = await browserFetch<OperationResp>(page, `/operations/${opId}`);
      if (op.done) {
        if (op.error) throw new Error(`operation failed: ${op.error.message}`);
        return op;
      }
    } catch {
      // ignore transient errors during polling
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`operation timed out: ${opId}`);
}

let cachedFixture: Fixture | null = null;

/** Создаёт org+cloud+folder если их нет. Кеширует результат на сессию runner'а. */
export async function ensureFixture(page: Page): Promise<Fixture> {
  // Page должна быть загружена (хоть на about:blank в правильном host).
  // Делаем blank-goto на UI, чтобы в дальнейшем page.evaluate мог делать
  // fetch на api.kacho.local через chromium host-resolver.
  if (page.url() === "about:blank") {
    await page.goto("/");
  }

  if (cachedFixture) return cachedFixture;

  const orgs = (
    await browserFetch<{ organizations?: { id: string; name: string }[] }>(
      page,
      "/organization-manager/v1/organizations",
    )
  ).organizations ?? [];
  let org = orgs[0];
  if (!org) {
    const op = await browserFetch<OperationResp>(page, "/organization-manager/v1/organizations", {
      method: "POST",
      body: { name: "e2e-org", title: "E2E", description: "playwright fixture" },
    });
    const done = await awaitOperation(page, op.id);
    org = (done.response as { id: string; name: string }) ?? {
      id: op.metadata!.organization_id,
      name: "e2e-org",
    };
  }

  const clouds = (
    await browserFetch<{ clouds?: { id: string; name: string }[] }>(
      page,
      `/resource-manager/v1/clouds?organization_id=${org.id}`,
    )
  ).clouds ?? [];
  let cloud = clouds[0];
  if (!cloud) {
    const op = await browserFetch<OperationResp>(page, "/resource-manager/v1/clouds", {
      method: "POST",
      body: {
        name: "e2e-cloud",
        organization_id: org.id,
        description: "playwright fixture",
      },
    });
    const done = await awaitOperation(page, op.id);
    cloud = (done.response as { id: string; name: string }) ?? {
      id: op.metadata!.cloud_id,
      name: "e2e-cloud",
    };
  }

  const folders = (
    await browserFetch<{ folders?: { id: string; name: string }[] }>(
      page,
      `/resource-manager/v1/folders?cloud_id=${cloud.id}`,
    )
  ).folders ?? [];
  let folder = folders[0];
  if (!folder) {
    const op = await browserFetch<OperationResp>(page, "/resource-manager/v1/folders", {
      method: "POST",
      body: { name: "e2e-folder", cloud_id: cloud.id, description: "playwright fixture" },
    });
    const done = await awaitOperation(page, op.id);
    folder = (done.response as { id: string; name: string }) ?? {
      id: op.metadata!.folder_id,
      name: "e2e-folder",
    };
  }

  cachedFixture = { orgId: org.id, cloudId: cloud.id, folderId: folder.id };
  return cachedFixture;
}

/** Подставляет org/cloud/folder в localStorage перед загрузкой страницы. */
export async function selectFolder(page: Page, fx: Fixture, folderName = "e2e-folder") {
  await page.addInitScript(
    ({ fx, folderName }) => {
      window.localStorage.setItem(
        "kacho.context.v1",
        JSON.stringify({
          org: { id: fx.orgId, name: "e2e-org" },
          cloud: { id: fx.cloudId, name: "e2e-cloud", organizationId: fx.orgId },
          folder: {
            id: fx.folderId,
            uid: fx.folderId,
            name: folderName,
            cloudId: fx.cloudId,
            organizationId: fx.orgId,
          },
        }),
      );
    },
    { fx, folderName },
  );
}
