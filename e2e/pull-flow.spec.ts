import { test, expect } from "@playwright/test";

async function setCount(page: import("@playwright/test").Page, testid: string, value: string) {
  const input = page.locator(`[data-testid='${testid}']`);
  await input.fill(value);
  await input.blur();
}

test.describe("Add pull flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("adds a pull with no epics (default 7/3)", async ({ page }) => {
    await page.click("button:has-text('Add 10x Pull')");

    // Defaults should already sum to 10
    await expect(page.locator("[data-testid='common-count']")).toHaveValue("7");
    await expect(page.locator("[data-testid='rare-count']")).toHaveValue("3");

    await page.click("button:has-text('Save Pull')");

    await expect(page.getByRole("heading", { name: "Add 10x Pull" })).not.toBeVisible();

    await page.click("[data-tab='history']");
    await expect(page.getByText("Pull History")).toBeVisible();
  });

  test("adds an epic via + Add Epic button (subtracts from rare)", async ({ page }) => {
    await page.click("button:has-text('Add 10x Pull')");

    await page.click("[data-testid='add-epic']");

    // Rare should have dropped by 1
    await expect(page.locator("[data-testid='rare-count']")).toHaveValue("2");

    // Epic row 0 should be visible
    await expect(page.locator("[data-testid='epic-select-0']")).toBeVisible();

    // Pick a module
    await page.click("[data-testid='epic-select-0'] button");
    await page.fill("[data-testid='epic-select-0'] input", "Death");
    await page.locator("[data-testid='epic-select-0']").getByText("Death Penalty").click();

    await page.click("button:has-text('Save Pull')");
    await expect(page.getByRole("heading", { name: "Add 10x Pull" })).not.toBeVisible();
  });

  test("removing an epic adds back to rare", async ({ page }) => {
    await page.click("button:has-text('Add 10x Pull')");
    await page.click("[data-testid='add-epic']");
    await expect(page.locator("[data-testid='rare-count']")).toHaveValue("2");

    await page.click("[data-testid='epic-remove-0']");
    await expect(page.locator("[data-testid='rare-count']")).toHaveValue("3");
    await expect(page.locator("[data-testid='epic-select-0']")).not.toBeVisible();
  });

  test("typing in common auto-balances rare", async ({ page }) => {
    await page.click("button:has-text('Add 10x Pull')");
    await setCount(page, "common-count", "5");

    await expect(page.locator("[data-testid='rare-count']")).toHaveValue("5");
  });

  test("manually edited rare stops auto-balance", async ({ page }) => {
    await page.click("button:has-text('Add 10x Pull')");
    await setCount(page, "rare-count", "4");
    await setCount(page, "common-count", "5");

    // Rare should NOT have auto-balanced (was manually set to 4)
    await expect(page.locator("[data-testid='rare-count']")).toHaveValue("4");
  });

  test("validates sum equals 10", async ({ page }) => {
    await page.click("button:has-text('Add 10x Pull')");
    await setCount(page, "rare-count", "5");
    await setCount(page, "common-count", "7");

    await expect(page.getByText(/must equal 10/i)).toBeVisible();
    await expect(page.locator("button:has-text('Save Pull')")).toBeDisabled();
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

    await setCount(page, "common-count", "8");
    await setCount(page, "rare-count", "2");
    await page.click("button:has-text('Save Pull')");

    await expect(page.getByRole("heading", { name: "Edit Pull" })).not.toBeVisible();
  });
});
