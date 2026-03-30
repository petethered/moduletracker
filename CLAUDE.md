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
- `npx vitest run` - Run unit tests
- `npx vitest run --watch` - Watch mode unit tests
- `npx playwright test` - Run E2E tests
- `npx playwright test --ui` - Playwright UI mode

## Architecture
- Feature-based folder structure: `src/features/{dashboard,history,modules,analytics,pulls,settings}/`
- Shared UI components: `src/components/ui/`
- Store slices: `src/store/{pullsSlice,modulesSlice,uiSlice,settingsSlice}.ts`
- Selectors for derived data: `src/store/selectors.ts`
- Module config: `src/config/modules.ts` (edit here to add/remove modules)
- Rarity colors: `src/config/rarityColors.ts`
- Types: `src/types/index.ts`

## Conventions
- TDD: Write E2E test first for user flows, unit tests first for logic
- All stats are derived via selectors, never stored in state
- Only `pulls` and `moduleProgress` are persisted to localStorage
- Rarity colors: common=white, rare=blue, epic=purple, legendary=gold, mythic=red, ancestral=green
- Components should be small and reusable; shared components go in `components/ui/`
- Use Immer's draft mutation syntax in store slices

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
