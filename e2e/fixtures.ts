/**
 * Shared E2E test fixtures — StorageChoiceModal suppression.
 *
 * WHY THIS FILE EXISTS:
 * Since cloud-sync landed (commit a088760), src/App.tsx renders
 * StorageChoiceModal on first run: whenever the persisted `storageChoice` is
 * null/unset, a full-screen non-dismissible overlay (fixed inset-0 z-50)
 * covers the app and intercepts ALL pointer events. In a fresh Playwright
 * browser profile localStorage is empty, so every spec's first click was
 * swallowed by the overlay and the whole suite failed.
 *
 * APPROACH CHOSEN (and why):
 * We pre-seed the Zustand persist localStorage key via `page.addInitScript`
 * so the modal never renders — approach (a) — rather than dismissing the
 * modal through its "Local Storage Only" button — approach (b). Rationale:
 *   - addInitScript re-runs on EVERY document load (initial goto, reload,
 *     any navigation). Several specs do `localStorage.clear()` + `reload()`
 *     mid-test (e.g. e2e/modules.spec.ts, e2e/pull-flow.spec.ts,
 *     e2e/responsive.spec.ts); the seed script transparently re-seeds after
 *     each clear, so the modal stays suppressed with ZERO per-navigation
 *     boilerplate in the specs.
 *   - Approach (b) would require a dismiss call after every goto AND every
 *     mid-test reload-after-clear — many call sites, easy to miss when a new
 *     test is added, and each dismissal adds a click + persist round-trip.
 *   - The real first-run modal UX is still exercisable by a dedicated
 *     onboarding spec if one is ever written (just import from
 *     "@playwright/test" directly there instead of this file).
 *
 * COUPLING WARNING — BRITTLE BY DESIGN, READ BEFORE CHANGING THE STORE:
 * The seed below is tightly coupled to src/store/index.ts:
 *   - STORAGE_KEY must equal the persist `name` option
 *     ("module-tracker-storage"). If that string changes there, change it
 *     here too.
 *   - The JSON envelope `{ state: {...}, version: 0 }` is zustand/persist's
 *     on-disk shape. `version: 0` matches the store's (implicit, defaulted)
 *     persist version — if a `version`/`migrate` is ever added to the persist
 *     config, update this seed or zustand will discard it on rehydrate.
 *   - `storageChoice: "local"` is merged shallowly over the store's initial
 *     state on rehydrate (zustand's default merge), so all other slices keep
 *     their defaults — tests still start from a pristine app, just with the
 *     storage decision already made. See the `partialize` whitelist in
 *     src/store/index.ts for the full set of persisted keys.
 */
import { test as base, expect, type Page } from "@playwright/test";

/** Must match the persist `name` in src/store/index.ts. */
const STORAGE_KEY = "module-tracker-storage";

/**
 * Minimal persisted payload that convinces StorageChoiceModal it can hide
 * (its gate is `storageChoice !== null`). Kept as a string constant so it can
 * be embedded verbatim inside init scripts (which serialize their closures).
 */
const SEED_JSON = JSON.stringify({
  state: { storageChoice: "local" },
  version: 0,
});

/**
 * Extended `test` that auto-suppresses StorageChoiceModal for every test.
 *
 * Overrides the built-in `page` fixture: before the test body runs, an init
 * script is registered that seeds `storageChoice` ONLY when the persist key
 * is absent. The "only when absent" guard is critical — tests that populate
 * pulls/moduleProgress and then reload must NOT have their persisted data
 * clobbered by the seed; the seed only fires on a genuinely empty profile
 * (fresh context, or right after a test called `localStorage.clear()`).
 *
 * Specs import { test, expect } from "./fixtures" instead of
 * "@playwright/test" — that one-line change is the entire per-spec cost.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // NOTE: init-script closures execute in the BROWSER, not Node — they
    // cannot capture outer variables, so key/seed are passed via the `arg`
    // parameter (Playwright serializes it into the page context).
    await page.addInitScript(
      ([key, seed]) => {
        if (window.localStorage.getItem(key) === null) {
          window.localStorage.setItem(key, seed);
        }
      },
      [STORAGE_KEY, SEED_JSON] as const
    );
    await use(page);
  },
});

/**
 * Wipe all persisted app data at (every subsequent) document load, then
 * re-seed only `storageChoice` so StorageChoiceModal stays hidden.
 *
 * Use this INSTEAD of `page.addInitScript(() => localStorage.clear())`
 * (the old pattern in e2e/analytics.spec.ts). A bare clear() init script is
 * incompatible with the auto-seed above: init scripts run in registration
 * order, so the fixture's seed (registered first) would be erased by the
 * spec's clear (registered second) and the modal would reappear. This helper
 * clears AND re-seeds inside a single script, making it order-independent.
 *
 * Call BEFORE `page.goto()` — like addInitScript, it only affects documents
 * loaded after registration.
 *
 * GOTCHA: the wipe fires on EVERY subsequent load, not just the first — a
 * test that calls this, adds data, then reloads/navigates will silently
 * wipe its own in-test data. If you need "clean start, then keep data
 * across reloads", don't use this helper mid-test; rely on the fixture's
 * fresh browser context instead.
 */
export async function resetAppData(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, seed]) => {
      window.localStorage.clear();
      window.localStorage.setItem(key, seed);
    },
    [STORAGE_KEY, SEED_JSON] as const
  );
}

// Re-export expect so specs need exactly one import line from this module.
export { expect };
