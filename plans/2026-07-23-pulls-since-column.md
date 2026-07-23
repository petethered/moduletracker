# "Pulls Since" Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Pulls Since" column to the Module Collection tables showing individual draws since each module was last drawn.

**Architecture:** A new derived selector `selectPullsSinceLastDrawnForModule` in `src/store/selectors.ts` (no state changes), a new shared locale-aware integer formatter `src/utils/formatNumber.ts`, and a new column in `src/features/modules/ModuleTable.tsx` between "Last Pulled" and "Rarity". Spec: `specs/2026-07-23-pulls-since-column-design.md`.

**Tech Stack:** React + TypeScript, Zustand (read-only here), Vitest unit tests, Playwright E2E.

## Global Constraints

- All stats derived via selectors, never stored in state (project CLAUDE.md).
- Comment heavily — intent, invariants, gotchas, for future AI agents (project CLAUDE.md).
- Never include Co-Authored-By in commit messages.
- Each `PullRecord` is one 10x batch: `commonCount + rareCount + epicModules.length === 10`.
- Pull ordering = date descending with same-date ties broken by insertion index (later index = newer) — always via `sortPullsNewest`, never re-derived.
- Semantics (from spec): Pulls Since = batches strictly newer than the module's newest appearance × 10; drawn in newest batch → `0`; never drawn → `pulls.length * 10`; empty pulls → `0`; all banners counted, no filtering.
- No localStorage/persistence changes anywhere in this plan.
- Run the four review agents (architecture-review, localization-enforcer, code-organization-naming, local-storage-safety-reviewer) before each commit — orchestrator's responsibility.

---

### Task 1: `selectPullsSinceLastDrawnForModule` selector

**Files:**
- Modify: `src/store/selectors.ts` (add selector directly after `selectLastPullDateForModule`, which ends at line 388)
- Test: `src/__tests__/selectors.test.ts` (new `describe` block at end of file; add import)

