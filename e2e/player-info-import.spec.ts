// Import from shared fixtures (NOT @playwright/test): the extended `test` pre-seeds
// the persisted `storageChoice` so the first-run StorageChoiceModal never blocks clicks.
import { gzipSync } from "node:zlib";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
// Synthetic save builder shared with the unit tests. A real playerInfo.dat is
// personal player data and must never be committed as a fixture.
import {
  buildPlayerInfoSave,
  buildPullDrops,
  GameRarity as R,
  type PlayerInfoSaveSpec,
} from "../src/__tests__/helpers/playerInfoSaveBuilder";
import { buildTds1Save } from "../src/__tests__/helpers/tds1SaveBuilder";

/** The single "Import Save" result modal both buttons open (PlayerInfoImportProvider). */
const resultDialog = (page: Page) => page.getByRole("dialog", { name: "Import Save" });

/**
 * Settings → Import Player Info: open Settings, pick the file. Settings then
 * closes and the shared result modal opens (Settings is itself a Modal; two
 * stacked ones fight over Escape/focus).
 */
async function uploadSaveFromSettings(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.click("[aria-label='Settings']");
  await page.setInputFiles("[data-testid='player-info-input']", file);
  await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);
}

const saveFile = (spec: PlayerInfoSaveSpec) => ({
  name: "playerInfo.dat",
  mimeType: "application/octet-stream",
  buffer: gzipSync(buildPlayerInfoSave(spec)),
});

async function closeResult(page: Page) {
  await resultDialog(page).getByRole("button", { name: "Done" }).click();
}

test.describe("Import Player Info (Settings button)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("sets module rarities from a save file, and a re-import says nothing changed", async ({ page }) => {
    const save: PlayerInfoSaveSpec = {
      inventory: [{ infoIndex: 7, rarity: R.fiveStar }],   // Havoc Bringer
      equipped: [{ infoIndex: 51, rarity: R.ancestral }],  // Gilded Sniper
      assist: [null, { infoIndex: 3, rarity: R.epic }],    // Bounce Blitzer (rare-base) — ignored
    };
    await uploadSaveFromSettings(page, saveFile(save));

    const result = resultDialog(page).getByTestId("player-info-result");
    await expect(result).toContainText("Updated 2 modules");
    await expect(result).toContainText("Havoc Bringer");
    await expect(result).toContainText("Gilded Sniper");
    await expect(result).not.toContainText("Bounce Blitzer");
    await closeResult(page);

    await uploadSaveFromSettings(page, saveFile(save));
    await expect(resultDialog(page).getByTestId("player-info-headline")).toHaveText(
      "Already up to date — nothing changed.",
    );
    await closeResult(page);

    await page.click("[data-tab='modules']");
    await expect(page.locator("[data-testid='rarity-havoc-bringer']")).toContainText("5*");
    await expect(page.locator("[data-testid='rarity-gilded-sniper']")).toContainText("ancestral");
  });

  test("never lowers a module, and lists what it kept", async ({ page }) => {
    await uploadSaveFromSettings(page, saveFile({ inventory: [{ infoIndex: 7, rarity: R.fiveStar }] }));
    await expect(resultDialog(page).getByTestId("player-info-result")).toContainText("Updated 1 module");
    await closeResult(page);

    // A later save claiming a LOWER rarity must not downgrade it.
    await uploadSaveFromSettings(page, saveFile({ inventory: [{ infoIndex: 7, rarity: R.legendary }] }));
    await expect(resultDialog(page).getByTestId("player-info-kept")).toContainText(
      "Havoc Bringer: kept 5*, save has legendary",
    );
    // Nothing written, but the save is LOWER: don't claim the levels "match".
    await expect(resultDialog(page).getByTestId("player-info-nothing-changed")).toHaveText(
      "This save has no new pulls, and no module levels needed raising.",
    );
    await closeResult(page);

    await page.click("[data-tab='modules']");
    await expect(page.locator("[data-testid='rarity-havoc-bringer']")).toContainText("5*");
  });

  test("shows a plain-language error for a file that isn't a save", async ({ page }) => {
    await uploadSaveFromSettings(page, {
      name: "notes.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"pulls": []}'),
    });
    await expect(resultDialog(page).getByTestId("player-info-error")).toContainText(
      "doesn't look like a The Tower save",
    );
  });
});

// Local-time start (the browser runs in the same TZ as Playwright locally), so
// the imported pulls land on 2026-10-12 in the History table.
const OCT_12_9AM = new Date(2026, 9, 12, 9, 0).getTime();

async function uploadSaveFromHeader(page: Page, spec: PlayerInfoSaveSpec) {
  await page.setInputFiles("[data-testid='player-info-header-input']", {
    name: "playerInfo.dat",
    mimeType: "application/octet-stream",
    buffer: gzipSync(buildPlayerInfoSave(spec)),
  });
}

test.describe("Import Save (header button)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("sits left of + Add 10x Pull", async ({ page }) => {
    // Regexes match both labels: "Import Save" (aria-label, every width) and "+ Add 10x Pull"/"+ Add Pull" (mobile).
    const importBox = await page.getByRole("button", { name: "Import Save" }).boundingBox();
    const addBox = await page.getByRole("button", { name: /^\+ Add (10x )?Pull$/ }).boundingBox();
    expect(importBox!.x).toBeLessThan(addBox!.x);
  });

  test("imports new pulls, then skips them on re-import", async ({ page }) => {
    const save: PlayerInfoSaveSpec = {
      pullDrops: buildPullDrops(
        [{ common: 8, rare: 2 }, { common: 7, rare: 2, epics: [7] }], // 7 = Havoc Bringer
        OCT_12_9AM,
        "Infinity Threshold Banner",
      ),
    };
    await uploadSaveFromHeader(page, save);
    const dialog = page.getByRole("dialog", { name: "Import Save" });
    await expect(dialog.getByTestId("player-info-headline")).toHaveText("Imported 2 new pulls.");
    await expect(dialog.getByTestId("player-info-pulls")).toContainText("Havoc Bringer");
    await dialog.getByRole("button", { name: "Done" }).click();

    await uploadSaveFromHeader(page, save);
    // Nothing new: the modal still opens and says so plainly (user report:
    // "Imported 0 new pulls · skipped 2" looked like nothing had happened).
    await expect(dialog.getByTestId("player-info-headline")).toHaveText("Already up to date — nothing changed.");
    await expect(dialog.getByTestId("player-info-nothing-changed")).toHaveText(
      "All 2 pulls in this save are already logged, and your module levels already match it.",
    );
    await dialog.getByRole("button", { name: "Done" }).click();

    await page.click("[data-tab='history']");
    await expect(page.getByText("Havoc Bringer")).toHaveCount(1);
  });

  test("reads a game-29.1+ encrypted (TDS1) save, decrypted in the browser", async ({ page }) => {
    const gz = gzipSync(
      buildPlayerInfoSave({
        inventory: [{ infoIndex: 7, rarity: R.fiveStar }],
        // 29.1.1 dropped `origin` from pull records; null mirrors that.
        pullDrops: buildPullDrops([{ common: 9, rare: 1 }], OCT_12_9AM, null),
      }),
    );
    await page.setInputFiles("[data-testid='player-info-header-input']", {
      name: "playerInfo.dat",
      mimeType: "application/octet-stream",
      buffer: Buffer.from(await buildTds1Save(gz)),
    });
    const dialog = page.getByRole("dialog", { name: "Import Save" });
    await expect(dialog.getByTestId("player-info-headline")).toHaveText("Imported 1 new pull · raised 1 module level.");
  });
});
