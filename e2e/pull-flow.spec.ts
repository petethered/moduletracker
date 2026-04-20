import { test, expect } from "@playwright/test";

test.describe("Add pull flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("adds a pull with no epics (default 7/3)", async ({ page }) => {
    await page.click("button:has-text('Add 10x Pull')");

    await page.click("button:has-text('Save Pull')");

    await expect(page.getByRole("heading", { name: "Add 10x Pull" })).not.toBeVisible();

    await page.click("[data-tab='history']");
    await expect(page.getByText("Pull History")).toBeVisible();
  });

  test("clicking a Common value auto-balances Rare", async ({ page }) => {
    await page.click("button:has-text('Add 10x Pull')");

    await page.click("[data-testid='common-count-5']");
    // Rare = 10 - 5 - 0 = 5
    await expect(page.locator("[data-testid='rare-count-5']")).toHaveAttribute("aria-checked", "true");
  });

  test("clicking a Rare value auto-balances Common", async ({ page }) => {
    await page.click("button:has-text('Add 10x Pull')");

    await page.click("[data-testid='rare-count-4']");
    // Common = 10 - 4 - 0 = 6
    await expect(page.locator("[data-testid='common-count-6']")).toHaveAttribute("aria-checked", "true");
  });

  test("adds an epic via + Add Epic button (subtracts from rare)", async ({ page }) => {
    await page.click("button:has-text('Add 10x Pull')");

    await page.click("[data-testid='add-epic']");

    // Rare should have dropped to 2 (selected button is 2)
    await expect(page.locator("[data-testid='rare-count-2']")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("[data-testid='epic-select-0']")).toBeVisible();

    await page.click("[data-testid='epic-select-0'] button");
    await page.fill("[data-testid='epic-select-0'] input", "Death");
    await page.locator("[data-testid='epic-select-0']").getByText("Death Penalty").click();

    await page.click("button:has-text('Save Pull')");
    await expect(page.getByRole("heading", { name: "Add 10x Pull" })).not.toBeVisible();
  });

  test("removing an epic adds back to rare", async ({ page }) => {
    await page.click("button:has-text('Add 10x Pull')");
    await page.click("[data-testid='add-epic']");
    await expect(page.locator("[data-testid='rare-count-2']")).toHaveAttribute("aria-checked", "true");

    await page.click("[data-testid='epic-remove-0']");
    await expect(page.locator("[data-testid='rare-count-3']")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("[data-testid='epic-select-0']")).not.toBeVisible();
  });

  test("high Common/Rare buttons disable as epics are added", async ({ page }) => {
    await page.click("button:has-text('Add 10x Pull')");
    // Add 3 epics → max count becomes 7
    await page.click("[data-testid='add-epic']");
    await page.click("[data-testid='add-epic']");
    await page.click("[data-testid='add-epic']");

    // Button 8 should be disabled (8 > 10 - 3)
    await expect(page.locator("[data-testid='common-count-8']")).toBeDisabled();
    await expect(page.locator("[data-testid='common-count-7']")).toBeEnabled();
  });
});

test.describe("Edit pull flow", () => {
  test("edits an existing pull", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.click("button:has-text('Add 10x Pull')");
    await page.click("button:has-text('Save Pull')");

    await page.click("[data-tab='history']");
    await page.click("[data-testid='edit-pull']");

    await expect(page.getByRole("heading", { name: "Edit Pull" })).toBeVisible();

    await page.click("[data-testid='common-count-8']");
    await page.click("button:has-text('Save Pull')");

    await expect(page.getByRole("heading", { name: "Edit Pull" })).not.toBeVisible();
  });
});
