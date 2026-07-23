// Import from shared fixtures (NOT @playwright/test): the extended `test` pre-seeds
// the persisted `storageChoice` via addInitScript so the first-run
// StorageChoiceModal overlay never renders and blocks clicks. See e2e/fixtures.ts.
import { test, expect } from "./fixtures";
import path from "path";
import fs from "fs";

test.describe("Import/Export", () => {
  test("exports and imports data", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Add a pull
    await page.click("button:has-text('Add 10x Pull')");
    // Rarity counts are now a button grid (data-testid="common-count-N" /
    // "rare-count-N" per src/features/pulls/PullForm.tsx), not <select> elements —
    // the old selectOption("[data-testid='common-count']", ...) API is gone.
    await page.click("[data-testid='common-count-7']");
    await page.click("[data-testid='rare-count-3']");
    await page.click("button:has-text('Save Pull')");

    // Open settings
    await page.click("[aria-label='Settings']");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    // Export
    const downloadPromise = page.waitForEvent("download");
    await page.click("button:has-text('Export Data')");
    const download = await downloadPromise;
    const filePath = path.join("/tmp", download.suggestedFilename());
    await download.saveAs(filePath);

    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    expect(data.pulls).toHaveLength(1);

    // Clear data (settings modal is already open from export step)
    await page.click("button:has-text('Reset All Data')");
    await page.click("button:has-text('Delete')");

    // Verify cleared
    await page.click("[data-tab='history']");
    await expect(page.getByText(/no pulls recorded/i)).toBeVisible();

    // Import
    await page.click("[aria-label='Settings']");
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.click("button:has-text('Import Data')");
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);

    // Verify imported
    await page.click("[data-tab='history']");
    await expect(page.locator("table tbody tr")).toHaveCount(1);

    // Cleanup
    fs.unlinkSync(filePath);
  });
});
