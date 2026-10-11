# AGENTS.md

Guidance for AI agents and humans working in this repository. Read this before
changing code.

## What this project is

A local-first health tracker. Users log weight, steps, sleep quality and calories
eaten per day; the app analyses the log and surfaces problems plus
recommendations. React 19 + TypeScript + Vite + Recharts, built and tested with
pnpm.

There is **no backend, no account and no network access**. `localStorage` is the
only persistence layer. Do not add a server, an API client or a fetch call
without being asked.

## Commands

```bash
pnpm install       # pnpm 12 blocks postinstall scripts until approved; see below
pnpm dev           # dev server on :5173
pnpm typecheck     # tsc -b  (app + node configs)
pnpm test          # vitest run - must be green before any change lands
pnpm test:watch    # watch mode while iterating
pnpm build         # tsc -b && vite build
```

A change is done when `pnpm typecheck`, `pnpm test` and `pnpm build` all pass.
Run all three; `pnpm build` is what catches config problems the other two miss.

## Hard constraints

1. **Use `pnpm`.** Never npm, yarn or bun. `packageManager` is pinned to
   `pnpm@12.6.0`.
2. **pnpm 12 ignores the `pnpm` field in `package.json`.** Build-script approval
   lives in `pnpm-workspace.yaml` (`allowBuilds: { esbuild: true }`). If a
   dependency's postinstall is blocked, fix it there — not in `package.json`.
3. **Import specifiers carry their file extension.** `allowImportingTsExtensions`
   and `verbatimModuleSyntax` are on, so write `from './stats.ts'`, not
   `'./stats'`, and `'../components/EntryForm.tsx'`, not `'../components/EntryForm'`.
4. **Type-only imports use `import type`.** `verbatimModuleSyntax` does not elide
   value imports for you.
5. **Keep `src/lib/` pure.** No React, no DOM, no `window`, no `localStorage`, no
   `new Date()` without an injected reference date. This is what makes the
   analysis deterministic and testable.
6. **Never write to storage during render.** Persistence happens in
   `useEffect` inside `useHealthData`. Reading storage once on mount is fine.
7. **Do not weaken the compiler.** `strict`, `noUnusedLocals`,
   `noUnusedParameters` and `noImplicitOverride` are on. Fix the code; do not add
   `any`, `@ts-ignore`, or loosen `tsconfig.app.json`.
8. **Storage input is untrusted.** Anything read from `localStorage` is
   `unknown` until it passes through `sanitizeEntry` / `sanitizeProfile`. Keep it
   that way; never cast a parsed blob to a domain type.
9. **Deterministic tests only.** Every test that touches the analysis passes an
   explicit `referenceDate`. Do not add tests that depend on today's date, on
   `Math.random`, or on the network.

## Architecture

```
src/types.ts        Domain model. Single source of truth for shapes + ranges.
src/lib/date.ts     ISO `YYYY-MM-DD` helpers, local-timezone safe, DST-safe.
src/lib/stats.ts    mean/median/stdDev, moving average, least-squares
                    regression, Pearson correlation, number formatting.
src/lib/health.ts   BMI, BMR (Mifflin-St Jeor), TDEE, calorie target for goal.
src/lib/series.ts   Entries -> sorted/merged series + per-metric summaries.
src/lib/insights.ts analyzeHealth() and the 14 rules. THRESHOLDS lives here.
src/lib/charts.ts   Recharts-shaped points, null gaps, padded axis domains.
src/lib/storage.ts  localStorage read/write, sanitizing, memory fake.
src/lib/backup.ts   JSON export/import envelope for entries + profile.
src/hooks/          useHealthData: state + persistence + memoized report.
src/components/     Presentational React only; props in, no store access.
```

### Data flow

```
localStorage
  -> loadState/loadProfile        (storage.ts, sanitized, recovered flag)
  -> useHealthData state         (React owns it after mount)
  -> analyzeHealth(entries, profile, { referenceDate, windowDays })
  -> HealthReport { summaries, score, insights, counts }
  -> SummaryCards / TimeSeriesChart / InsightsPanel
```

`report` is a `useMemo` over `[entries, profile, referenceDate, windowDays]`.
Keep it pure and cheap to recompute; do not reach for effects or extra state in
the components.

### Adding an insight rule

1. Write a `function ruleX(...): Insight | null` in `src/lib/insights.ts`.
   Return `null` when there is not enough data — never guess.
2. Add any new magic number to the exported `THRESHOLDS` object. Do not inline
   numbers in rule bodies.
3. Use `buildInsight(id, category, severity, title, summary, evidence,
   recommendations)`. `id` must be stable — tests and React keys depend on it.
