// Import from shared fixtures (NOT @playwright/test): the extended `test` pre-seeds
// the persisted `storageChoice` via addInitScript so the first-run
// StorageChoiceModal overlay never renders and blocks clicks. See e2e/fixtures.ts.
import { test, expect } from "./fixtures";

test.describe("Responsive layout", () => {
  test("mobile: tabs and header render", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    // Header brand is the h1 "ModuleTracker.com" button, accessible name = its
    // aria-label "Go to dashboard" (see src/App.tsx). Old text assertion predates rename.
    await expect(page.getByRole("button", { name: "Go to dashboard" })).toBeVisible();
    await expect(page.getByRole("button", { name: /add.*pull/i })).toBeVisible();

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
    // Rarity counts are now a button grid (data-testid="common-count-N" /
    // "rare-count-N" per src/features/pulls/PullForm.tsx), not <select> elements —
    // the old selectOption("[data-testid='common-count']", ...) API is gone.
    await page.click("[data-testid='common-count-7']");
    await page.click("[data-testid='rare-count-3']");
    await page.click("button:has-text('Save Pull')");

    await expect(page.getByRole("heading", { name: "Add 10x Pull" })).not.toBeVisible();
  });

  test("desktop: full layout renders", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    // Same header-brand locator as the mobile test above (brand renamed to
    // "ModuleTracker.com"; accessible name comes from aria-label).
    await expect(page.getByRole("button", { name: "Go to dashboard" })).toBeVisible();

    // All tabs clickable
    for (const tab of ["dashboard", "history", "modules", "analytics"]) {
      await page.click(`[data-tab='${tab}']`);
    }
  });
});
