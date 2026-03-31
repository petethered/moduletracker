import { test, expect } from "@playwright/test";

test.describe("Analytics", () => {
  test("shows empty state with no data", async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    await page.click("[data-tab='analytics']");
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
    await expect(page.getByText(/add some pulls to see analytics/i)).toBeVisible();
  });

  test("shows charts with data", async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");

    // Add a pull with an epic
    await page.click("button:has-text('Add 10x Pull')");
    await page.selectOption("[data-testid='common-count']", "7");
    await page.selectOption("[data-testid='rare-count']", "2");
    await page.click("[data-testid='epic-select-0'] button");
    await page.fill("[data-testid='epic-select-0'] input", "Death");
    await page.locator("[data-testid='epic-select-0']").getByText("Death Penalty").click();
    await page.click("button:has-text('Save Pull')");

    await page.click("[data-tab='analytics']");

    await expect(page.locator("[data-testid='pity-tracker']")).toBeVisible();
    await expect(page.locator("[data-testid='module-distribution-chart']")).toBeVisible();
  });
});
