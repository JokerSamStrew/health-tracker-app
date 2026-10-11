import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackupPanel } from '../components/BackupPanel.tsx';
import { EntryForm, formToEntries, formToEntry } from '../components/EntryForm.tsx';
import { HistoryTable } from '../components/HistoryTable.tsx';
import { InsightsPanel } from '../components/InsightsPanel.tsx';
import { SummaryCards } from '../components/SummaryCards.tsx';
import { ProfilePanel } from '../components/ProfilePanel.tsx';
import { TimeSeriesChart } from '../components/TimeSeriesChart.tsx';
import { analyzeHealth } from '../lib/insights.ts';
import { buildChartData } from '../lib/charts.ts';
import { DEFAULT_PROFILE } from '../types.ts';
import type { DailyEntry, Insight, Profile } from '../types.ts';

const REFERENCE = '2024-03-14';

// jsdom's Blob lacks `text()`, so read blobs through FileReader instead.
function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function makeEntries(days: number, endDate = REFERENCE): DailyEntry[] {
  const entries: DailyEntry[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(`${endDate}T12:00:00`);
    date.setDate(date.getDate() - i);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
    entries.push({
      date: iso,
      weightKg: 80 + (days - 1 - i) * 0.2,
      steps: 9000,
      sleepQuality: 3,
      calories: 2600,
    });
  }
  return entries;
}

describe('EntryForm', () => {
  it('saves an entry with the values entered', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EntryForm defaultDate={REFERENCE} onSave={onSave} />);

    await user.type(screen.getByLabelText(/weight/i), '81.4');
    await user.type(screen.getByLabelText(/^steps/i), '10500');
    await user.selectOptions(screen.getByLabelText(/sleep/i), '4');
    await user.type(screen.getByLabelText(/calories eaten/i), '2400');
    await user.click(screen.getByRole('button', { name: /save entry/i }));

    expect(onSave).toHaveBeenCalledWith({
      date: REFERENCE,
      weightKg: 81.4,
      steps: 10500,
      sleepQuality: 4,
      calories: 2400,
    });
  });

  it('omits fields left blank', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EntryForm defaultDate={REFERENCE} onSave={onSave} />);

    await user.type(screen.getByLabelText(/^steps/i), '9000');
    await user.click(screen.getByRole('button', { name: /save entry/i }));

    expect(onSave).toHaveBeenCalledWith({ date: REFERENCE, steps: 9000 });
  });

  it('rejects out-of-range values', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EntryForm defaultDate={REFERENCE} onSave={onSave} />);

    // METRIC_RANGES.steps.max is 200,000, so 250,000 is out of range.
    await user.type(screen.getByLabelText(/^steps/i), '250000');
    await user.click(screen.getByRole('button', { name: /save entry/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByText(/must be between/i)).toBeInTheDocument();
  });

  it('requires at least one measurement', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EntryForm defaultDate={REFERENCE} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /save entry/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByText(/at least one measurement/i)).toBeInTheDocument();
  });

  it('clears the fields after a successful save but keeps the date', async () => {
    const user = userEvent.setup();
    render(<EntryForm defaultDate={REFERENCE} onSave={vi.fn()} />);

    const steps = screen.getByLabelText(/^steps/i);
    await user.type(steps, '9000');
    await user.click(screen.getByRole('button', { name: /save entry/i }));

    expect(steps).toHaveValue(null);
    expect(screen.getByLabelText(/^date/i)).toHaveValue(REFERENCE);
    expect(await screen.findByText(/saved/i)).toBeInTheDocument();
  });

  it('resets without saving', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EntryForm defaultDate={REFERENCE} onSave={onSave} />);

    const steps = screen.getByLabelText(/^steps/i);
    await user.type(steps, '9000');
    await user.click(screen.getByRole('button', { name: /reset/i }));

    expect(steps).toHaveValue(null);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('limits the date field to today and three years back', () => {
    render(<EntryForm defaultDate={REFERENCE} onSave={vi.fn()} />);
    const date = screen.getByLabelText(/^date/i);
    expect(date).toHaveAttribute('max', REFERENCE);
    expect(date).toHaveAttribute('min', '2021-03-15');
  });

  it('logs a custom date range from one set of values', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EntryForm defaultDate={REFERENCE} onSave={onSave} />);

    await user.selectOptions(screen.getByLabelText('Period'), 'range');
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2024-03-11' } });
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2024-03-17' } });
    await user.type(screen.getByLabelText(/^steps/i), '7000');
    await user.selectOptions(screen.getByLabelText(/sleep/i), '4.5');
    await user.click(screen.getByRole('button', { name: /save entry/i }));

    expect(onSave).toHaveBeenCalledTimes(7);
    const dates = onSave.mock.calls.map((call) => call[0].date as string);
    expect(dates).toEqual([
      '2024-03-11',
      '2024-03-12',
      '2024-03-13',
      '2024-03-14',
      '2024-03-15',
      '2024-03-16',
      '2024-03-17',
    ]);
    expect(onSave.mock.calls[0]![0]).toEqual({ date: '2024-03-11', steps: 7000, sleepQuality: 4.5 });
    expect(await screen.findByText(/saved\. applied to 7 days in that range/i)).toBeInTheDocument();
  });

  it('logs a range that crosses a month boundary', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EntryForm defaultDate={REFERENCE} onSave={onSave} />);

    await user.selectOptions(screen.getByLabelText('Period'), 'range');
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2024-03-30' } });
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2024-04-02' } });
    await user.type(screen.getByLabelText(/^steps/i), '8000');
    await user.click(screen.getByRole('button', { name: /save entry/i }));

    expect(onSave).toHaveBeenCalledTimes(4);
    expect(onSave.mock.calls[0]![0].date).toBe('2024-03-30');
    expect(onSave.mock.calls.at(-1)![0].date).toBe('2024-04-02');
  });

  it('validates bulk entries exactly like a single day', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EntryForm defaultDate={REFERENCE} onSave={onSave} />);

    await user.selectOptions(screen.getByLabelText('Period'), 'range');
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2024-03-11' } });
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2024-03-17' } });
    // METRIC_RANGES.steps.max is 200,000, so 250,000 is out of range.
    await user.type(screen.getByLabelText(/^steps/i), '250000');
    await user.click(screen.getByRole('button', { name: /save entry/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByText(/must be between/i)).toBeInTheDocument();
  });

  it('rejects a range whose end precedes its start', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EntryForm defaultDate={REFERENCE} onSave={onSave} />);

    await user.selectOptions(screen.getByLabelText('Period'), 'range');
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2024-03-17' } });
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2024-03-11' } });
    await user.type(screen.getByLabelText(/^steps/i), '7000');
    await user.click(screen.getByRole('button', { name: /save entry/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByText(/end date must be on or after the start date/i)).toBeInTheDocument();
  });

  it('rejects a range longer than 366 days', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EntryForm defaultDate={REFERENCE} onSave={onSave} />);

    await user.selectOptions(screen.getByLabelText('Period'), 'range');
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2024-01-01' } });
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2025-01-01' } });
    await user.type(screen.getByLabelText(/^steps/i), '7000');
    await user.click(screen.getByRole('button', { name: /save entry/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByText(/maximum 366 days per range/i)).toBeInTheDocument();
  });

  it('keeps the range pickers when resetting', async () => {
    const user = userEvent.setup();
    render(<EntryForm defaultDate={REFERENCE} onSave={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Period'), 'range');
    const steps = screen.getByLabelText(/^steps/i);
    await user.type(steps, '9000');
    await user.click(screen.getByRole('button', { name: /reset/i }));

    expect(screen.getByLabelText('Start')).toBeInTheDocument();
    expect(steps).toHaveValue(null);
  });
});

