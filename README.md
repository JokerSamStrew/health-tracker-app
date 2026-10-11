# Health Tracker

A local-first web app for logging daily health metrics and turning that log into
detected problems plus concrete recommendations.

Four metrics are tracked per day — **weight**, **steps**, **sleep hours** and
**calories eaten** — and optional profile data (age, sex, height, activity level,
goals) unlocks the energy-balance and goal-tracking analysis.

> Not medical advice. The app surfaces patterns in your own logs; it does not
> diagnose anything. Talk to a doctor about health concerns.

## Features

- **Daily log** — one entry per day, every field optional, back-datable up to
  three years.
- **Four timelines** — Recharts line charts with a 7-day rolling average, the
  latest/average/trend stats, and a dashed goal line for any goal you set.
- **Insight engine** — 14 rules across data quality, body composition, weight,
  recovery, activity and energy. Each insight shows the numbers it used
  (`evidence`) and what to do about it (`recommendations`).
- **Cross-metric analysis** — e.g. short sleep alongside a rising weight, or
  logged calories that do not explain the weight change you are seeing.
- **Health score** — 0–100, derived from the severity of the findings.
- **JSON backup** — export everything (entries + profile) to a `.json` file and
  restore it later; importing replaces the current data after confirmation.
- **Sample data** — one click seeds 90 deterministic days so the app can be
  explored without typing anything.

## Stack

| Concern | Choice |
| --- | --- |
| Build / dev server | Vite 7 |
| UI | React 19 + TypeScript (strict) |
| Charts | Recharts 3 |
| Tests | Vitest 4 + jsdom + Testing Library |
| Package manager | pnpm 12 |
| Persistence | `localStorage` only |

## Getting started

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

Requires Node 22+ and pnpm. There is no backend, no account and no network
call — everything runs in the browser.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server with HMR |
| `pnpm build` | Typecheck (`tsc -b`) then production build into `dist/` |
| `pnpm preview` | Serve the production build locally |
| `pnpm typecheck` | Type-only check across app and node configs |
| `pnpm test` | Run the whole unit-test suite once |
| `pnpm test:watch` | Same suite in watch mode |
| `pnpm test:coverage` | Suite plus a v8 coverage report (`coverage/`) |
| `pnpm lint` | Alias for a forced `tsc -b`; type errors are the lint |

## Project layout

```
src/
  types.ts               Domain model: entries, profile, summaries, insights
  lib/                   Pure logic — no React, no DOM, no clock
    date.ts              ISO date helpers, all local-timezone safe
    stats.ts             mean/median/stdDev, regression, correlation, formatting
    health.ts            BMI, BMR (Mifflin-St Jeor), TDEE, calorie targets
    series.ts            Entries -> ordered series and per-metric summaries
    insights.ts          The rule engine: analyzeHealth() + THRESHOLDS
    charts.ts            Recharts-shaped data, gaps as null, axis domains
    storage.ts           localStorage read/write with defensive sanitizing
    backup.ts            JSON export/import envelope for entries + profile
  hooks/
    useHealthData.ts     State + persistence + report memo
  components/            Presentational React components
  test/                  Unit tests, one file per lib module
```

The `lib/` layer is deliberately pure: it never imports React, never touches
`window` or the DOM, and takes `referenceDate` as an argument instead of
reading the clock. That is what makes the analysis fully deterministic and
testable.

## How the analysis works

`analyzeHealth(entries, profile, { referenceDate, windowDays })` returns a
`HealthReport`: per-metric summaries, a score, and a sorted list of insights.

- The window ends on `referenceDate` and spans `windowDays` (default 14).
- A rule only fires when there is enough data for it (3 logged days for
  averages, 5 for trends), so the app never draws conclusions from one entry.
- Every threshold lives in the exported `THRESHOLDS` object in
  `src/lib/insights.ts` — tune behaviour there, not by editing rule bodies.
- Insights carry the numbers behind them in `evidence`, which the UI renders so
  a claim can be checked rather than trusted.

The rules cover: insufficient data, logging coverage, missing metrics, BMI,
weight trend and pace, distance to target weight, sleep duration and
consistency, sleep-vs-weight interaction, step volume and trend, calorie
balance, calorie stability, and intake-vs-weight agreement.

## Data and privacy

- Everything is stored in this browser's `localStorage` under the
  `health-tracker:*` keys. Nothing is uploaded anywhere.
- **Backup** — use "Export all data (.json)" to download everything you have
  logged (entries + profile) as a single JSON file. "Import from file" restores
  one: it replaces the current data, which is confirmed before anything
  changes. This is the only way to move data between devices or browsers.
- Clearing site data, or using "Delete all data" in the app, erases the history.
  There is no sync.
- Corrupt or hand-edited storage, or a malformed backup file, is never fatal:
  unreadable data is discarded, the app starts empty, and a banner explains
  what happened.

## Testing

```bash
pnpm test
```

350 tests across 10 files, mirroring the `lib/` modules one-to-one, plus component
and hook tests. Notable techniques:

- Determinism: tests always pass an explicit `referenceDate`, so no assertion
  depends on the current date.
- Storage is injected via a `StorageLike` interface, so parsing and sanitizing
  are tested against an in-memory fake rather than a real browser store.
- Chart tests stub `ResizeObserver` and `getBoundingClientRect`, because jsdom
  reports a 0×0 layout and Recharts would otherwise render nothing.
- `src/test/setup.ts` guards `localStorage` access in a `try/catch`; Node's
  experimental `localStorage` can shadow the jsdom one and throw when it is
  unavailable.

## License

Private project. All rights reserved.