**Interfaces:**
- Consumes: `sortPullsNewest(pulls: PullRecord[]): PullRecord[]` (selectors.ts:81) — existing.
- Produces: `selectPullsSinceLastDrawnForModule(pulls: PullRecord[], moduleId: string): number` — Task 3 imports this in ModuleTable.

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/selectors.test.ts`, add `selectPullsSinceLastDrawnForModule` to the existing import list from `"../store/selectors"` (lines 3–19), then append at the end of the file (uses the existing `makePull` helper from line 21):

```ts
describe("selectPullsSinceLastDrawnForModule", () => {
  it("returns 0 for empty pulls array", () => {
    expect(selectPullsSinceLastDrawnForModule([], "death-penalty")).toBe(0);
  });

  it("returns total lifetime draws when module never drawn", () => {
    // 3 batches logged, module never appeared -> drought counter = 3 * 10.
    const pulls = [
      makePull({ date: "2026-03-01", epicModules: ["a"] }),
      makePull({ date: "2026-03-02", epicModules: [] }),
      makePull({ date: "2026-03-03", epicModules: ["b"] }),
    ];
    expect(selectPullsSinceLastDrawnForModule(pulls, "never-drawn")).toBe(30);
  });

  it("returns 0 when module drawn in the newest batch", () => {
    const pulls = [
      makePull({ date: "2026-03-01", epicModules: ["target"] }),
      makePull({ date: "2026-03-05", epicModules: ["target", "other"] }),
    ];
    expect(selectPullsSinceLastDrawnForModule(pulls, "target")).toBe(0);
  });

  it("returns K * 10 when module drawn K batches ago", () => {
    // Newest-first order: 03-04, 03-03, 03-02 (target), 03-01.
    // 2 batches are strictly newer than the target's batch -> 20.
    const pulls = [
      makePull({ date: "2026-03-01", epicModules: [] }),
      makePull({ date: "2026-03-02", epicModules: ["target"] }),
      makePull({ date: "2026-03-03", epicModules: ["other"] }),
      makePull({ date: "2026-03-04", epicModules: [] }),
    ];
    expect(selectPullsSinceLastDrawnForModule(pulls, "target")).toBe(20);
  });

  it("breaks same-date ties by insertion order (later insertion = newer)", () => {
    // Both batches share a date. The SECOND array entry is treated as newer,
    // so the target (in the first entry) has 1 newer batch -> 10.
    const pulls = [
      makePull({ date: "2026-03-05", epicModules: ["target"] }),
      makePull({ date: "2026-03-05", epicModules: ["other"] }),
    ];
    expect(selectPullsSinceLastDrawnForModule(pulls, "target")).toBe(10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/selectors.test.ts`
Expected: FAIL — `selectPullsSinceLastDrawnForModule` is not exported (import error / undefined).

- [ ] **Step 3: Write the selector**

In `src/store/selectors.ts`, insert immediately after `selectLastPullDateForModule` (after line 388):

```ts
/**
 * Number of INDIVIDUAL module draws since `moduleId` last dropped at epic.
 *
 * Units: individual draws, not batches. Each PullRecord is one 10x batch
 * (invariant: commonCount + rareCount + epicModules.length === 10), so the
 * result is always a multiple of 10. Intra-batch draw order is not tracked,
 * which is WHY the batch containing the module contributes 0 partial draws —
 * we count only batches strictly newer than it.
 *
 * Semantics (see specs/2026-07-23-pulls-since-column-design.md):
 *   - Drawn in the newest batch -> 0.
 *   - Never drawn -> pulls.length * 10 (total lifetime draws — a drought
 *     counter from day one for unowned modules; deliberately NOT null/"-",
 *     unlike selectLastPullDateForModule).
 *   - Empty pulls -> 0 (falls out of the never-drawn rule).
 *   - Counts ALL banners, matching selectLastPullDateForModule. Do not add
 *     banner filtering here without also changing that selector.
 *
 * Ordering is delegated to sortPullsNewest (date desc, same-date ties broken
 * by insertion index) — the same ordering selectLastPullDateForModule uses,
 * so the two columns can never disagree about which batch was "last".
 *
 * Perf note: re-sorts per call, same as selectLastPullDateForModule which is
 * called alongside it per table row. O(n log n) per row is accepted at
 * realistic data sizes (hundreds of batches); if that ever hurts, the fix is
 * a combined one-pass {lastDate, pullsSince} selector (considered and
 * rejected in the spec as premature).
 */
export function selectPullsSinceLastDrawnForModule(
  pulls: PullRecord[],
  moduleId: string
): number {
  const sorted = sortPullsNewest(pulls);
  for (let i = 0; i < sorted.length; i++) {
    // i batches are strictly newer than sorted[i]; 10 draws per batch.
    if (sorted[i].epicModules.includes(moduleId)) return i * 10;
  }
  // Never drawn: every logged draw counts toward the drought.
  return pulls.length * 10;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/selectors.test.ts`
Expected: PASS (all pre-existing tests plus the 5 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/store/selectors.ts src/__tests__/selectors.test.ts
git commit -m "feat: add selectPullsSinceLastDrawnForModule selector"
```

---

### Task 2: Shared locale-aware integer formatter

**Files:**
- Create: `src/utils/formatNumber.ts`
- Test: `src/__tests__/formatNumber.test.ts` (new file — utils tests live in `src/__tests__/` like `screenshotData.test.ts`)

**Interfaces:**
- Consumes: nothing.
- Produces: `formatInteger(n: number): string` — Task 3 imports this in ModuleTable.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/formatNumber.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatInteger } from "../utils/formatNumber";

describe("formatInteger", () => {
  it("formats zero", () => {
    expect(formatInteger(0)).toBe("0");
  });

  it("formats small integers without separators", () => {
    expect(formatInteger(120)).toBe("120");
  });

  it("uses the runtime locale's grouping for thousands", () => {
    // Exact separator varies by locale (","/"."/" "), so assert equivalence
    // with toLocaleString rather than a hardcoded string. This is not a
    // tautology: it pins formatInteger to locale-aware output, so a future
    // "simplification" to `String(n)` fails this test.
    expect(formatInteger(1234)).toBe((1234).toLocaleString());
    expect(formatInteger(1234)).not.toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/formatNumber.test.ts`
Expected: FAIL — cannot resolve `../utils/formatNumber`.

- [ ] **Step 3: Write the utility**

Create `src/utils/formatNumber.ts`:

```ts
/**
 * Number formatting helpers — the app's source of truth for locale-aware
 * numeric display, sibling to formatDate.ts (which owns dates).
 *
 * ROLE IN SYSTEM:
 * Raw numbers from selectors are unformatted; display layers route them
 * through here so grouping separators follow the user's locale ("1,234" in
 * en-US, "1.234" in de-DE, "1 234" in fr-FR). Never interpolate a raw
 * selector number into JSX when it can plausibly exceed 3 digits.
 *
 * IMPORTERS (non-exhaustive): ModuleTable "Pulls Since" column. Add future
 * stat displays here rather than calling toLocaleString inline — a single
 * choke point keeps formatting consistent and reviewable
 * (localization-enforcer agent checks for this).
 */

/**
 * Format an integer with locale-aware grouping separators.
 *
 * @param n An integer. Behavior for non-integers is whatever
 *   `toLocaleString` does (locale-dependent decimals) — callers are
 *   expected to pass integers; round first if unsure.
 * @returns e.g. `"1,234"` in `en-US`. `undefined` locale defers to the
 *   runtime default, matching formatDisplayDate's approach.
 */
export function formatInteger(n: number): string {
  return n.toLocaleString(undefined);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/formatNumber.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/formatNumber.ts src/__tests__/formatNumber.test.ts
git commit -m "feat: add shared locale-aware formatInteger utility"
```

---

### Task 3: "Pulls Since" column in ModuleTable + E2E assertion

**Files:**
- Modify: `src/features/modules/ModuleTable.tsx` (header docblock ~lines 17–31, imports ~lines 56–69, colgroup ~lines 121–131, thead ~lines 132–141, row body ~lines 148–165)
- Test: `e2e/modules.spec.ts` (new test inside the existing `test.describe("Module collection", ...)`)

**Interfaces:**
- Consumes: `selectPullsSinceLastDrawnForModule(pulls, moduleId): number` (Task 1), `formatInteger(n): string` (Task 2).
- Produces: user-visible column; no downstream consumers.

- [ ] **Step 1: Write the failing E2E test**

In `e2e/modules.spec.ts`, add inside `test.describe("Module collection", ...)` after the "shows all 24 modules" test:

```ts
  test("shows Pulls Since column header", async ({ page }) => {
    await page.goto("/");
    await page.click("[data-tab='modules']");
    // One table per module type -> 4 matching headers; assert the first.
    await expect(
      page.getByRole("columnheader", { name: "Pulls Since" }).first()
    ).toBeVisible();
  });
```

- [ ] **Step 2: Run E2E test to verify it fails**

Run: `npx playwright test e2e/modules.spec.ts -g "Pulls Since"`
Expected: FAIL — no columnheader named "Pulls Since".

- [ ] **Step 3: Implement the column**

All edits in `src/features/modules/ModuleTable.tsx`.

**3a — imports:** extend the selectors import and add the formatter:

```ts
import {
  selectModulePullCounts,
  selectModuleEpicPercentage,
  selectLastPullDateForModule,
  selectPullsSinceLastDrawnForModule,
} from "../../store/selectors";
```

and after the `formatDisplayDate` import (line 69):

```ts
import { formatInteger } from "../../utils/formatNumber";
```

**3b — file-header docblock:** in the "Column ordering decisions" block (lines 17–31), update the width notes to the new values and insert a new entry between "Last Pulled" and the hidden Progress entry, so the list reads:

```
 *   1. Module       — name. 30% width, the widest; this is what users scan.
 *   2. Count        — total copies pulled. 10%, narrow numeric.
 *   3. % of Epics   — share of all epic drops that landed on this module.
 *                     14%; helps surface "lucky" or "cursed" modules.
 *   4. Last Pulled  — friendly date. 18%; useful for dry-streak intuition.
 *   5. Pulls Since  — individual draws since last drawn (batches-after ×10).
 *                     12%; quantifies the dry streak Last Pulled only hints
 *                     at. Never-drawn modules show TOTAL lifetime draws (a
 *                     drought counter from day one), NOT "-" — deliberate,
 *                     see specs/2026-07-23-pulls-since-column-design.md.
 *  (Hidden) Progress— a graphical progress bar toward 5-star (18 copies).
 *                     Currently commented out but the colgroup col and
 *                     header slot are LEFT IN PLACE so re-enabling it is
 *                     a one-block uncomment, not a re-layout. Do NOT
 *                     delete the placeholder col/header — it preserves
 *                     the planned restoration.
 *   6. Rarity       — manually-asserted current rarity tier. 16%;
 *                     rightmost because it's the only editable cell and
 *                     thumbs land there naturally on mobile.
```

**3c — colgroup** (replace lines 121–131; hidden Progress comment kept verbatim):

```tsx
                <colgroup>
                  <col style={{ width: "30%" }} /> {/* Module name */}
                  <col style={{ width: "10%" }} /> {/* Count */}
                  <col style={{ width: "14%" }} /> {/* % of Epics */}
                  <col style={{ width: "18%" }} /> {/* Last Pulled */}
                  <col style={{ width: "12%" }} /> {/* Pulls Since */}
                  {/* Progress column hidden - kept for future use.
                      Do NOT remove this <col>: keeping it preserves the
                      planned column slot so the eventual restoration is
                      a one-block edit, not a re-layout. */}
                  <col style={{ width: "16%" }} /> {/* Rarity */}
                </colgroup>
```

**3d — thead:** add between the "Last Pulled" `<th>` (line 137) and the hidden-Progress comment:

```tsx
                    <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Pulls Since</th>
```

**3e — row derivation:** after the `lastPulled` line (line 155):

```tsx
                    // Individual draws since this module last dropped
                    // (batches-after × 10). Never-drawn modules get total
                    // lifetime draws, so this is ALWAYS a number — no "-"
                    // branch, unlike lastPulled. See selector docblock.
                    const pullsSince = selectPullsSinceLastDrawnForModule(pulls, mod.id);
```

**3f — cell:** add between the Last Pulled `<td>` (line 165) and the hidden Progress cell comment:

```tsx
                        {/* Always numeric (never "-"): never-drawn shows total
                            lifetime draws by design. Locale-aware grouping via
                            formatInteger (localization convention). */}
                        <td className="px-3 py-2 text-gray-400">{formatInteger(pullsSince)}</td>
```

- [ ] **Step 4: Run E2E test to verify it passes**

Run: `npx playwright test e2e/modules.spec.ts`
Expected: PASS (all 3 tests — the 2 pre-existing ones prove no regression).

- [ ] **Step 5: Full verification**

Run: `npx vitest run && npm run lint && npm run build`
Expected: all unit tests pass, no lint errors, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/features/modules/ModuleTable.tsx e2e/modules.spec.ts
git commit -m "feat: add Pulls Since column to module collection tables"
```
