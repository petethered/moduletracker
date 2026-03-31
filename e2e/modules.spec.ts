import { test, expect } from "@playwright/test";

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
