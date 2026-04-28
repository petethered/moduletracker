# Module Tracker for The Tower

## Tech Stack
- React + TypeScript
- Zustand + Immer (state management)
- Tailwind CSS (styling)
- Recharts (charts)
- Vite (build)
- Playwright (E2E tests)
- Vitest (unit tests)

## Commands
- `npm run dev` - Start dev server
- `npm run build` - Production build
- `npm run lint` - ESLint check
- `npx vitest run` - Run unit tests
- `npx vitest run --watch` - Watch mode unit tests
- `npx playwright test` - Run E2E tests
- `npx playwright test --ui` - Playwright UI mode
- `cd worker && npm run dev` - Run Cloudflare Worker locally
- `cd worker && npm run deploy` - Deploy Worker to Cloudflare

## Architecture
- Feature-based folder structure: `src/features/{dashboard,history,modules,analytics,pulls,settings,auth,screenshot}/`
- Shared UI components: `src/components/ui/`
- Store slices: `src/store/{pullsSlice,modulesSlice,uiSlice,settingsSlice,authSlice}.ts`
- Selectors for derived data: `src/store/selectors.ts`
- Cloud sync services: `src/services/{api,auth,sync}.ts` (talks to the worker)
- Shared utilities: `src/utils/` (formatDate, renderLog)
- Module config: `src/config/modules.ts` (edit here to add/remove modules)
- Rarity colors: `src/config/rarityColors.ts`
- Types: `src/types/index.ts`
- Backend: `worker/` is a separate Cloudflare Worker (D1 database, JWT auth, Postmark email). Schema lives in `worker/schema.sql`.

## Build
- The build timestamp is injected via Vite's `define` option (`__BUILD_DATE__` in `vite.config.ts`) and displayed in the footer
- Every `npm run build` automatically captures the current date/time — no manual step needed

## Conventions
- TDD: Write E2E test first for user flows, unit tests first for logic
- All stats are derived via selectors, never stored in state
- Persisted to localStorage (see `partialize` in `src/store/index.ts`): `pulls`, `moduleProgress`, `bannerDefault`, `storageChoice`, `syncEnabled`, `user`. Adding/removing keys requires the local-storage-safety-reviewer agent.
- Rarity colors: common=white, rare=blue, epic=purple, legendary=gold, mythic=red, ancestral=green
- Components should be small and reusable; shared components go in `components/ui/`
- Use Immer's draft mutation syntax in store slices
- Comment heavily. Comments exist to make future AI-agent work on this codebase easier and better — write them for your future self, not for human readers. Capture intent, invariants, gotchas, why-not-the-other-approach, and anything a future agent would otherwise have to re-derive from scratch. Prefer over-commenting to under-commenting; do not strip comments to "clean up".

## Agent Workflow (before commits)
Run these review agents before every commit:
1. architecture-review
2. localization-enforcer
3. code-organization-naming
4. local-storage-safety-reviewer

## Testing
- E2E tests in `e2e/` directory
- Unit tests co-located in `src/__tests__/`
- E2E tests cover: pull CRUD, module rarity updates, tab navigation, import/export, responsive viewports
- Unit tests cover: selectors, store mutations, validation, config integrity
