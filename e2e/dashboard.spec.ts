import { test, expect } from "@playwright/test";
import { ensureFixture, selectFolder } from "./_helpers";

test.describe("Dashboard (root)", () => {
  test("открывается / и редиректит на /dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Ресурсы облака")).toBeVisible();
  });

  test("без выбранного folder показан Alert + кнопка Organizations", async ({ page, context }) => {
    await context.clearCookies();
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto("/dashboard");
    await expect(page.getByText("Каталог не выбран")).toBeVisible();
    await expect(page.getByTestId("dashboard-go-organizations")).toBeVisible();
  });

  test("c выбранным folder показывает VPC tile со счётчиками", async ({ page }) => {
    const fx = await ensureFixture(page);
    await selectFolder(page, fx);
    await page.goto("/dashboard");

    const tile = page.getByTestId("dashboard-tile-vpc");
    await expect(tile).toBeVisible();
    await expect(tile).toContainText("Virtual Private Cloud");
    await expect(tile).toContainText("Сетей");
    await expect(tile).toContainText("Подсетей");
    await expect(tile).toContainText("Групп безопасности");
  });

  test("click VPC tile → переход в /folders/X/networks", async ({ page }) => {
    const fx = await ensureFixture(page);
    await selectFolder(page, fx);
    await page.goto("/dashboard");

    await page.getByTestId("dashboard-tile-vpc").click();
    await expect(page).toHaveURL(new RegExp(`/folders/${fx.folderId}/networks`));
    await expect(page.getByRole("heading", { name: "Networks" })).toBeVisible();
  });
});
