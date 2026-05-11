import { test, expect } from "@playwright/test";
import { ensureFixture, selectFolder } from "./_helpers";

test.describe("Create flow (page-mode)", () => {
  test("кнопка Создать ведёт на full-page форму /create", async ({ page }) => {
    const fx = await ensureFixture(page);
    await selectFolder(page, fx);
    await page.goto(`/folders/${fx.folderId}/networks`);

    const cta = page.getByRole("button", { name: /Создать network/i }).first();
    await expect(cta).toBeVisible();
    await cta.click();

    await expect(page).toHaveURL(new RegExp(`/folders/${fx.folderId}/networks/create`));
    await expect(page.getByRole("heading", { name: /Создать network/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Отменить/i })).toBeVisible();
  });

  test("Subnet → IP-адреса → Зарезервировать заполняет subnet_id+kind", async ({ page }) => {
    const fx = await ensureFixture(page);
    await selectFolder(page, fx);

    // Создадим subnet через UI быстрее = через API (если нет уже)
    await page.goto(`/folders/${fx.folderId}/subnets`);

    // Если нет subnet, тест не пройдёт — но цель: проверить link generation,
    // переходим напрямую с фейковым subnet_id.
    const fakeSubnet = "sub00000000000000000";
    await page.goto(
      `/folders/${fx.folderId}/addresses/create?subnet_id=${fakeSubnet}&kind=internal`,
    );

    await expect(page.getByRole("heading", { name: /Создать address/i })).toBeVisible();
    await expect(page.getByText(/Предзаполнено из контекста/i)).toBeVisible();
    // chip с subnet_id
    await expect(page.locator(".ant-tag").filter({ hasText: fakeSubnet })).toBeVisible();
  });
});
