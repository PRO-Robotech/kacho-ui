// header-projects.spec.ts — кликаем по всем проектам в breadcrumb-шапке.
//
// Сценарий: «перебрать все проекты в крошке-селекторе шапки — они все
// должны быть на месте». BreadcrumbSelector рендерит Account → Project
// крошки (Radix DropdownMenu). Project-крошка открывает dropdown со списком
// проектов; клик по проекту вызывает goProject → navigate /projects/<id>/dashboard.

import { test, expect } from "@playwright/test";
import { installIamMocks, seedContext, PROJECTS } from "./_mocks";

test.beforeEach(async ({ page }) => {
  // Моки REST + seed Account в localStorage до загрузки SPA — иначе
  // Project-крошка не появится (она рендерится только при наличии account).
  await installIamMocks(page);
  await seedContext(page);
});

// Открыть Project-крошку в шапке. Account-крошка идёт первой, Project — второй
// DropdownMenu.Trigger. DropdownRow вызывает e.preventDefault() в onSelect —
// меню НЕ закрывается само после выбора проекта, поэтому открываем только если
// оно закрыто (иначе повторный клик его свернёт). Возвращаем триггер.
async function openProjectCrumb(page: import("@playwright/test").Page) {
  // Account-крошка — index 0, Project-крошка — index 1.
  const projectTrigger = page.locator('button[aria-haspopup="menu"]').nth(1);
  await expect(projectTrigger).toBeVisible();
  if ((await projectTrigger.getAttribute("data-state")) !== "open") {
    await projectTrigger.click();
  }
  return projectTrigger;
}

test("Project-крошка шапки содержит все 3 замоканных проекта", async ({ page }) => {
  await page.goto("/iam/accounts");

  // Дожидаемся, что шапка-breadcrumb отрисовалась — Account-крошка (первый
  // DropdownMenu.Trigger) показывает имя выбранного account.
  await expect(
    page.locator('button[aria-haspopup="menu"]').first(),
  ).toContainText("e2e-account");

  await openProjectCrumb(page);

  // Radix рендерит Content в портале — ищем пункты меню глобально по странице.
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();

  // Все 3 проекта из фикстуры _mocks должны быть в выпадающем списке.
  for (const prj of PROJECTS) {
    await expect(menu.getByText(prj.name, { exact: true })).toBeVisible();
  }
});

test("клик по каждому проекту в крошке навигирует на /projects/<id>/dashboard", async ({
  page,
}) => {
  await page.goto("/iam/accounts");
  await expect(
    page.locator('button[aria-haspopup="menu"]').first(),
  ).toContainText("e2e-account");

  // Перебираем все 3 проекта: открыть крошку → кликнуть проект → проверить URL.
  for (const prj of PROJECTS) {
    await openProjectCrumb(page);

    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await menu.getByText(prj.name, { exact: true }).click();

    // goProject → navigate(`/projects/<id>/dashboard`).
    await expect(page).toHaveURL(new RegExp(`/projects/${prj.id}/dashboard`));

    // Контекст-store записал выбранный проект — крошка теперь показывает его имя.
    await expect(
      page.locator('button[aria-haspopup="menu"]').nth(1),
    ).toContainText(prj.name);

    // Закрываем dropdown перед следующей итерацией (Radix держит его открытым
    // после выбора — см. openProjectCrumb).
    await page.keyboard.press("Escape");
    await expect(
      page.locator('button[aria-haspopup="menu"]').nth(1),
    ).not.toHaveAttribute("data-state", "open");
  }
});
