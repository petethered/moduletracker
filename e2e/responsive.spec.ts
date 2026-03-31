import { test, expect } from "@playwright/test";

test.describe("Responsive layout", () => {
  test("mobile: tabs and header render", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    await expect(page.getByText("Module Tracker")).toBeVisible();
    await expect(page.getByRole("button", { name: /add 10x pull/i })).toBeVisible();

    // Tabs should be visible
    await expect(page.locator("[data-tab='dashboard']")).toBeVisible();
    await expect(page.locator("[data-tab='history']")).toBeVisible();
  });

  test("mobile: add pull modal works", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.click("button:has-text('Add 10x Pull')");
    await page.selectOption("[data-testid='common-count']", "7");
    await page.selectOption("[data-testid='rare-count']", "3");
    await page.click("button:has-text('Save Pull')");

    await expect(page.getByRole("heading", { name: "Add 10x Pull" })).not.toBeVisible();
  });

  test("desktop: full layout renders", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await expect(page.getByText("Module Tracker")).toBeVisible();

    // All tabs clickable
    for (const tab of ["dashboard", "history", "modules", "analytics"]) {
      await page.click(`[data-tab='${tab}']`);
    }
  });
});