describe('formToEntry', () => {
  const base = {
    period: 'day' as const,
    date: REFERENCE,
    start: REFERENCE,
    end: REFERENCE,
    weightKg: '',
    steps: '',
    sleepQuality: '',
    calories: '',
    note: '',
  };

  it('rounds integer metrics', () => {
    expect(formToEntry({ ...base, steps: '9500.7' }).steps).toBe(9501);
    expect(formToEntry({ ...base, calories: '2000.2' }).calories).toBe(2000);
  });

  it('keeps fractional metrics as entered', () => {
    expect(formToEntry({ ...base, weightKg: '80.55' }).weightKg).toBe(80.55);
    expect(formToEntry({ ...base, sleepQuality: '4.5' }).sleepQuality).toBe(4.5);
  });

  it('accepts a comma decimal separator', () => {
    expect(formToEntry({ ...base, weightKg: '80,5' }).weightKg).toBe(80.5);
  });

  it('trims the note and drops it when empty', () => {
    expect(formToEntry({ ...base, note: '  run  ' }).note).toBe('run');
    expect(formToEntry({ ...base, note: '   ' })).not.toHaveProperty('note');
  });
});

describe('formToEntries', () => {
  const base = {
    period: 'day' as const,
    date: REFERENCE,
    start: REFERENCE,
    end: REFERENCE,
    weightKg: '',
    steps: '',
    sleepQuality: '',
    calories: '',
    note: '',
  };

  it('returns one entry for a day', () => {
    expect(formToEntries({ ...base, steps: '9000' })).toEqual([
      { date: REFERENCE, steps: 9000 },
    ]);
  });

  it('expands a range into one entry per day, both ends included', () => {
    const entries = formToEntries({
      ...base,
      period: 'range',
      start: '2024-03-11',
      end: '2024-03-17',
      steps: '7000',
      note: 'easy week',
    });

    expect(entries).toHaveLength(7);
    expect(entries[0]).toEqual({ date: '2024-03-11', steps: 7000, note: 'easy week' });
    expect(entries[6]).toEqual({ date: '2024-03-17', steps: 7000, note: 'easy week' });
    // The values are per-day figures applied to every generated day.
    expect(new Set(entries.map((entry) => entry.steps))).toEqual(new Set([7000]));
  });

  it('expands a range across a month boundary', () => {
    const entries = formToEntries({
      ...base,
      period: 'range',
      start: '2024-03-30',
      end: '2024-04-02',
      weightKg: '80',
    });

    expect(entries).toHaveLength(4);
    expect(entries[0]).toEqual({ date: '2024-03-30', weightKg: 80 });
    expect(entries.at(-1)).toEqual({ date: '2024-04-02', weightKg: 80 });
  });

  it('handles a single-day range', () => {
    const entries = formToEntries({ ...base, period: 'range', start: '2024-03-14', end: '2024-03-14' });
    expect(entries).toEqual([{ date: '2024-03-14' }]);
  });

  it('returns no entries for an invalid or backwards range', () => {
    expect(formToEntries({ ...base, period: 'range', start: 'nope', end: '2024-03-17' })).toEqual([]);
    expect(formToEntries({ ...base, period: 'range', start: '2024-03-17', end: '2024-03-11' })).toEqual([]);
  });
});

