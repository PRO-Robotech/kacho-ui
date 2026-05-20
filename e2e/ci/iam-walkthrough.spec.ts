// iam-walkthrough.spec.ts — обход всех 7 разделов IAM.
//
// Сценарий: «пройти все секции IAM и убедиться, что каждый компонент, который
// секция обязана показать, на месте». IamLayout оборачивает /iam/* в таб-бар
// (7 табов) + Account-<Select>. seedContext кладёт Account в context-store —
// без него account-scoped разделы (Projects / Service Accounts) показывают
// empty-state «Выберите Account».

import { test, expect } from "@playwright/test";
import {
  installIamMocks,
  seedContext,
  PROJECTS,
  USERS,
  SERVICE_ACCOUNTS,
  GROUPS,
  ROLES,
} from "./_mocks";

test.beforeEach(async ({ page }) => {
  await installIamMocks(page);
  await seedContext(page);
});

const IAM_TABS = [
  "Accounts",
  "Projects",
  "Users",
  "Service Accounts",
  "Groups",
  "Roles",
  "Access Bindings",
];

test("IamLayout рендерит все 7 табов и Account-селектор", async ({ page }) => {
  await page.goto("/iam/accounts");

  // Заголовок секции.
  await expect(
    page.getByText("Identity and Access Management"),
  ).toBeVisible();

  // Все 7 табов IAM. exact-match: «Accounts» иначе ловит «Service Accounts».
  for (const label of IAM_TABS) {
    await expect(
      page.getByRole("tab", { name: label, exact: true }),
    ).toBeVisible();
  }

  // Account-<Select> секции — значение содержит выбранный account
  // (seedContext выбрал e2e-account; AntD рендерит выбор как `name · id`).
  await expect(page.getByText("Account:")).toBeVisible();
  await expect(
    page
      .locator(".ant-layout-content .ant-select")
      .filter({ hasText: "e2e-account" }),
  ).toBeVisible();
});

test("раздел accounts — таблица с e2e-account и CTA «Создать account»", async ({
  page,
}) => {
  await page.goto("/iam/accounts");

  // ResourceListPage → ResourceTable → AntD Table.
  await expect(page.locator(".ant-table")).toBeVisible();

  // Замоканный Account-row виден.
  await expect(
    page.locator(".ant-table-row", { hasText: "e2e-account" }),
  ).toBeVisible();

  // CTA «Создать account» (ResourceListPage: `Создать ${singular.toLowerCase()}`).
  await expect(
    page.getByRole("link", { name: /Создать account/i }),
  ).toBeVisible();
});

test("раздел projects — таблица со всеми 3 проектами (account выбран)", async ({
  page,
}) => {
  await page.goto("/iam/projects");

  await expect(page.locator(".ant-table")).toBeVisible();

  // С seeded account IamScopedListShell рендерит ResourceListPage — все 3
  // проекта из фикстуры.
  for (const prj of PROJECTS) {
    await expect(
      page.locator(".ant-table-row", { hasText: prj.name }),
    ).toBeVisible();
  }
});

test("раздел users — таблица с 2 замоканными пользователями", async ({
  page,
}) => {
  await page.goto("/iam/users");

  await expect(
    page.getByRole("heading", { name: "Users", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ant-table")).toBeVisible();

  // Оба user'а из фикстуры (по email).
  for (const u of USERS) {
    await expect(
      page.locator(".ant-table-row", { hasText: u.email }),
    ).toBeVisible();
  }
});

test("раздел service-accounts — таблица с ci-bot", async ({ page }) => {
  await page.goto("/iam/service-accounts");

  await expect(page.locator(".ant-table")).toBeVisible();

  // ci-bot — единственный SA в фикстуре; account выбран → таблица не пустая.
  await expect(
    page.locator(".ant-table-row", { hasText: SERVICE_ACCOUNTS[0].name }),
  ).toBeVisible();
});

test("раздел groups — таблица с developers и кнопка «Создать Group»", async ({
  page,
}) => {
  await page.goto("/iam/groups");

  await expect(
    page.getByRole("heading", { name: "Groups", exact: true }),
  ).toBeVisible();

  // GroupsPage требует выбора Account через свой собственный <Select> (держит
  // локальный state, не context-store). На странице два .ant-select — в шапке
  // IamLayout и в самой GroupsPage; берём GroupsPage-овый (не из шапки-Header).
  await page
    .locator(".ant-layout-content .ant-select")
    .filter({ hasText: "Выберите Account" })
    .click();
  await page
    .locator(".ant-select-item-option", { hasText: "e2e-account" })
    .click();

  await expect(page.locator(".ant-table")).toBeVisible();
  await expect(
    page.locator(".ant-table-row", { hasText: GROUPS[0].name }),
  ).toBeVisible();

  // Кнопка создания группы.
  await expect(
    page.getByRole("button", { name: /Создать Group/i }),
  ).toBeVisible();
});

test("раздел roles — system и custom роли визуально различимы + CTA", async ({
  page,
}) => {
  await page.goto("/iam/roles");

  await expect(
    page.getByRole("heading", { name: "Roles", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ant-table")).toBeVisible();

  // Все 3 роли из фикстуры: 2 системные (admin, viewer) + 1 кастомная.
  for (const r of ROLES) {
    await expect(
      page.locator(".ant-table-row", { hasText: r.name }),
    ).toBeVisible();
  }

  // SystemTag различает system-vs-custom. Системные роли (is_system) помечены
  // тегом «system», кастомные — «custom». Проверяем оба.
  const adminRow = page.locator(".ant-table-row", { hasText: "admin" });
  await expect(adminRow.locator(".ant-tag", { hasText: /system/i })).toBeVisible();

  const customRow = page.locator(".ant-table-row", {
    hasText: "custom-vpc-editor",
  });
  await expect(
    customRow.locator(".ant-tag", { hasText: /custom/i }),
  ).toBeVisible();

  // CTA «Создать custom Role».
  await expect(
    page.getByRole("button", { name: /Создать custom Role/i }),
  ).toBeVisible();
});

test("раздел access-bindings — таблица с биндингом и кнопка «Создать binding»", async ({
  page,
}) => {
  await page.goto("/iam/access-bindings");

  await expect(
    page.getByRole("heading", { name: "Access Bindings", exact: true }),
  ).toBeVisible();

  // Кнопка создания binding.
  await expect(
    page.getByRole("button", { name: /Создать binding/i }),
  ).toBeVisible();

  // AccessBindingsPage показывает «Мои AccessBinding'и» (listBySubject для
  // текущего user'а — admin@kacho.local, см. AUTH_ME). Замоканный биндинг
  // ACCESS_BINDINGS[0] имеет subject_id = USERS[0].id → попадает в эту панель.
  await expect(page.getByText("Мои AccessBinding'и")).toBeVisible();

  // Карточка «Мои AccessBinding'и» содержит таблицу с замоканным биндингом —
  // ассертим по role_id системной роли admin.
  await expect(
    page.locator(".ant-table-row", { hasText: "role.system.admin" }).first(),
  ).toBeVisible();
});
