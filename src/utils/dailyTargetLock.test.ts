import { addDays } from 'date-fns';
import { resolveLockedTodayTarget } from './dailyTargetLock';
import { toIsoDate } from './weeklyTargets';

describe('dailyTargetLock', () => {
  const weekStart = new Date(2026, 0, 11); // Sun Jan 11 2026
  const today = addDays(weekStart, 1); // Monday
  const sundayKey = toIsoDate(weekStart);
  const todayKey = toIsoDate(today);

  beforeEach(() => {
    window.localStorage.clear();
  });

  test('locks today to the day-start rebalance target', () => {
    const locked = resolveLockedTodayTarget({
      userId: 42,
      today,
      weekStart,
      dailyTarget: 2000,
      minDailyTarget: 1200,
      actualCaloriesByDate: {
        [sundayKey]: 2500,
      },
      plannedCaloriesByDate: {},
    });

    expect(locked).toBe(1916);
    const raw = window.localStorage.getItem('dn_locked_today_targets_v1');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw || '{}')).toMatchObject({
      [`42:${todayKey}`]: 1916,
    });
  });

  test('reuses the same locked value for the same user/day even if source data changes later', () => {
    const first = resolveLockedTodayTarget({
      userId: 42,
      today,
      weekStart,
      dailyTarget: 2000,
      minDailyTarget: 1200,
      actualCaloriesByDate: {
        [sundayKey]: 2500,
      },
      plannedCaloriesByDate: {},
    });

    const second = resolveLockedTodayTarget({
      userId: 42,
      today,
      weekStart,
      dailyTarget: 2000,
      minDailyTarget: 1200,
      actualCaloriesByDate: {
        [sundayKey]: 1500,
      },
      plannedCaloriesByDate: {
        [toIsoDate(addDays(weekStart, 5))]: 3000,
      },
    });

    expect(first).toBe(1916);
    expect(second).toBe(first);
  });
});
