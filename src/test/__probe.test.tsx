import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import { render } from '@testing-library/react';
import { TimeSeriesChart } from '../components/TimeSeriesChart.tsx';

const entries = [
  { date: '2024-03-13', steps: 9000, weightKg: 80 },
  { date: '2024-03-14', steps: 9500, weightKg: 80.2 },
];

describe('probe', () => {
  beforeAll(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 800, height: 260, top: 0, right: 800, bottom: 260, left: 0, x: 0, y: 0,
      toJSON: () => ({}),
    });
    vi.stubGlobal('ResizeObserver', class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(target: Element): void {
        this.callback([{ target, contentRect: { width: 800, height: 260 } as DOMRectReadOnly } as ResizeObserverEntry], this as never);
      }
      unobserve(): void {}
      disconnect(): void {}
    });
  });
  afterAll(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('dumps class names', () => {
    const { container } = render(
      <TimeSeriesChart
        title="Steps"
        metric="steps"
        data={entries.map((e, i) => ({ date: e.date, label: e.date, day: 13 + i, weightKg: e.weightKg ?? null, steps: e.steps ?? null, sleepHours: null, calories: null, weightAvg7: null, stepsAvg7: null, sleepAvg7: null, caloriesAvg7: null }))}
        summary={{ count: 2, latest: 9500, average: 9250, min: 9000, max: 9500, stdDev: 353, median: 9250, trendPerWeek: 500 }}
        goal={9250}
        goalLabel="Goal"
      />,
    );
    const classes = new Set<string>();
    container.querySelectorAll('*').forEach((el) => {
      el.getAttribute('class')?.split(/\s+/).forEach((c) => c.startsWith('recharts') && classes.add(c));
    });
    console.log([...classes].sort().join('\n'));
    expect([...classes].sort()).toEqual([]);
  });
});
