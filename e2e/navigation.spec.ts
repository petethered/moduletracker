import { test, expect } from "@playwright/test";

test.describe("Tab navigation", () => {
  test("shows dashboard by default", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Module Tracker")).toBeVisible();
    await expect(page.getByRole("button", { name: /add 10x pull/i })).toBeVisible();
  });

  test("switches between tabs", async ({ page }) => {
    await page.goto("/");

    await page.click("[data-tab='history']");
    await expect(page.getByText("Pull History")).toBeVisible();

    await page.click("[data-tab='modules']");
    await expect(page.getByText("Module Collection")).toBeVisible();

    await page.click("[data-tab='analytics']");
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();

    await page.click("[data-tab='dashboard']");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("Add 10x Pull button opens modal", async ({ page }) => {
    await page.goto("/");
    await page.click("button:has-text('Add 10x Pull')");
    await expect(page.getByRole("heading", { name: "Add 10x Pull" })).toBeVisible();
  });
});
