import { useMemo, useState } from 'react';
import { BackupPanel } from './components/BackupPanel.tsx';
import { EntryForm } from './components/EntryForm.tsx';
import { HealthScoreChart } from './components/HealthScoreChart.tsx';
import { HistoryTable } from './components/HistoryTable.tsx';
import { InsightsPanel } from './components/InsightsPanel.tsx';
import { LanguageToggle } from './components/LanguageToggle.tsx';
import { MoodChart } from './components/MoodChart.tsx';
import { ProfilePanel } from './components/ProfilePanel.tsx';
import { SummaryCards } from './components/SummaryCards.tsx';
import { ThemeToggle } from './components/ThemeToggle.tsx';
import { TimeSeriesChart } from './components/TimeSeriesChart.tsx';
import { useHealthData } from './hooks/useHealthData.ts';
import { useTheme } from './hooks/useTheme.ts';
import { buildChartData } from './lib/charts.ts';
import { goalHealthScore } from './lib/goalscore.ts';
import { DEFAULT_WINDOW_DAYS, scoreTimeline } from './lib/insights.ts';
import { countMoods } from './lib/moods.ts';
import { useI18n } from './i18n/context.tsx';
import { insightTranslator } from './i18n/insightText.ts';
import type { DailyEntry, Profile } from './types.ts';

const WINDOW_OPTIONS = [7, 14, 30, 90] as const;

/** Mood tags the sample-data generator draws from, kept in canonical English. */
const DEMO_MOODS = ['Happy', 'Calm', 'Anxious', 'Stressed', 'Low Energy', 'High Energy'] as const;

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
    // Activity rating 1-5, weighted towards the middle of the scale.
    const activityRating = 1 + Math.floor(rand() * 5);
    weight += (rand() - 0.55) * 0.18;
    const mood = skip ? 'Low Energy' : DEMO_MOODS[Math.floor(rand() * DEMO_MOODS.length)]!;
    entries.push({
      date: iso,
      weightKg: Math.round(weight * 10) / 10,
      steps: Math.round(4200 + rand() * 8000),
      sleepQuality,
      activityRating,
      calories: Math.round(1700 + rand() * 900),
      moods: [mood],
    });
  }
  return entries.reverse();
}

