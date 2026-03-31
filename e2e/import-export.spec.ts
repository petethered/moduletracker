import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

test.describe("Import/Export", () => {
  test("exports and imports data", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Add a pull
    await page.click("button:has-text('Add 10x Pull')");
    await page.selectOption("[data-testid='common-count']", "7");
    await page.selectOption("[data-testid='rare-count']", "3");
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

    // Clear data
    await page.click("[aria-label='Settings']");
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
