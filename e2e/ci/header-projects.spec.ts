// header-projects.spec.ts — перебор всех проектов в селекторе шапки.
//
// KAC-127: pill-based BreadcrumbSelector заменён на AntD <Cascader>
// (ContextCascader.tsx) — Account → Project, projects грузятся лениво через
// loadData. Этот спек проверяет, что все 3 замоканных проекта доступны в
// раскрытом cascader и клик по проекту навигирует на /projects/<id>/dashboard.

import { test, expect } from "@playwright/test";
import { installIamMocks, seedContext, ACCOUNT, PROJECTS } from "./_mocks";

test.beforeEach(async ({ page }) => {
  // Моки REST + seed Account в localStorage до загрузки SPA — Cascader
  // покажет текущее значение account, список грузится из /iam/v1/accounts.
  await installIamMocks(page);
  await seedContext(page);
});

// Открыть Cascader и раскрыть seeded account → колонка проектов.
async function expandAccount(page: import("@playwright/test").Page) {
  const cascader = page.locator(".ant-select.ant-cascader").first();
  await cascader.click();
  const accountOption = page
    .locator(".ant-cascader-menu-item")
    .filter({ hasText: ACCOUNT.name });
  await expect(accountOption).toBeVisible();
  // changeOnSelect: клик по non-leaf account раскрывает колонку проектов.
  await accountOption.click();
}

test("Cascader шапки содержит все 3 замоканных проекта", async ({ page }) => {
  await page.goto("/iam/accounts");

  await expandAccount(page);

  // Все 3 проекта из фикстуры _mocks должны быть в колонке проектов.
  for (const prj of PROJECTS) {
    await expect(
      page.locator(".ant-cascader-menu-item").filter({ hasText: prj.name }),
    ).toBeVisible();
  }
});

test("клик по каждому проекту в Cascader навигирует на /projects/<id>/dashboard", async ({
  page,
}) => {
  await page.goto("/iam/accounts");

  // Перебираем все 3 проекта: раскрыть account → кликнуть проект → проверить URL.
  for (const prj of PROJECTS) {
    await expandAccount(page);

    const prjOption = page
      .locator(".ant-cascader-menu-item")
      .filter({ hasText: prj.name });
    await expect(prjOption).toBeVisible();
    await prjOption.click();

    // onChange с path длины 2 → setProject + navigate /projects/<id>/dashboard.
    await expect(page).toHaveURL(
      new RegExp(`/projects/${prj.id}/dashboard`),
    );
  }
});
