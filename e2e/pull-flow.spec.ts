// Import from shared fixtures (NOT @playwright/test): the extended `test` pre-seeds
// the persisted `storageChoice` via addInitScript so the first-run
// StorageChoiceModal overlay never renders and blocks clicks. See e2e/fixtures.ts.
import { test, expect } from "./fixtures";

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

  test("adds an epic via + Add Epic button (subtracts from common)", async ({ page }) => {
    await page.click("button:has-text('Add 10x Pull')");

    await page.click("[data-testid='add-epic']");

    // Default 7 common / 3 rare -> the new epic takes a COMMON slot: 6 / 3.
    // Commons are the bulk of every 10x, so that's the drop the epic replaced.
    await expect(page.locator("[data-testid='common-count-6']")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("[data-testid='rare-count-3']")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("[data-testid='epic-select-0']")).toBeVisible();

    // NOTE: do NOT click the SearchSelect trigger button here. The just-added
    // epic row mounts with its panel already open (defaultOpen — see
    // src/features/pulls/PullForm.tsx autoOpenRowId), so clicking the trigger
    // would TOGGLE the panel closed and the search input would never appear.
    await page.fill("[data-testid='epic-select-0'] input", "Death");
    await page.locator("[data-testid='epic-select-0']").getByText("Death Penalty").click();

    await page.click("button:has-text('Save Pull')");
    await expect(page.getByRole("heading", { name: "Add 10x Pull" })).not.toBeVisible();
  });

  test("removing an epic adds back to common", async ({ page }) => {
    await page.click("button:has-text('Add 10x Pull')");
    await page.click("[data-testid='add-epic']");
    await expect(page.locator("[data-testid='common-count-6']")).toHaveAttribute("aria-checked", "true");

    await page.click("[data-testid='epic-remove-0']");
    await expect(page.locator("[data-testid='common-count-7']")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("[data-testid='rare-count-3']")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("[data-testid='epic-select-0']")).not.toBeVisible();
  });

  test("adding an epic takes from rare once commons are exhausted", async ({ page }) => {
    await page.click("button:has-text('Add 10x Pull')");
    // 0 common / 10 rare, so there is no common slot to convert.
    await page.click("[data-testid='common-count-0']");
    await expect(page.locator("[data-testid='rare-count-10']")).toHaveAttribute("aria-checked", "true");

    await page.click("[data-testid='add-epic']");
    await expect(page.locator("[data-testid='rare-count-9']")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("[data-testid='common-count-0']")).toHaveAttribute("aria-checked", "true");
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

  // Nested under "Add pull flow" to reuse its storage-clearing beforeEach.
  test.describe("Save & Continue", () => {
    test("saves, keeps the modal open, resets the form and shows a toast", async ({ page }) => {
      await page.click("button:has-text('Add 10x Pull')");

      await page.click("[data-testid='add-epic']");
      await page.fill("[data-testid='epic-select-0'] input", "Sentry");
      await page.locator("[data-testid='epic-select-0']").getByText("Sentry Protocol").click();

      await page.click("button:has-text('Save & Continue')");

      // Modal stays open for the next entry.
      await expect(page.getByRole("heading", { name: "Add 10x Pull" })).toBeVisible();

      // Toast reports what was just saved.
      const toast = page.getByTestId("toast");
      await expect(toast).toBeVisible();
      await expect(toast).toContainText("Sentry Protocol");
      await expect(toast).toContainText("6 common · 3 rare");

      // Form is back to a fresh entry: no epic rows, default 7 common / 3 rare.
      await expect(page.locator("[data-testid='epic-select-0']")).not.toBeVisible();
      await expect(page.locator("[data-testid='common-count-7']")).toHaveAttribute("aria-checked", "true");
      await expect(page.locator("[data-testid='rare-count-3']")).toHaveAttribute("aria-checked", "true");

      // Enter a second pull in the same session, then close with a normal save.
      await page.click("button:has-text('Save Pull')");
      await expect(page.getByRole("heading", { name: "Add 10x Pull" })).not.toBeVisible();

      await page.click("[data-tab='history']");
      await expect(page.locator("table tbody tr")).toHaveCount(2);
    });

    test("is not offered when editing an existing pull", async ({ page }) => {
      await page.click("button:has-text('Add 10x Pull')");
      await page.click("button:has-text('Save Pull')");

      await page.click("[data-tab='history']");
      await page.click("[data-testid='edit-pull']");
      await expect(page.getByRole("heading", { name: "Edit Pull" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Save & Continue" })).toHaveCount(0);
    });

    test("a double-click saves exactly one pull", async ({ page }) => {
      await page.click("button:has-text('Add 10x Pull')");
      // After a save the form resets to a VALID 7/3 entry, so without the
      // cooldown in PullForm the second click of a double-click would save
      // a phantom blank pull.
      await page.dblclick("button:has-text('Save & Continue')");
      await expect(page.getByTestId("toast")).toBeVisible();
      await page.click("button:has-text('Cancel')");

      await page.click("[data-tab='history']");
      await expect(page.locator("table tbody tr")).toHaveCount(1);
    });
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