4. Put the numbers you used in `evidence`, and phrase them through `fmt(key,
   value)` / `formatKg()` so units and precision stay consistent.
5. Register it with `add(...)` in the `analyzeHealth` rule list.
6. Add tests to `src/test/insights.test.ts`, one per branch, using
   `insightById(report.insights, 'rule.id')`. Pick fixtures that sit clearly
   inside or outside each threshold and say so in a comment.

## Conventions

- **Comments explain why, not what.** Every `lib/` module opens with a short
  docblock stating its responsibility and its constraints.
- **Formatting:** single quotes, semicolons, 2-space indent, trailing commas,
  ~100 column width. No semicolon-less style, no tabs.
- **Naming:** `camelCase` functions and variables, `PascalCase` components and
  types, `SCREAMING_SNAKE` for exported constant tables (`THRESHOLDS`,
  `METRIC_RANGES`, `STORAGE_KEYS`).
- **Nulls over sentinel values.** A metric that was never logged is `null`, not
  `0`. Guards read `if (x === null) return null;`.
- **Units are fixed:** kg, steps, a `/5` rating, kcal. Unit strings come from
  `METRIC_UNITS` in `src/types.ts`; do not hardcode `'kg'` in new components.
- **Numbers shown to users** go through `formatMetric` / `formatNumber` /
  `fmt()` so rounding and thousands separators stay uniform.

## Reference numbers

Use these when writing fixtures; getting them wrong causes confusing test
failures.

| Quantity | Value |
| --- | --- |
| BMR, male 80 kg / 180 cm / 30 y | `10*80 + 6.25*180 - 5*30 + 5` = **1780** kcal |
| BMR, female 65 kg / 165 cm / 30 y | **1370.25** kcal |
| TDEE at moderate activity | BMR x 1.55 = **2759** kcal for the male profile above |
| `KCAL_PER_KG` | 7700 |
| `SAFE_PACE_KG_PER_WEEK` | 0.45 kg/wk = 495 kcal/day |
| Default step goal / sleep quality goal | 8000 steps / 4 (out of 5) |
| `MIN_DAYS_FOR_INSIGHTS` / `MIN_DAYS_FOR_TREND` | 3 / 5 |
| Health score | `100 - 18*critical - 9*warning`, clamped 0–100, `null` below the minimum |

Activity multipliers: sedentary 1.2, light 1.375, moderate 1.55, active 1.725,
athlete 1.9.

`METRIC_RANGES`: weight 20–400 (step 0.1), steps 0–200000, sleep 1–5 (step 0.5),
calories 0–20000.

## Testing notes

- One test file per `lib/` module, same name: `src/lib/stats.ts` ->
  `src/test/stats.test.ts`.
- Vitest runs with `globals: true`, but tests still import `describe`, `expect`
  and `it` from `'vitest'` explicitly. Keep that.
- jsdom reports a 0x0 layout, so Recharts renders nothing. Chart component tests
  stub `ResizeObserver` and `HTMLElement.prototype.getBoundingClientRect` — see
  the `TimeSeriesChart` block in `src/test/components.test.tsx`.
- Node's experimental `localStorage` can shadow the jsdom one and be `undefined`
  without `--localstorage-file`. `src/test/setup.ts` probes it inside
  `try/catch`; if you touch storage setup, keep that guard.
- `renderHook` flushes mount effects, so you cannot assert "no write during
  render" through it. Test the effect's dependency behaviour instead (no
  additional writes when nothing changed).
- `clearAll()` removes the stored keys, but the persist effect immediately writes
  an empty state back. Assert the data is *gone*, not that the key is `null`.
- Recharts silently drops a `ReferenceLine` outside the y-domain. `paddedDomain`
  takes `anchors` for this reason — pass the goal there when changing chart code.

## Known limitations

- No accounts, sync, export or multi-device support.
- BMR/TDEE are population-level estimates; they ignore lean mass, thyroid
  function and everything else a clinician would look at.
- Sleep is a single self-reported quality rating (1–5) per night, not sleep
  stages or a polysomnogram.
- The sample-data generator is a deterministic pseudo-random walk, so its output
  is stable but is not real physiological data.
- The production bundle is ~640 kB (194 kB gzipped), dominated by Recharts.

## House rules

- Small, focused commits. Do not mix a refactor with a behaviour change.
- If you fix a bug, add the regression test that would have caught it.
- If you change a threshold in `THRESHOLDS`, update every test whose fixture sits
  near it, and note the reason in the commit message.
- Do not commit `dist/`, `coverage/` or `node_modules/`; `.gitignore` already
  covers them.
- Keep the medical disclaimer in `InsightsPanel` and the `README` intact.