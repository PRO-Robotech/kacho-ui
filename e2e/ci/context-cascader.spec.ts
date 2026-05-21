// context-cascader.spec.ts — AntD <Cascader> в шапке (ContextCascader.tsx).
//
// KAC-127: pill-based BreadcrumbSelector заменён на двухуровневый Cascader
// Account → Project. Accounts грузятся при mount, projects — лениво через
// loadData при раскрытии account. Выбор project-листа → setProject + navigate
// /projects/<id>/dashboard.

import { test, expect } from "@playwright/test";
import { installIamMocks, seedContext, ACCOUNT, PROJECTS } from "./_mocks";

test.beforeEach(async ({ page }) => {
  await installIamMocks(page);
  // Account seeded — Cascader покажет текущее значение, но список грузится из API.
  await seedContext(page);
});

test("Cascader рендерится в шапке", async ({ page }) => {
  await page.goto("/dashboard");

  // AntD Cascader — input с placeholder/значением; ищем по placeholder-семантике.
  const cascader = page.locator(".ant-cascader-picker, .ant-select.ant-cascader");
  await expect(cascader.first()).toBeVisible();
});

test("раскрытие Cascader показывает аккаунты и проекты", async ({ page }) => {
  await page.goto("/dashboard");

  // Открыть dropdown — клик по селектору.
  const cascader = page.locator(".ant-select.ant-cascader").first();
  await cascader.click();

  // Верхний уровень — accounts. ACCOUNT.name из фикстуры.
  const accountOption = page
    .locator(".ant-cascader-menu-item")
    .filter({ hasText: ACCOUNT.name });
  await expect(accountOption).toBeVisible();

  // Раскрыть account → lazy loadData грузит projects (мок /iam/v1/projects).
  // changeOnSelect: клик по non-leaf account и выбирает, и раскрывает колонку.
  await accountOption.click();

  // Проекты появляются во второй колонке меню.
  for (const prj of PROJECTS) {
    await expect(
      page.locator(".ant-cascader-menu-item").filter({ hasText: prj.name }),
    ).toBeVisible();
  }
});

test("выбор проекта в Cascader навигирует на /projects/<id>/dashboard", async ({
  page,
}) => {
  await page.goto("/dashboard");

  const cascader = page.locator(".ant-select.ant-cascader").first();
  await cascader.click();

  await page
    .locator(".ant-cascader-menu-item")
    .filter({ hasText: ACCOUNT.name })
    .click();

  const prj = PROJECTS[1];
  await expect(
    page.locator(".ant-cascader-menu-item").filter({ hasText: prj.name }),
  ).toBeVisible();
  await page
    .locator(".ant-cascader-menu-item")
    .filter({ hasText: prj.name })
    .click();

  // onChange с path длины 2 → setProject + navigate.
  await expect(page).toHaveURL(
    new RegExp(`/projects/${prj.id}/dashboard`),
  );
});
