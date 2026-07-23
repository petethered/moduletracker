// Import from shared fixtures (NOT @playwright/test): the extended `test` pre-seeds
// the persisted `storageChoice` via addInitScript so the first-run
// StorageChoiceModal overlay never renders and blocks clicks. See e2e/fixtures.ts.
import { test, expect, resetAppData } from "./fixtures";

test.describe("Analytics", () => {
  test("shows empty state with no data", async ({ page }) => {
    // resetAppData (not a bare localStorage.clear() init script): clears persisted
    // data but re-seeds storageChoice so StorageChoiceModal stays suppressed.
    await resetAppData(page);
    await page.goto("/");
    await page.click("[data-tab='analytics']");
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
    await expect(page.getByText(/add some pulls to see analytics/i)).toBeVisible();
  });

  test("shows charts with data", async ({ page }) => {
    // See note above: clear + re-seed storageChoice in one order-independent script.
    await resetAppData(page);
    await page.goto("/");

    // Add a pull with an epic. The form defaults to 7 common / 3 rare; clicking
    // "+ Add Epic" auto-subtracts one from rare, yielding the intended 7/2/1
    // split. (The old <select data-testid='common-count'> API no longer exists —
    // counts are a button grid now, and the epic row is added via add-epic.)
    await page.click("button:has-text('Add 10x Pull')");
    await page.click("[data-testid='add-epic']");
    // The just-added epic row's SearchSelect mounts already open (defaultOpen,
    // see src/features/pulls/PullForm.tsx) — do NOT click its trigger button,
    // that would toggle the panel closed.
    await page.fill("[data-testid='epic-select-0'] input", "Death");
    await page.locator("[data-testid='epic-select-0']").getByText("Death Penalty").click();
    await page.click("button:has-text('Save Pull')");

    await page.click("[data-tab='analytics']");

    await expect(page.locator("[data-testid='pity-tracker']")).toBeVisible();
    await expect(page.locator("[data-testid='module-distribution-chart']")).toBeVisible();
  });
});
