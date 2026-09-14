// Import from shared fixtures (NOT @playwright/test): the extended `test` pre-seeds
// the persisted `storageChoice` so the first-run StorageChoiceModal never blocks clicks.
import { gzipSync } from "node:zlib";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
// Synthetic save builder shared with the unit tests. A real playerInfo.dat is
// personal player data and must never be committed as a fixture.
import {
  buildPlayerInfoSave,
  GameRarity as R,
  type PlayerInfoSaveSpec,
} from "../src/__tests__/helpers/playerInfoSaveBuilder";

async function uploadSave(page: Page, spec: PlayerInfoSaveSpec) {
  await page.setInputFiles("[data-testid='player-info-input']", {
    name: "playerInfo.dat",
    mimeType: "application/octet-stream",
    buffer: gzipSync(buildPlayerInfoSave(spec)),
  });
}

test.describe("Import Player Info", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.click("[aria-label='Settings']");
  });

  test("sets module rarities from a save file, and a re-import changes nothing", async ({ page }) => {
    const save: PlayerInfoSaveSpec = {
      inventory: [{ infoIndex: 7, rarity: R.fiveStar }],   // Havoc Bringer
      equipped: [{ infoIndex: 51, rarity: R.ancestral }],  // Gilded Sniper
      assist: [null, { infoIndex: 3, rarity: R.epic }],    // Bounce Blitzer (rare-base) — ignored
    };
    await uploadSave(page, save);

    const result = page.getByTestId("player-info-result");
    await expect(result).toContainText("Updated 2 modules");
    await expect(result).toContainText("Havoc Bringer");
    await expect(result).toContainText("Gilded Sniper");
    await expect(result).not.toContainText("Bounce Blitzer");

    await uploadSave(page, save);
    await expect(result).toContainText("already up to date");

    await page.keyboard.press("Escape");
    await page.click("[data-tab='modules']");
    await expect(page.locator("[data-testid='rarity-havoc-bringer']")).toContainText("5*");
    await expect(page.locator("[data-testid='rarity-gilded-sniper']")).toContainText("ancestral");
  });

  test("never lowers a module, and lists what it kept", async ({ page }) => {
    await uploadSave(page, { inventory: [{ infoIndex: 7, rarity: R.fiveStar }] });
    await expect(page.getByTestId("player-info-result")).toContainText("Updated 1 module");

    // A later save claiming a LOWER rarity must not downgrade it.
    await uploadSave(page, { inventory: [{ infoIndex: 7, rarity: R.legendary }] });
    await expect(page.getByTestId("player-info-kept")).toContainText("Havoc Bringer: kept 5*, save has legendary");

    await page.keyboard.press("Escape");
    await page.click("[data-tab='modules']");
    await expect(page.locator("[data-testid='rarity-havoc-bringer']")).toContainText("5*");
  });

  test("shows a plain-language error for a file that isn't a save", async ({ page }) => {
    await page.setInputFiles("[data-testid='player-info-input']", {
      name: "notes.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"pulls": []}'),
    });
    await expect(page.getByTestId("player-info-error")).toContainText("doesn't look like a The Tower save");
  });
});