describe('SummaryCards', () => {
  const report = analyzeHealth(makeEntries(14), { ...DEFAULT_PROFILE, heightCm: 180 }, {
    referenceDate: REFERENCE,
  });

  it('renders a card for each metric plus the score', () => {
    render(<SummaryCards report={report} />);
    expect(screen.getByText('Health score')).toBeInTheDocument();
    for (const label of ['Weight', 'Steps', 'Sleep', 'Calories']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('shows a dash instead of a score when there is no data', () => {
    const empty = analyzeHealth([], {}, { referenceDate: REFERENCE });
    render(<SummaryCards report={empty} />);
    expect(screen.getByText('Not enough data')).toBeInTheDocument();
  });

  it('renders the latest values with units', () => {
    render(<SummaryCards report={report} />);
    expect(screen.getByText('kg')).toBeInTheDocument();
    expect(screen.getByText('kcal')).toBeInTheDocument();
  });
});

describe('InsightsPanel', () => {
  const report = analyzeHealth(makeEntries(14), { ...DEFAULT_PROFILE, heightCm: 180 }, {
    referenceDate: REFERENCE,
  });

  it('renders problems with evidence and recommendations', () => {
    render(<InsightsPanel insights={report.insights} />);

    expect(screen.getByText(/Problems & notes/i)).toBeInTheDocument();
    expect(screen.getAllByText(/What the data shows/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Recommendations/i).length).toBeGreaterThan(0);
  });

  it('separates positives into their own group', () => {
    render(<InsightsPanel insights={report.insights} />);
    expect(screen.getByText(/Working well/i)).toBeInTheDocument();
  });

  it('shows a friendly message when nothing was found', () => {
    const positiveOnly: Insight[] = [
      {
        id: 'x',
        category: 'sleep',
        severity: 'positive',
        title: 'All good',
        summary: 'Everything is fine',
        evidence: ['x'],
        recommendations: [{ title: 'a', detail: 'b' }],
      },
    ];
    render(<InsightsPanel insights={positiveOnly} />);
    expect(screen.getByText(/no problems detected/i)).toBeInTheDocument();
  });

  it('has an empty state with no insights at all', () => {
    render(<InsightsPanel insights={[]} />);
    expect(screen.getByText(/nothing to report yet/i)).toBeInTheDocument();
  });

  it('always shows the disclaimer', () => {
    render(<InsightsPanel insights={report.insights} />);
    expect(screen.getByText(/not medical advice/i)).toBeInTheDocument();
  });
});

describe('HistoryTable', () => {
  it('lists entries newest first', () => {
    const entries = makeEntries(3);
    render(<HistoryTable entries={entries} onDelete={vi.fn()} />);

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Mar 14');
    expect(rows[2]).toHaveTextContent('Mar 12');
  });

  it('shows a dash for missing metrics', () => {
    render(
      <HistoryTable entries={[{ date: REFERENCE, weightKg: 80 }]} onDelete={vi.fn()} />,
    );
    const row = screen.getByRole('row', { name: /mar 14/i });
    expect(within(row).getAllByText('—').length).toBe(3);
  });

  it('filters by note text', async () => {
    const user = userEvent.setup();
    const entries: DailyEntry[] = [
      { date: REFERENCE, steps: 9000, note: 'long run' },
      { date: '2024-03-13', steps: 4000, note: 'rest day' },
    ];
    render(<HistoryTable entries={entries} onDelete={vi.fn()} />);

    await user.type(screen.getByRole('searchbox'), 'rest');

    expect(screen.getByText('rest day')).toBeInTheDocument();
    expect(screen.queryByText('long run')).not.toBeInTheDocument();
  });

  it('confirms deletion by date', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<HistoryTable entries={makeEntries(1)} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /delete entry for/i }));
    expect(onDelete).toHaveBeenCalledWith(REFERENCE);
  });

  it('shows an empty state', () => {
    render(<HistoryTable entries={[]} onDelete={vi.fn()} />);
    expect(screen.getByText(/no entries yet/i)).toBeInTheDocument();
  });
});

