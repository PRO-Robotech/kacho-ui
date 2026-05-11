import { test, expect } from "@playwright/test";
import { ensureFixture, selectFolder } from "./_helpers";

test.describe("Networks list", () => {
  test("видна таблица + filter input + Создать кнопка в header'е", async ({ page }) => {
    const fx = await ensureFixture(page);
    await selectFolder(page, fx);
    await page.goto(`/folders/${fx.folderId}/networks`);

    await expect(page.getByRole("heading", { name: "Networks" })).toBeVisible();
    await expect(page.getByPlaceholder("Фильтр по имени или идентификатору")).toBeVisible();
    await expect(page.getByRole("button", { name: /Создать network/i })).toBeVisible();
    await expect(page.locator(".ant-table")).toBeVisible();
  });

  test("polling-индикатор присутствует (live/polling)", async ({ page }) => {
    const fx = await ensureFixture(page);
    await selectFolder(page, fx);
    await page.goto(`/folders/${fx.folderId}/networks`);
    const indicator = page.locator(".ant-tag", { hasText: /(live|polling)/ });
    await expect(indicator).toBeVisible();
  });

  test("kebab dropdown открывается и содержит действия", async ({ page }) => {
    const fx = await ensureFixture(page);
    await selectFolder(page, fx);
    await page.goto(`/folders/${fx.folderId}/networks`);

    // Если строк нет — создаём network через API.
    const tableBody = page.locator(".ant-table-tbody");
    if ((await tableBody.locator("tr").count()) <= 1) {
      // Может быть .ant-empty placeholder row — создаём через UI.
      await page.getByRole("button", { name: /Создать network/i }).click();
      await expect(page).toHaveURL(/\/networks\/create$/);
      // Заполнить имя.
      await page.locator("input[id]").first().fill(`net-${Date.now()}`);
      await page.getByRole("button", { name: /Создать network/i }).click();
      await page.waitForURL(new RegExp(`/folders/${fx.folderId}/networks$`));
      // Polling 3s — подождём появления.
      await page.waitForTimeout(4_000);
    }

    const firstKebab = page.getByLabel("Действия").first();
    await expect(firstKebab).toBeVisible();
    await firstKebab.click();

    const menuItems = page.locator(".ant-dropdown-menu-item");
    await expect(menuItems.filter({ hasText: "Просмотр" }).or(menuItems.filter({ hasText: "Открыть" }))).toBeVisible();
    await expect(menuItems.filter({ hasText: "Редактировать" })).toBeVisible();
  });
});
