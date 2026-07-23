// Import from shared fixtures (NOT @playwright/test): the extended `test` pre-seeds
// the persisted `storageChoice` via addInitScript so the first-run
// StorageChoiceModal overlay never renders and blocks clicks. See e2e/fixtures.ts.
import { test, expect } from "./fixtures";

test.describe("Module collection", () => {
  test("shows all 24 modules", async ({ page }) => {
    await page.goto("/");
    await page.click("[data-tab='modules']");
    await expect(page.getByRole("heading", { name: "Module Collection" })).toBeVisible();

    // Check one from each type
    await expect(page.getByText("Death Penalty")).toBeVisible();
    await expect(page.getByText("Anti-Cube Portal")).toBeVisible();
    await expect(page.getByText("Project Funding")).toBeVisible();
    await expect(page.getByText("Dimension Core")).toBeVisible();
  });

  test("shows Pulls Since column header", async ({ page }) => {
    await page.goto("/");
    await page.click("[data-tab='modules']");
    // One table per module type -> 4 matching headers; assert the first.
    await expect(
      page.getByRole("columnheader", { name: "Pulls Since" }).first()
    ).toBeVisible();
  });

  test("updates module rarity via modal", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.click("[data-tab='modules']");

    // Click rarity cell to open modal
    await page.click("[data-testid='rarity-astral-deliverance']");

    // Modal should show with module name
    await expect(page.getByRole("heading", { name: /Astral Deliverance/ })).toBeVisible();

    // Click legendary option
    await page.click("[data-testid='rarity-option-legendary']");

    // Modal closes, rarity shows in table
    await expect(page.getByRole("heading", { name: /Astral Deliverance/ })).not.toBeVisible();
    await expect(page.locator("[data-testid='rarity-astral-deliverance']")).toContainText("legendary");
  });
});
