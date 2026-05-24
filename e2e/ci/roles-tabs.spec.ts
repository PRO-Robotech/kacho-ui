// roles-tabs.spec.ts — KAC-127: разделение Role'ей на табы Системные/Кастомные.
//
// RolesPage рендерит AntD <Tabs> с двумя ключами: system / custom. Активный
// таб фильтрует таблицу: system → roles.filter(is_system), custom → !is_system.
// Фикстура ROLES — 2 системные (admin, viewer) + 1 кастомная (custom-vpc-editor).

import { test, expect } from "@playwright/test";
import { installIamMocks, seedContext, ROLES } from "./_mocks";

const SYSTEM_ROLES = ROLES.filter((r) => r.is_system);
const CUSTOM_ROLES = ROLES.filter((r) => !r.is_system);

test.beforeEach(async ({ page }) => {
  await installIamMocks(page);
  await seedContext(page);
});

test("таб «Системные» — по умолчанию, показывает 2 системные роли", async ({
  page,
}) => {
  await page.goto("/iam/roles");

  // Оба таба присутствуют (label содержит счётчик: «Системные (2)»).
  const systemTab = page.getByRole("tab", { name: /Системные/ });
  const customTab = page.getByRole("tab", { name: /Кастомные/ });
  await expect(systemTab).toBeVisible();
  await expect(customTab).toBeVisible();

  // Системный таб активен по умолчанию (roleKind="system").
  await expect(systemTab).toHaveAttribute("aria-selected", "true");

  // Таблица показывает admin + viewer.
  for (const r of SYSTEM_ROLES) {
    await expect(
      page.locator(".ant-table-row", { hasText: r.name }),
    ).toBeVisible();
  }
  // Кастомная роль НЕ видна на системном табе.
  await expect(
    page.locator(".ant-table-row", { hasText: CUSTOM_ROLES[0].name }),
  ).toHaveCount(0);
});

test("переключение на «Кастомные» фильтрует таблицу до custom-роли", async ({
  page,
}) => {
  await page.goto("/iam/roles");

  await page.getByRole("tab", { name: /Кастомные/ }).click();

  // Теперь видна только custom-vpc-editor.
  await expect(
    page.locator(".ant-table-row", { hasText: CUSTOM_ROLES[0].name }),
  ).toBeVisible();

  // Системные роли скрыты.
  for (const r of SYSTEM_ROLES) {
    await expect(
      page.locator(".ant-table-row", { hasText: r.name }),
    ).toHaveCount(0);
  }
});

test("счётчики в табах соответствуют фикстуре", async ({ page }) => {
  await page.goto("/iam/roles");

  await expect(
    page.getByRole("tab", { name: `Системные (${SYSTEM_ROLES.length})` }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: `Кастомные (${CUSTOM_ROLES.length})` }),
  ).toBeVisible();
});
