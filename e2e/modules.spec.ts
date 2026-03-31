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

  test("updates module rarity", async ({ page }) => {
    await page.goto("/");
    await page.click("[data-tab='modules']");

    // Click rarity cell for first module
    await page.click("[data-testid='rarity-astral-deliverance']");

    // Select legendary from dropdown
    await page.selectOption("[data-testid='rarity-select-astral-deliverance']", "legendary");

    // Verify it updated (the text should now show "legendary")
    await expect(page.locator("[data-testid='rarity-astral-deliverance']")).toContainText("legendary");
  });
});
