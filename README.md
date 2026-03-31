# Module Tracker - The Tower

A web app for tracking gacha module pulls in [The Tower](https://the-tower-idle-tower-defense.fandom.com/wiki/The_Tower_Idle_Tower_Defense_Wiki) idle tower defense game. Replaces spreadsheet tracking with a dedicated UI for recording 10x pulls, monitoring module collection progress, and analyzing pull statistics.

## Features

- **Pull Logging** - Record 10x pulls with common/rare/epic counts and specific epic module names
- **Module Collection** - Track all 24 epic modules across 4 types (Cannon, Armor, Generator, Core) with merge rarity progression from Epic through 5-Star
- **Dashboard** - At-a-glance stats, recent pulls, rarity breakdown, collection grid, merge progress, pull calendar heatmap, and type balance
- **Analytics** - Pity tracker, predicted gems to completion, luck streaks, pull rate trends, gems-per-epic charts, and module distribution
- **Pull History** - Full history table with sorting, editing, and deletion
- **Import/Export** - JSON export/import for backups, plus bulk text import from spreadsheets
- **Offline-first** - All data stored in localStorage, no server required

## Tech Stack

- React + TypeScript
- Zustand + Immer (state management)
- Tailwind CSS v4 (styling)
- Recharts (charts)
- Vite (build)
- Playwright (E2E tests)
- Vitest (unit tests)

## Getting Started

```bash
npm install
npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npx vitest run` | Run unit tests |
| `npx playwright test` | Run E2E tests |

## Project Structure

```
src/
  components/ui/    # Shared UI components (Button, Modal, Table, etc.)
  config/           # Module definitions, rarity colors
  features/         # Feature-based folders
    dashboard/      # Dashboard widgets
    history/        # Pull history table
    modules/        # Module collection table
    analytics/      # Charts and analytics
    pulls/          # Pull form and modal
    settings/       # Import/export, bulk import
  store/            # Zustand store slices and selectors
  types/            # TypeScript type definitions
```

## License

MIT
