import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.tsx';

/**
 * Integration tests for the whole app shell. The profile panel owns its own
 * form state, so these tests mainly guard the wiring that keeps it in sync
 * when the data underneath is replaced (e.g. by importing a backup).
 */
describe('App', () => {
  // App renders Recharts, which measures its container. jsdom reports 0x0, so
  // stub the same APIs the chart component tests use.
  beforeAll(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 800,
      height: 240,
      top: 0,
      right: 800,
      bottom: 240,
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
          const rect = { width: 800, height: 240 } as DOMRectReadOnly;
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

  it('shows the imported profile in the profile panel', async () => {
    const user = userEvent.setup();
    render(<App />);

    const backup = JSON.stringify({
      format: 'health-tracker',
      version: 1,
      exportedAt: '2024-03-14T12:00:00.000Z',
      entries: [{ date: '2024-03-10', steps: 9000 }],
      profile: {
        name: 'Ada Lovelace',
        birthDate: '1990-05-05',
        sex: 'female',
        heightCm: 170,
        activityLevel: 'active',
        targetWeightKg: 62.5,
        dailyCalorieGoal: 2100,
        dailyStepGoal: 12000,
        sleepGoalQuality: 4.5,
      },
    });

    await user.upload(
      screen.getByLabelText(/backup file/i),
      new File([backup], 'backup.json', { type: 'application/json' }),
    );
    await user.click(await screen.findByRole('button', { name: /replace with this file/i }));

    // Every field comes from the file, not from the values the panel was
    // seeded with when it mounted on the (empty) stored profile.
    await waitFor(() => {
      expect(screen.getByLabelText(/^name/i)).toHaveValue('Ada Lovelace');
    });
    expect(screen.getByLabelText(/birth date/i)).toHaveValue('1990-05-05');
    expect(screen.getByLabelText(/^sex/i)).toHaveValue('female');
    expect(screen.getByLabelText(/^height/i)).toHaveValue(170);
    expect(screen.getByLabelText(/activity level/i)).toHaveValue('active');
    expect(screen.getByLabelText(/target weight/i)).toHaveValue(62.5);
    expect(screen.getByLabelText(/calorie goal/i)).toHaveValue(2100);
    expect(screen.getByLabelText(/^step goal/i)).toHaveValue(12000);
    expect(screen.getByLabelText(/sleep goal/i)).toHaveValue(4.5);
  });
});
