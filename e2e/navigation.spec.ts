// Import from shared fixtures (NOT @playwright/test): the extended `test` pre-seeds
// the persisted `storageChoice` via addInitScript so the first-run
// StorageChoiceModal overlay never renders and blocks clicks. See e2e/fixtures.ts.
import { test, expect } from "./fixtures";

test.describe("Tab navigation", () => {
  test("shows dashboard by default", async ({ page }) => {
    await page.goto("/");
    // Header brand is the h1 "ModuleTracker.com" button whose accessible name is
    // its aria-label "Go to dashboard" (see src/App.tsx header). The old
    // getByText("Module Tracker") assertion predates the brand rename.
    await expect(page.getByRole("button", { name: "Go to dashboard" })).toBeVisible();
    await expect(page.getByRole("button", { name: /add 10x pull/i })).toBeVisible();
  });

  test("switches between tabs", async ({ page }) => {
    await page.goto("/");

    await page.click("[data-tab='history']");
    await expect(page.getByText("Pull History")).toBeVisible();

    await page.click("[data-tab='modules']");
    await expect(page.getByText("Module Collection")).toBeVisible();

    await page.click("[data-tab='analytics']");
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();

    await page.click("[data-tab='dashboard']");
    // exact:true — getByRole name matching is substring by default, so plain
    // "Dashboard" also matches the header h1 (aria-label "Go to dashboard")
    // and trips a strict-mode violation.
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  });

  test("Add 10x Pull button opens modal", async ({ page }) => {
    await page.goto("/");
    await page.click("button:has-text('Add 10x Pull')");
    await expect(page.getByRole("heading", { name: "Add 10x Pull" })).toBeVisible();
  });
});
