// dashboard-nav.spec.ts — плашки модулей на /dashboard (DashboardPage).
//
// KAC-127: VPC / Compute — project-scoped: плашка кликабельна только когда
// выбран project (m.landing(projectId) → route или null). Без project плашка
// disabled (opacity 0.55, <LockOutlined/> в extra, data-disabled="true") и клик
// — no-op (openModule возвращает рано). IAM-плашка всегда кликабельна (landing
// без зависимости от project).

import { test, expect } from "@playwright/test";
import { installIamMocks, seedContext, PROJECTS } from "./_mocks";

test.describe("dashboard tiles — без выбранного project", () => {
  test.beforeEach(async ({ page }) => {
    await installIamMocks(page);
    // seedContext без второго аргумента — только account, project=null.
    await seedContext(page);
  });

  test("VPC и Compute плашки disabled, IAM кликабельна", async ({ page }) => {
    await page.goto("/dashboard");

    const vpcTile = page.getByTestId("dashboard-tile-vpc");
    const computeTile = page.getByTestId("dashboard-tile-compute");
    const iamTile = page.getByTestId("dashboard-tile-iam");

    await expect(vpcTile).toBeVisible();
    await expect(computeTile).toBeVisible();
    await expect(iamTile).toBeVisible();

    // VPC / Compute помечены disabled (data-disabled + lock-иконка + подсказка).
    await expect(vpcTile).toHaveAttribute("data-disabled", "true");
    await expect(computeTile).toHaveAttribute("data-disabled", "true");
    await expect(vpcTile).toContainText("Выберите проект");
    await expect(vpcTile.locator(".anticon-lock")).toBeVisible();

    // IAM — НЕ disabled.
    await expect(iamTile).toHaveAttribute("data-disabled", "false");
  });

  test("клик по disabled VPC-плашке не уводит с /dashboard", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByTestId("dashboard-tile-vpc").click();
    // openModule(m) с landing=null — no-op, URL не меняется.
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByTestId("dashboard-tile-compute").click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("клик по IAM-плашке навигирует на /iam/accounts", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByTestId("dashboard-tile-iam").click();
    await expect(page).toHaveURL(/\/iam\/accounts$/);
  });
});

test.describe("dashboard tiles — project выбран", () => {
  test.beforeEach(async ({ page }) => {
    await installIamMocks(page);
    // seedContext(page, true) — кладёт account + PROJECTS[0].
    await seedContext(page, true);
  });

  test("VPC-плашка кликабельна → /projects/<id>/vpc/networks", async ({ page }) => {
    await page.goto("/dashboard");

    const vpcTile = page.getByTestId("dashboard-tile-vpc");
    await expect(vpcTile).toHaveAttribute("data-disabled", "false");

    await vpcTile.click();
    await expect(page).toHaveURL(
      new RegExp(`/projects/${PROJECTS[0].id}/vpc/networks`),
    );
  });

  test("Compute-плашка кликабельна → /projects/<id>/compute/instances", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const computeTile = page.getByTestId("dashboard-tile-compute");
    await expect(computeTile).toHaveAttribute("data-disabled", "false");

    await computeTile.click();
    await expect(page).toHaveURL(
      new RegExp(`/projects/${PROJECTS[0].id}/compute/instances`),
    );
  });
});
