import { test, expect } from "@playwright/test";

test.describe("Add pull flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("adds a pull with no epics", async ({ page }) => {
    await page.click("button:has-text('Add 10x Pull')");

    await page.selectOption("[data-testid='common-count']", "7");
    await page.selectOption("[data-testid='rare-count']", "3");

    await page.click("button:has-text('Save Pull')");

    // Modal closes
    await expect(page.getByRole("heading", { name: "Add 10x Pull" })).not.toBeVisible();

    // Navigate to history to verify (history tab is a placeholder in this build)
    await page.click("[data-tab='history']");
    await expect(page.getByText("Pull History")).toBeVisible();
  });

  test("adds a pull with epics", async ({ page }) => {
    await page.click("button:has-text('Add 10x Pull')");

    await page.selectOption("[data-testid='common-count']", "7");
    await page.selectOption("[data-testid='rare-count']", "2");

    // Should show 1 epic select
    await expect(page.locator("[data-testid='epic-select-0']")).toBeVisible();

    // Click to open the select, type to search, click result
    await page.click("[data-testid='epic-select-0'] button");
    await page.fill("[data-testid='epic-select-0'] input", "Death");
    await page.locator("[data-testid='epic-select-0']").getByText("Death Penalty").click();

    await page.click("button:has-text('Save Pull')");
    await expect(page.getByRole("heading", { name: "Add 10x Pull" })).not.toBeVisible();
  });

  test("validates common + rare <= 10", async ({ page }) => {
    await page.click("button:has-text('Add 10x Pull')");
    await page.selectOption("[data-testid='common-count']", "7");
    await page.selectOption("[data-testid='rare-count']", "5");

    await expect(page.getByText(/cannot exceed 10/i)).toBeVisible();
    await expect(page.locator("button:has-text('Save Pull')")).toBeDisabled();
  });
});

test.describe("Edit pull flow", () => {
  test("edits an existing pull", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Add a pull first
    await page.click("button:has-text('Add 10x Pull')");
    await page.selectOption("[data-testid='common-count']", "7");
    await page.selectOption("[data-testid='rare-count']", "3");
    await page.click("button:has-text('Save Pull')");

    // Go to history and click edit
    await page.click("[data-tab='history']");
    await page.click("[data-testid='edit-pull']");

    // Should show Edit Pull modal
    await expect(page.getByRole("heading", { name: "Edit Pull" })).toBeVisible();

    // Change common to 8, rare to 2
    await page.selectOption("[data-testid='common-count']", "8");
    await page.selectOption("[data-testid='rare-count']", "2");
    await page.click("button:has-text('Save Pull')");

    // Verify modal closed
    await expect(page.getByRole("heading", { name: "Edit Pull" })).not.toBeVisible();
  });
});