export default function App() {
  const [windowDays, setWindowDays] = useState<number>(DEFAULT_WINDOW_DAYS);
  const [editingEntry, setEditingEntry] = useState<DailyEntry | null>(null);
  // Bumped on import so the profile panel remounts and shows the imported
  // profile instead of the values it was seeded with on mount.
  const [profileRevision, setProfileRevision] = useState(0);
  const { theme, toggleTheme } = useTheme();
  const i18n = useI18n();
  const { locale, t, formatShortDate } = i18n;
  // Insights are generated in the selected language by the pure engine; the
  // translator is injected so `src/lib/` never has to know about React.
  const translate = useMemo(() => insightTranslator(locale), [locale]);
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
  } = useHealthData({ windowDays, locale, translate });

  const today = report.referenceDate;
  const chartData = useMemo(
    () => buildChartData(entries, today, Math.max(windowDays, 14)),
    [entries, today, windowDays],
  );

  // Scored over the same span as the metric charts so the x-axes line up; each
  // day is scored as a report ending on that day would have been.
  const scoreTimelineData = useMemo(
    () => scoreTimeline(entries, profile, {
      referenceDate: today,
      windowDays,
      spanDays: Math.max(windowDays, 14),
      locale,
      translate,
    }),
    [entries, profile, today, windowDays, locale, translate],
  );

  // The score every goal in the profile would produce; depends on the report
  // only for the latest weight, which stands in for "stay where you are"
  // when no target weight is set.
  const goalScore = useMemo(
    () => goalHealthScore(profile, report.summaries, {
      referenceDate: today,
      windowDays,
      locale,
      translate,
    }),
    [profile, report.summaries, today, windowDays, locale, translate],
  );

  const moodCounts = useMemo(
    () => countMoods(entries, report.windowStart, report.windowEnd),
    [entries, report.windowStart, report.windowEnd],
  );

  const latestWeight = report.summaries.weight.latest;
  const weightTrend = report.summaries.weight.trendPerWeek;

  function handleSeed(): void {
    for (const entry of generateDemoData(90, today)) upsertEntry(entry);
  }

  function handleImport(importedEntries: DailyEntry[], importedProfile: Profile): void {
    importData(importedEntries, importedProfile);
    setProfileRevision((value) => value + 1);
  }

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">
            ✚
          </span>
          <div>
            <h1>{t('app.title')}</h1>
            <p>{t('app.tagline')}</p>
          </div>
        </div>

        <div className="app__header-actions">
          <LanguageToggle />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <label className="field field--inline">
            <span>{t('app.window')}</span>
            <select
              value={windowDays}
              onChange={(event) => setWindowDays(Number(event.target.value))}
            >
              {WINDOW_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {t('app.lastDays', { days })}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="button button--ghost" onClick={handleSeed}>
            {t('app.loadSampleData')}
          </button>
        </div>
      </header>

      <main className="app__main">
        {recovered ? (
          <p className="banner banner--warning" role="alert">
            {t('app.recovered')}
          </p>
        ) : null}

        <SummaryCards report={report} />

        <MoodChart
          counts={moodCounts}
          windowStart={report.windowStart}
          windowEnd={report.windowEnd}
          theme={theme}
        />

        <section className="charts" aria-label={t('app.timelines')}>
          <div className="section-heading">
            <h2>{t('app.timelines')}</h2>
            <p>
              {formatShortDate(report.windowStart)} &ndash; {formatShortDate(report.windowEnd)}
              {weightTrend !== null
                ? ` · ${t('app.weightTrend', {
                    direction: t(weightTrend > 0 ? 'app.trendUp' : 'app.trendDown'),
                    value: Math.abs(weightTrend).toFixed(2),
                  })}`
                : ''}
            </p>
          </div>
          <div className="charts__grid">
            <HealthScoreChart timeline={scoreTimelineData} goal={goalScore} theme={theme} />
            <TimeSeriesChart
              title={t('metric.weight')}
              metric="weight"
              data={chartData}
              summary={report.summaries.weight}
              goal={profile.targetWeightKg}
              goalLabel={t('chart.target')}
              theme={theme}
            />
            <TimeSeriesChart
              title={t('metric.steps')}
              metric="steps"
              data={chartData}
              summary={report.summaries.steps}
              goal={profile.dailyStepGoal}
              goalLabel={t('chart.goalLabel.steps')}
              theme={theme}
            />
            <TimeSeriesChart
              title={t('metric.sleep')}
              metric="sleep"
              data={chartData}
              summary={report.summaries.sleep}
              goal={profile.sleepGoalQuality}
              goalLabel={t('chart.goalLabel.sleep')}
              theme={theme}
            />
            <TimeSeriesChart
              title={t('metric.activity')}
              metric="activity"
              data={chartData}
              summary={report.summaries.activity}
              goal={profile.activityGoalRating}
              goalLabel={t('chart.goalLabel.activity')}
              theme={theme}
            />
            <TimeSeriesChart
              title={t('metric.caloriesEaten')}
              metric="calories"
              data={chartData}
              summary={report.summaries.calories}
              goal={profile.dailyCalorieGoal}
              goalLabel={t('chart.goalLabel.calories')}
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
              key={profileRevision}
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
              onImport={handleImport}
            />
          </div>
        </div>
      </main>

      <footer className="app__footer">
        <p>
          {t('app.footerBefore')}
          <code>{t('app.footerCode')}</code>
          {t('app.footerAfter')}
        </p>
      </footer>
    </div>
  );
}
