// Полный e2e flow через UI (без backend-fixture'ов):
//  1. Создать Organization через крошку.
//  2. Кликнуть org в дереве слева → /organizations/X/clouds.
//  3. Создать Cloud → click cloud в дереве → dashboard со плашкой VPC.
//  4. Создать Folder → click folder в дереве → /folders/X/networks.
//  5. В sub-nav VPC: создать Network, Subnet, RouteTable, SecurityGroup.
//
// Все имена уникальны через timestamp. Тест выполняется в одном sequential
// flow — каждый шаг зависит от предыдущего.

import { test, expect, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const ts = Date.now().toString(36);
const ORG_NAME = `e2e-flow-org-${ts}`;
const CLOUD_NAME = `e2e-flow-cloud-${ts}`;
const FOLDER_NAME = `e2e-flow-folder-${ts}`;
const NETWORK_NAME = `e2e-flow-net-${ts}`;
const SUBNET_NAME = `e2e-flow-sub-${ts}`;
const RT_NAME = `e2e-flow-rt-${ts}`;
const SG_NAME = `e2e-flow-sg-${ts}`;

// Сохраняем ID между тестами в shared state.
const state: { orgId?: string; cloudId?: string; folderId?: string } = {};

/** Ждём пока появится строка в таблице с именем — polling 3s + поллинг operations. */
async function waitForRow(page: Page, name: string, timeoutMs = 20_000) {
  await expect(
    page.locator(".ant-table-row").filter({ hasText: name }),
  ).toBeVisible({ timeout: timeoutMs });
}

test.beforeAll(async () => {
  // Сбрасываем shared state на каждый run.
  delete state.orgId;
  delete state.cloudId;
  delete state.folderId;
});

test("1) создать Organization через UI", async ({ page }) => {
  await page.goto("/organizations");

  // CTA в header — antd Button "Создать organization".
  const cta = page.getByRole("link", { name: /Создать organization/i }).first();
  await expect(cta).toBeVisible();
  await cta.click();

  await expect(page).toHaveURL(/\/organizations\/create$/);
  await expect(page.getByRole("heading", { name: /Создать organization/i })).toBeVisible();

  // Поле "Name" — первый Input. Используем placeholder.
  const nameInput = page.locator('input[placeholder="my-resource"]').first();
  await nameInput.fill(ORG_NAME);

  // Submit
  const submit = page.getByRole("button", { name: new RegExp(`^Создать organization`, "i") });
  await submit.click();

  // Ждём редирект обратно на list.
  await expect(page).toHaveURL(/\/organizations$/);
  await waitForRow(page, ORG_NAME);

  // Сохраним ID организации (берём из ID-cell строки).
  state.orgId = await extractIdFromRow(page, ORG_NAME);
  expect(state.orgId).toMatch(/^[a-z0-9]{16,}$/);
});

/** Раскрывает узел дерева. Если уже раскрыт — force collapse+expand,
 *  чтобы re-trigger loadData (children могли быть инвалидированы после Create). */
async function expandTreeNode(page: Page, label: string): Promise<void> {
  const node = page
    .locator(".ant-tree-treenode")
    .filter({ hasText: label })
    .first();
  await expect(node).toBeVisible({ timeout: 8_000 });
  const switcher = node.locator(".ant-tree-switcher").first();
  const cls = (await switcher.getAttribute("class")) ?? "";
  if (cls.includes("ant-tree-switcher_open")) {
    await switcher.click(); // collapse
    await page.waitForTimeout(300);
  }
  await switcher.click(); // expand (re-load children)
  await page.waitForTimeout(900);
}

// Извлекает ID ресурса через drill-down по kebab → URL.
// Это надёжнее чем cell-pattern matching, потому что несколько колонок
// (id, organization_id, cloud_id) могут быть похожими prefix'ами.
async function extractIdFromRow(page: Page, name: string): Promise<string> {
  const row = page.locator(".ant-table-row").filter({ hasText: name });
  await expect(row).toBeVisible();
  // Click на kebab → "Открыть" / "Просмотр".
  const kebab = row.getByLabel("Действия");
  await kebab.click();
  const open = page
    .locator(".ant-dropdown-menu-item")
    .filter({ hasText: /^(Открыть|Просмотр)$/ });
  await open.click();
  // URL теперь содержит ID. Для cluster-scoped (Org/Cloud/Folder) drill ведёт
  // на дочерний route — ID в середине: /organizations/X/clouds, /clouds/X/folders,
  // /folders/X/networks. Для leaf VPC — в конце.
  await page.waitForURL(/\/[a-z][a-z0-9]{16,}(\/|$|\?)/);
  const url = new URL(page.url());
  const m = url.pathname.match(/\/([a-z][a-z0-9]{16,})(?:\/|$)/);
  if (!m) throw new Error(`URL has no id-segment: ${url.pathname}`);
  return m[1];
}

test("2) выбрать Org через дерево → /organizations/X/clouds", async ({ page }) => {
  expect(state.orgId).toBeTruthy();
  await page.goto("/dashboard");

  const orgNode = page
    .locator(".ant-tree-treenode")
    .filter({ hasText: ORG_NAME })
    .first();
  await expect(orgNode).toBeVisible({ timeout: 10_000 });
  await orgNode.locator(".ant-tree-node-content-wrapper").click();

  await expect(page).toHaveURL(new RegExp(`/organizations/${state.orgId}/clouds`));
});

test("3) создать Cloud через UI + появляется плашка VPC", async ({ page }) => {
  expect(state.orgId).toBeTruthy();
  await page.goto(`/organizations/${state.orgId}/clouds`);

  await page.getByRole("link", { name: /Создать cloud/i }).first().click();
  await expect(page).toHaveURL(new RegExp(`/organizations/${state.orgId}/clouds/create`));

  await page.locator('input[placeholder="my-resource"]').first().fill(CLOUD_NAME);

  // organization_id field — RefSelect, должен быть заполнен из template.
  // Submit.
  await page.getByRole("button", { name: /Создать cloud/i }).click();

  await expect(page).toHaveURL(new RegExp(`/organizations/${state.orgId}/clouds$`));
  await waitForRow(page, CLOUD_NAME);

  state.cloudId = await extractIdFromRow(page, CLOUD_NAME);
  expect(state.cloudId).toMatch(/^[a-z0-9]{16,}$/);

  // После выбора Cloud должна показаться плашка VPC на /dashboard.
  // Click в tree на cloud, потом → dashboard.
  await page.goto("/dashboard");
  // Раскрыть org node, ткнуть cloud.
  const orgSwitcher = page
    .locator(".ant-tree-treenode")
    .filter({ hasText: ORG_NAME })
    .first()
    .locator(".ant-tree-switcher_close");
  if (await orgSwitcher.count() > 0) {
    await orgSwitcher.first().click();
    await page.waitForTimeout(800);
  }
  const cloudNode = page.locator(".ant-tree-treenode").filter({ hasText: CLOUD_NAME }).first();
  await expect(cloudNode).toBeVisible({ timeout: 5_000 });
  await cloudNode.locator(".ant-tree-node-content-wrapper").click();
  // навигация ушла на /clouds/X/folders, вернёмся явно на dashboard.
  await page.goto("/dashboard");
  await expect(page.getByTestId("dashboard-tile-vpc")).toBeVisible();
  await expect(page.getByText(`Облако: ${CLOUD_NAME}`)).toBeVisible();
});

test("4) создать Folder через UI", async ({ page }) => {
  expect(state.cloudId).toBeTruthy();
  await page.goto(`/clouds/${state.cloudId}/folders`);

  await page.getByRole("link", { name: /Создать folder/i }).first().click();
  await expect(page).toHaveURL(new RegExp(`/clouds/${state.cloudId}/folders/create`));

  await page.locator('input[placeholder="my-resource"]').first().fill(FOLDER_NAME);
  await page.getByRole("button", { name: /Создать folder/i }).click();

  await expect(page).toHaveURL(new RegExp(`/clouds/${state.cloudId}/folders$`));
  await waitForRow(page, FOLDER_NAME);

  state.folderId = await extractIdFromRow(page, FOLDER_NAME);
  expect(state.folderId).toMatch(/^[a-z0-9]{16,}$/);
  // Verify folder реально создан и доступен через API.
  const verify = await page.evaluate(async (fid) => {
    const r = await fetch(`/resource-manager/v1/folders/${fid}`);
    return r.status;
  }, state.folderId);
  expect(verify).toBe(200);
});

test("5) выбрать Folder в дереве → переход в VPC sub-nav", async ({ page }) => {
  expect(state.folderId).toBeTruthy();
  await page.goto("/dashboard");

  await expandTreeNode(page, ORG_NAME);
  await expandTreeNode(page, CLOUD_NAME);

  const folderNode = page.locator(".ant-tree-treenode").filter({ hasText: FOLDER_NAME }).first();
  await expect(folderNode).toBeVisible({ timeout: 10_000 });
  await folderNode.locator(".ant-tree-node-content-wrapper").click();

  // Folder click → /folders/X/networks (default tail).
  await expect(page).toHaveURL(new RegExp(`/folders/${state.folderId}/networks`));
  // Sub-nav VPC появился слева.
  await expect(
    page.locator(".ant-menu-item").filter({ hasText: "Облачные сети" }),
  ).toBeVisible();
  await expect(
    page.locator(".ant-menu-item").filter({ hasText: "Подсети" }),
  ).toBeVisible();
});

test("6) создать Network через VPC sub-nav", async ({ page }) => {
  expect(state.folderId).toBeTruthy();
  await page.goto(`/folders/${state.folderId}/networks`);

  await page.getByRole("link", { name: /Создать network/i }).first().click();
  await expect(page).toHaveURL(new RegExp(`/folders/${state.folderId}/networks/create`));

  await page.locator('input[placeholder="my-network"]').first().fill(NETWORK_NAME);
  await page.getByRole("button", { name: /Создать network/i }).click();

  await expect(page).toHaveURL(new RegExp(`/folders/${state.folderId}/networks$`));
  await waitForRow(page, NETWORK_NAME, 25_000);
  // Verify network реально привязан к state.folderId через API.
  const apiCount = await page.evaluate(async (fid) => {
    const r = await fetch(`/vpc/v1/networks?folder_id=${fid}`);
    const j = (await r.json()) as { networks?: { name: string }[] };
    return j.networks?.length ?? 0;
  }, state.folderId);
  expect(apiCount).toBeGreaterThan(0);
});

test("7) создать Subnet (network + zone + CIDR)", async ({ page }) => {
  expect(state.folderId).toBeTruthy();

  // Шаг 1: открыть networks list — прогрев + проверка что network есть.
  await page.goto(`/folders/${state.folderId}/networks`);
  await waitForRow(page, NETWORK_NAME, 10_000);

  // Diag: подтвердить через прямой fetch что network в этом folder есть.
  const apiCount = await page.evaluate(async (fid) => {
    const r = await fetch(`/vpc/v1/networks?folder_id=${fid}`);
    const j = (await r.json()) as { networks?: { name: string }[] };
    return { count: j.networks?.length ?? 0, names: (j.networks ?? []).map((n) => n.name) };
  }, state.folderId);
  test.info().annotations.push({ type: "api", description: JSON.stringify(apiCount) });

  // Шаг 2: переход на /subnets/create.
  await page.goto(`/folders/${state.folderId}/subnets/create`);
  // ResourceCreatePage mounts → RefSelect делает fetch /vpc/v1/networks +
  // /vpc/v1/zones. Ждём пока option с NETWORK_NAME появится в DOM.
  const networkSelect = page.getByLabel("Network", { exact: true });

  // Diagnostic: capture select inner HTML through poll.
  let lastOpts = "";
  for (let i = 0; i < 25; i++) {
    lastOpts = (await networkSelect.locator("option").allInnerTexts()).join("|");
    if (lastOpts.includes(NETWORK_NAME)) break;
    await page.waitForTimeout(800);
  }
  test.info().annotations.push({ type: "opts-final", description: lastOpts });

  await networkSelect.locator("option", { hasText: NETWORK_NAME }).waitFor({
    state: "attached",
    timeout: 5_000,
  });
  const zoneSelect = page.getByLabel("Zone", { exact: true });
  await zoneSelect.locator("option", { hasText: /ru-central1/ }).waitFor({
    state: "attached",
    timeout: 15_000,
  });

  await page.locator('input[placeholder="my-network"]').first().fill(SUBNET_NAME);
  await networkSelect.selectOption({ label: new RegExp(NETWORK_NAME) });
  await zoneSelect.selectOption({ label: /ru-central1/ });

  // CIDR-блок: уникальный для каждого run.
  const cidrIdx = ts.charCodeAt(ts.length - 1) % 200;
  const cidrInput = page.locator('input[placeholder="10.0.0.0/24"]').first();
  await cidrInput.fill(`10.${cidrIdx}.0.0/24`);

  await page.getByRole("button", { name: /Создать subnet/i }).click();
  await expect(page).toHaveURL(new RegExp(`/folders/${state.folderId}/subnets$`));
  await waitForRow(page, SUBNET_NAME, 25_000);
});

test("8) создать RouteTable", async ({ page }) => {
  await page.goto(`/folders/${state.folderId}/route-tables`);

  await page.getByRole("link", { name: /Создать route table/i }).first().click();
  await expect(page).toHaveURL(new RegExp(`/folders/${state.folderId}/route-tables/create`));

  await page.locator('input[placeholder="my-network"]').first().fill(RT_NAME);

  const rtNetSelect = page.getByLabel("Network", { exact: true });
  await rtNetSelect.locator("option", { hasText: NETWORK_NAME }).waitFor({
    state: "attached",
    timeout: 15_000,
  });
  await rtNetSelect.selectOption({ label: new RegExp(NETWORK_NAME) });

  // submit
  await page.getByRole("button", { name: /Создать route table/i }).click();
  await expect(page).toHaveURL(new RegExp(`/folders/${state.folderId}/route-tables$`));
  await waitForRow(page, RT_NAME, 25_000);
});

test("9) создать SecurityGroup", async ({ page }) => {
  await page.goto(`/folders/${state.folderId}/security-groups`);

  await page.getByRole("link", { name: /Создать security group/i }).first().click();
  await expect(page).toHaveURL(new RegExp(`/folders/${state.folderId}/security-groups/create`));

  await page.locator('input[placeholder="my-network"]').first().fill(SG_NAME);
  const sgNetSelect = page.getByLabel("Network", { exact: true });
  await sgNetSelect.locator("option", { hasText: NETWORK_NAME }).waitFor({
    state: "attached",
    timeout: 15_000,
  });
  await sgNetSelect.selectOption({ label: new RegExp(NETWORK_NAME) });

  await page.getByRole("button", { name: /Создать security group/i }).click();
  await expect(page).toHaveURL(new RegExp(`/folders/${state.folderId}/security-groups$`));
  await waitForRow(page, SG_NAME, 25_000);
});