describe('BackupPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('downloads a JSON backup on export', async () => {
    const user = userEvent.setup();
    let exportedBlob: Blob | null = null;
    const createObjectURL = vi.fn((blob: Blob) => {
      exportedBlob = blob;
      return 'blob:mock';
    });
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });

    render(
      <BackupPanel
        entries={makeEntries(2)}
        profile={{ age: 30 }}
        referenceDate={REFERENCE}
        onImport={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /export all data/i }));

    expect(downloads).toEqual([`health-tracker-backup-${REFERENCE}.json`]);
    const payload = JSON.parse(await blobText(exportedBlob!)) as {
      format: string;
      version: number;
      entries: DailyEntry[];
      profile: Profile;
    };
    expect(payload.format).toBe('health-tracker');
    expect(payload.version).toBe(1);
    expect(payload.entries).toHaveLength(2);
    expect(payload.profile).toEqual({ age: 30 });
    expect(screen.getByRole('status')).toHaveTextContent(/exported 2 entries/i);
  });

  it('confirms before importing a backup, then hands it to the parent', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    render(
      <BackupPanel entries={[]} profile={{}} referenceDate={REFERENCE} onImport={onImport} />,
    );

    const backup = JSON.stringify({
      format: 'health-tracker',
      version: 1,
      exportedAt: '2024-03-14T12:00:00.000Z',
      entries: [{ date: '2024-03-10', steps: 9000, weightKg: 80.5 }],
      profile: { age: 30 },
    });
    const file = new File([backup], 'backup.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText(/backup file/i), file);

    // The destructive step needs a click before the data is applied.
    await user.click(await screen.findByRole('button', { name: /replace with this file/i }));
    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith(
        [{ date: '2024-03-10', steps: 9000, weightKg: 80.5 }],
        { age: 30 },
      );
    });
    expect(await screen.findByRole('status')).toHaveTextContent(/imported 1 entries/i);
  });

  it('cancelling an import applies nothing', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    render(
      <BackupPanel entries={[]} profile={{}} referenceDate={REFERENCE} onImport={onImport} />,
    );

    const backup = JSON.stringify({
      format: 'health-tracker',
      version: 1,
      exportedAt: '2024-03-14T12:00:00.000Z',
      entries: [{ date: '2024-03-10', steps: 9000 }],
    });
    await user.upload(screen.getByLabelText(/backup file/i), new File([backup], 'b.json'));
    await user.click(await screen.findByRole('button', { name: /cancel/i }));

    expect(onImport).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /replace with this file/i })).not.toBeInTheDocument();
  });

  it('rejects a file that is not a backup', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    render(
      <BackupPanel entries={[]} profile={{}} referenceDate={REFERENCE} onImport={onImport} />,
    );

    await user.upload(
      screen.getByLabelText(/backup file/i),
      new File(['{ not json'], 'typo.json', { type: 'application/json' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /not a valid health tracker backup/i,
    );
    expect(onImport).not.toHaveBeenCalled();
  });
});

