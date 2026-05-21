// invite-user.spec.ts — KAC-127: invite-flow на /iam/users.
//
// UsersPage имеет кнопку «Пригласить пользователя» — enabled только когда
// выбран Account (seedContext seed'ит ACCOUNT). Клик открывает модалку с
// email-полем. Submit → POST /iam/v1/users:invite (мок в _mocks.ts возвращает
// metadata.magic_link_url) → модалка показывает magic-link.

import { test, expect } from "@playwright/test";
import { installIamMocks, seedContext } from "./_mocks";

test.beforeEach(async ({ page }) => {
  await installIamMocks(page);
  // Account seeded → кнопка invite enabled.
  await seedContext(page);
});

test("кнопка «Пригласить пользователя» видна и активна (account выбран)", async ({
  page,
}) => {
  await page.goto("/iam/users");

  const inviteBtn = page.getByRole("button", {
    name: /Пригласить пользователя/,
  });
  await expect(inviteBtn).toBeVisible();
  await expect(inviteBtn).toBeEnabled();
});

test("клик открывает модалку с email-полем", async ({ page }) => {
  await page.goto("/iam/users");

  await page
    .getByRole("button", { name: /Пригласить пользователя/ })
    .click();

  // Модалка — AntD <Modal> рендерит role="dialog".
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  await expect(
    modal.getByText("Пригласить пользователя", { exact: true }),
  ).toBeVisible();

  // Email-поле присутствует (Form.Item name="email" → id="email").
  await expect(modal.locator("#email")).toBeVisible();

  // CTA «Пригласить» в footer.
  await expect(
    modal.getByRole("button", { name: "Пригласить" }),
  ).toBeVisible();
});

test("submit invite показывает magic-link из ответа", async ({ page }) => {
  await page.goto("/iam/users");

  await page
    .getByRole("button", { name: /Пригласить пользователя/ })
    .click();

  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  await modal.locator("#email").fill("newcomer@kacho.local");
  await modal.getByRole("button", { name: "Пригласить" }).click();

  // Мок :invite вернул metadata.magic_link_url="https://test/link" — UsersPage
  // рендерит success-Alert + readonly Input с этой ссылкой.
  await expect(modal.getByText("Пользователь приглашён")).toBeVisible();
  await expect(modal.locator('input[value="https://test/link"]')).toBeVisible();

  // Footer переключился на одну кнопку «Готово».
  await expect(modal.getByRole("button", { name: "Готово" })).toBeVisible();
});
