import { test, expect } from "@playwright/test";
import { ensureFixture, selectFolder } from "./_helpers";

test.describe("Sidebar (dynamic Tree vs VpcSubNav)", () => {
  test("на /dashboard слева отображается дерево Org/Cloud/Folder", async ({ page }) => {
    const fx = await ensureFixture(page);
    await selectFolder(page, fx);
    await page.goto("/dashboard");

    const tree = page.locator(".ant-tree");
    await expect(tree).toBeVisible();
    // Должен быть хотя бы один корневой узел (Organization)
    const nodes = tree.locator(".ant-tree-treenode");
    await expect(nodes.first()).toBeAttached();
    expect(await nodes.count()).toBeGreaterThan(0);
  });

  test("на /folders/X/networks слева отображается VPC sub-nav", async ({ page }) => {
    const fx = await ensureFixture(page);
    await selectFolder(page, fx);
    await page.goto(`/folders/${fx.folderId}/networks`);

    // Sub-nav: Menu с группой Virtual Private Cloud
    await expect(page.locator(".ant-menu-item-group-title").filter({ hasText: "Virtual Private Cloud" })).toBeVisible();
    await expect(page.locator(".ant-menu-item").filter({ hasText: "Облачные сети" })).toBeVisible();
    await expect(page.locator(".ant-menu-item").filter({ hasText: "Подсети" })).toBeVisible();
    await expect(page.locator(".ant-menu-item").filter({ hasText: "Группы безопасности" })).toBeVisible();
  });

  test("VPC sub-nav: click 'Подсети' → /folders/X/subnets", async ({ page }) => {
    const fx = await ensureFixture(page);
    await selectFolder(page, fx);
    await page.goto(`/folders/${fx.folderId}/networks`);

    await page.locator(".ant-menu-item").filter({ hasText: "Подсети" }).click();
    await expect(page).toHaveURL(new RegExp(`/folders/${fx.folderId}/subnets`));
  });

  test("HierarchyTree: click на folder в дереве → переход в его VPC", async ({ page }) => {
    const fx = await ensureFixture(page);
    await selectFolder(page, fx);
    await page.goto("/dashboard");

    // Раскроем org → cloud → folder. AntTree использует Switcher для expand.
    const tree = page.locator(".ant-tree");
    await expect(tree).toBeVisible();

    // Раскрыть первый org-node, потом cloud, потом кликнуть folder.
    const switchers = tree.locator(".ant-tree-switcher_close");
    // Если стартовое expanded по контексту — switcher_close может уже не быть.
    // Открываем все закрытые до тех пор, пока не появится folder-узел.
    let attempts = 5;
    while ((await switchers.count()) > 0 && attempts-- > 0) {
      await switchers.first().click();
      await page.waitForTimeout(400);
    }

    const folderNode = tree.locator(".ant-tree-treenode", { hasText: "e2e-folder" }).first();
    if (await folderNode.isVisible()) {
      await folderNode.click();
      await expect(page).toHaveURL(new RegExp(`/folders/${fx.folderId}`));
    }
  });
});