describe('ProfilePanel', () => {
  it('shows energy estimates once enough is known', () => {
    render(
      <ProfilePanel
        profile={{ age: 30, sex: 'male', heightCm: 180 }}
        latestWeightKg={80}
        onChange={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    // Mifflin-St Jeor: 10*80 + 6.25*180 - 5*30 + 5 = 1780 kcal, x1.55 = 2759.
    expect(screen.getByText(/estimated daily burn/i)).toBeInTheDocument();
    expect(screen.getByText('1,780 kcal')).toBeInTheDocument();
    expect(screen.getByText('2,759 kcal')).toBeInTheDocument();
  });

  it('asks for the missing inputs when it cannot estimate', () => {
    render(
      <ProfilePanel profile={{}} latestWeightKg={null} onChange={vi.fn()} onClearAll={vi.fn()} />,
    );
    expect(screen.getByText(/needs age, sex, height and weight/i)).toBeInTheDocument();
  });

  it('reports profile changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ProfilePanel
        profile={{ age: 30, sex: 'male', heightCm: 180 }}
        latestWeightKg={80}
        onChange={onChange}
        onClearAll={vi.fn()}
      />,
    );

    const height = screen.getByLabelText(/^height/i);
    await user.clear(height);
    await user.type(height, '185');
    // The panel commits on blur, not on every keystroke.
    await user.tab();

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)![0].heightCm).toBe(185);
  });

  it('requires a second click to delete everything', async () => {
    const user = userEvent.setup();
    const onClearAll = vi.fn();
    render(
      <ProfilePanel profile={{}} latestWeightKg={null} onChange={vi.fn()} onClearAll={onClearAll} />,
    );

    await user.click(screen.getByRole('button', { name: /delete all data/i }));
    expect(onClearAll).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /yes, delete everything/i }));
    expect(onClearAll).toHaveBeenCalled();
  });

  it('cancels the deletion', async () => {
    const user = userEvent.setup();
    const onClearAll = vi.fn();
    render(
      <ProfilePanel profile={{}} latestWeightKg={null} onChange={vi.fn()} onClearAll={onClearAll} />,
    );

    await user.click(screen.getByRole('button', { name: /delete all data/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClearAll).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /delete all data/i })).toBeInTheDocument();
  });
});

describe('TimeSeriesChart', () => {
  const entries = makeEntries(14);
  const report = analyzeHealth(entries, DEFAULT_PROFILE, { referenceDate: REFERENCE });
  const data = buildChartData(entries, REFERENCE, 14);

  // Recharts measures its container, and jsdom always reports 0x0, so the
  // chart would silently render nothing without these stubs.
  beforeAll(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 800,
      height: 260,
      top: 0,
      right: 800,
      bottom: 260,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly callback: ResizeObserverCallback) {}
        observe(target: Element): void {
          const rect = { width: 800, height: 260 } as DOMRectReadOnly;
          this.callback([{ target, contentRect: rect } as ResizeObserverEntry], this as never);
        }
        unobserve(): void {}
        disconnect(): void {}
      },
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the header stats', () => {
    render(
      <TimeSeriesChart title="Weight" metric="weight" data={data} summary={report.summaries.weight} />,
    );

    expect(screen.getByRole('heading', { name: 'Weight' })).toBeInTheDocument();
    expect(screen.getByText('14 entries in window')).toBeInTheDocument();
    expect(screen.getByText('Latest')).toBeInTheDocument();
    expect(screen.getByText('Trend/wk')).toBeInTheDocument();
  });

  it('draws the chart when there is data', () => {
    const { container } = render(
      <TimeSeriesChart title="Weight" metric="weight" data={data} summary={report.summaries.weight} />,
    );

    expect(container.querySelector('.recharts-wrapper')).not.toBeNull();
    expect(container.querySelector('.recharts-line')).not.toBeNull();
  });

  it('draws a goal reference line when given one', () => {
    const { container } = render(
      <TimeSeriesChart
        title="Weight"
        metric="weight"
        data={data}
        summary={report.summaries.weight}
        goal={79}
        goalLabel="Target"
      />,
    );

    expect(container.querySelector('.recharts-reference-line')).not.toBeNull();
  });

  it('shows an empty state instead of a chart when nothing is logged', () => {
    const empty = analyzeHealth([], {}, { referenceDate: REFERENCE });
    const { container } = render(
      <TimeSeriesChart
        title="Sleep"
        metric="sleep"
        data={buildChartData([], REFERENCE, 14)}
        summary={empty.summaries.sleep}
      />,
    );

    expect(screen.getByText(/log sleep for at least one day/i)).toBeInTheDocument();
    expect(container.querySelector('.recharts-wrapper')).toBeNull();
  });
});

describe('profile type compatibility', () => {
  it('accepts an empty profile', () => {
    const profile: Profile = {};
    expect(profile).toEqual({});
  });
});