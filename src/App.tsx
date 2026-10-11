import { useMemo, useState } from 'react';
import { EntryForm } from './components/EntryForm.tsx';
import { BackupPanel } from './components/BackupPanel.tsx';
import { HistoryTable } from './components/HistoryTable.tsx';
import { InsightsPanel } from './components/InsightsPanel.tsx';
import { ProfilePanel } from './components/ProfilePanel.tsx';
import { SummaryCards } from './components/SummaryCards.tsx';
import { ThemeToggle } from './components/ThemeToggle.tsx';
import { TimeSeriesChart } from './components/TimeSeriesChart.tsx';
import { useHealthData } from './hooks/useHealthData.ts';
import { useTheme } from './hooks/useTheme.ts';
import { buildChartData } from './lib/charts.ts';
import { formatShortDate } from './lib/date.ts';
import { DEFAULT_WINDOW_DAYS } from './lib/insights.ts';
import type { DailyEntry } from './types.ts';

const WINDOW_OPTIONS = [7, 14, 30, 90] as const;

function generateDemoData(days: number, endDate: string): DailyEntry[] {
  // Deterministic pseudo-random walk so the demo is stable across reloads.
  const entries: DailyEntry[] = [];
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  let weight = 82;
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(`${endDate}T12:00:00`);
    date.setDate(date.getDate() - i);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;

    const skip = rand() < 0.08;
    // Quality rating 2-5 (each integer gets a roughly equal share).
    const sleepQuality = 2 + Math.floor(rand() * 4);
    weight += (rand() - 0.55) * 0.18;
    entries.push({
      date: iso,
      weightKg: Math.round(weight * 10) / 10,
      steps: Math.round(4200 + rand() * 8000),
      sleepQuality,
      calories: Math.round(1700 + rand() * 900),
      note: skip ? 'Rest day' : undefined,
    });
  }
  return entries.reverse();
}

export default function App() {
  const [windowDays, setWindowDays] = useState<number>(DEFAULT_WINDOW_DAYS);
  const [editingEntry, setEditingEntry] = useState<DailyEntry | null>(null);
  const { theme, toggleTheme } = useTheme();
  const {
    entries,
    profile,
    report,
    upsertEntry,
    replaceEntry,
    removeEntry,
    updateProfile,
    importData,
    clearAll,
    recovered,
  } = useHealthData({ windowDays });

  const today = report.referenceDate;
  const chartData = useMemo(
    () => buildChartData(entries, today, Math.max(windowDays, 14)),
    [entries, today, windowDays],
  );

  const latestWeight = report.summaries.weight.latest;

  function handleSeed(): void {
    for (const entry of generateDemoData(90, today)) upsertEntry(entry);
  }

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">
            ✚
          </span>
          <div>
            <h1>Health Tracker</h1>
            <p>
              Timeline for weight, steps, sleep and calories &mdash; with analysis and
              recommendations.
            </p>
          </div>
        </div>

        <div className="app__header-actions">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <label className="field field--inline">
            <span>Window</span>
            <select
              value={windowDays}
              onChange={(event) => setWindowDays(Number(event.target.value))}
            >
              {WINDOW_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  Last {days} days
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="button button--ghost" onClick={handleSeed}>
            Load sample data
          </button>
        </div>
      </header>

      <main className="app__main">
        {recovered ? (
          <p className="banner banner--warning" role="alert">
            Stored data could not be read and was reset. Anything saved previously in this browser
            is gone.
          </p>
        ) : null}

        <SummaryCards report={report} />

        <section className="charts" aria-label="Timelines">
          <div className="section-heading">
            <h2>Timelines</h2>
            <p>
              {formatShortDate(report.windowStart)} &ndash; {formatShortDate(report.windowEnd)}
              {report.summaries.weight.trendPerWeek !== null
                ? ` · weight trending ${
                    report.summaries.weight.trendPerWeek > 0 ? 'up' : 'down'
                  } ${Math.abs(report.summaries.weight.trendPerWeek).toFixed(2)} kg/wk`
                : ''}
            </p>
          </div>
          <div className="charts__grid">
            <TimeSeriesChart
              title="Weight"
              metric="weight"
              data={chartData}
              summary={report.summaries.weight}
              goal={profile.targetWeightKg}
              goalLabel="Target"
              theme={theme}
            />
            <TimeSeriesChart
              title="Steps"
              metric="steps"
              data={chartData}
              summary={report.summaries.steps}
              goal={profile.dailyStepGoal}
              goalLabel="Step goal"
              theme={theme}
            />
            <TimeSeriesChart
              title="Sleep"
              metric="sleep"
              data={chartData}
              summary={report.summaries.sleep}
              goal={profile.sleepGoalQuality}
              goalLabel="Sleep goal"
              theme={theme}
            />
            <TimeSeriesChart
              title="Calories eaten"
              metric="calories"
              data={chartData}
              summary={report.summaries.calories}
              goal={profile.dailyCalorieGoal}
              goalLabel="Calorie goal"
              theme={theme}
            />
          </div>
        </section>

        <InsightsPanel insights={report.insights} />

        <div className="app__columns">
          <div className="app__column">
            {/* Remount when the edit target changes so the form reloads cleanly. */}
            <EntryForm
              key={editingEntry ? editingEntry.date : 'new'}
              defaultDate={today}
              editingEntry={editingEntry}
              onSave={(entry) => {
                if (editingEntry) {
                  replaceEntry(entry, editingEntry.date);
                  setEditingEntry(null);
                } else {
                  upsertEntry(entry);
                }
              }}
              onCancelEdit={() => setEditingEntry(null)}
            />
            <HistoryTable
              entries={entries}
              onEdit={setEditingEntry}
              onDelete={(date) => {
                if (editingEntry?.date === date) setEditingEntry(null);
                removeEntry(date);
              }}
            />
          </div>
          <div className="app__column">
            <ProfilePanel
              profile={profile}
              latestWeightKg={latestWeight}
              referenceDate={today}
              onChange={updateProfile}
              onClearAll={clearAll}
            />
            <BackupPanel
              entries={entries}
              profile={profile}
              referenceDate={today}
              onImport={importData}
            />
          </div>
        </div>
      </main>

      <footer className="app__footer">
        <p>
          Data is stored in this browser only via <code>localStorage</code>. Nothing is uploaded.
          Clearing site data erases your history.
        </p>
      </footer>
    </div>
  );
}