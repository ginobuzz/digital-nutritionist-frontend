import { addDays } from 'date-fns';
import { calculateDynamicWeeklyCalorieTargets, toIsoDate } from './weeklyTargets';

describe('weeklyTargets', () => {
  const weekStart = new Date(2026, 0, 11); // Sun Jan 11 2026
  const baseTarget = 2000;

  test('keeps base targets when there is no data', () => {
    const anchorDate = addDays(weekStart, 1); // Monday
    const result = calculateDynamicWeeklyCalorieTargets({
      weekStart,
      dailyTarget: baseTarget,
      anchorDate,
      actualCaloriesByDate: {},
      plannedCaloriesByDate: {},
    });

    const keys = Array.from({ length: 7 }, (_, idx) => toIsoDate(addDays(weekStart, idx)));
    for (const key of keys) {
      expect(result.targetsByDate[key]).toBe(baseTarget);
    }
    expect(result.weekBudget).toBe(14000);
    expect(result.overBudgetBy).toBe(0);
  });

  test('redistributes calories across the rest of the week when a future day is planned over target', () => {
    const anchorDate = addDays(weekStart, 1); // Monday
    const fridayKey = toIsoDate(addDays(weekStart, 5));

    const result = calculateDynamicWeeklyCalorieTargets({
      weekStart,
      dailyTarget: baseTarget,
      anchorDate,
      actualCaloriesByDate: {},
      plannedCaloriesByDate: {
        [fridayKey]: 3000,
      },
    });

    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 0))]).toBe(2000); // Sunday locked
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 1))]).toBe(1800); // Monday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 2))]).toBe(1800); // Tuesday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 3))]).toBe(1800); // Wednesday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 4))]).toBe(1800); // Thursday
    expect(result.targetsByDate[fridayKey]).toBe(3000); // Friday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 6))]).toBe(1800); // Saturday
    expect(result.overBudgetBy).toBe(0);
  });

  test('rewards an under-budget completed day by increasing remaining targets', () => {
    const anchorDate = addDays(weekStart, 1); // Monday
    const sundayKey = toIsoDate(addDays(weekStart, 0));
    const fridayKey = toIsoDate(addDays(weekStart, 5));

    const result = calculateDynamicWeeklyCalorieTargets({
      weekStart,
      dailyTarget: baseTarget,
      anchorDate,
      actualCaloriesByDate: {
        [sundayKey]: 1500,
      },
      plannedCaloriesByDate: {
        [fridayKey]: 3000,
      },
    });

    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 1))]).toBe(1900); // Monday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 2))]).toBe(1900); // Tuesday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 3))]).toBe(1900); // Wednesday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 4))]).toBe(1900); // Thursday
    expect(result.targetsByDate[fridayKey]).toBe(3000); // Friday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 6))]).toBe(1900); // Saturday
    expect(result.overBudgetBy).toBe(0);
  });

  test('reduces remaining days when a past day is over target', () => {
    const anchorDate = addDays(weekStart, 1); // Monday
    const sundayKey = toIsoDate(addDays(weekStart, 0));

    const result = calculateDynamicWeeklyCalorieTargets({
      weekStart,
      dailyTarget: baseTarget,
      anchorDate,
      actualCaloriesByDate: {
        [sundayKey]: 2500,
      },
      plannedCaloriesByDate: {},
    });

    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 1))]).toBe(1916);
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 2))]).toBe(1916);
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 3))]).toBe(1917);
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 4))]).toBe(1917);
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 5))]).toBe(1917);
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 6))]).toBe(1917);
    expect(result.overBudgetBy).toBe(0);
  });

  test('regression: adding a future meal immediately rebalances all remaining days', () => {
    const anchorDate = addDays(weekStart, 1); // Monday
    const thursdayKey = toIsoDate(addDays(weekStart, 4));

    const baseline = calculateDynamicWeeklyCalorieTargets({
      weekStart,
      dailyTarget: baseTarget,
      anchorDate,
      actualCaloriesByDate: {},
      plannedCaloriesByDate: {},
    });

    const rebalanced = calculateDynamicWeeklyCalorieTargets({
      weekStart,
      dailyTarget: baseTarget,
      anchorDate,
      actualCaloriesByDate: {},
      plannedCaloriesByDate: {
        [thursdayKey]: 2600,
      },
    });

    expect(baseline.targetsByDate[toIsoDate(addDays(weekStart, 1))]).toBe(2000);
    expect(rebalanced.targetsByDate[toIsoDate(addDays(weekStart, 1))]).toBeLessThan(2000);

    const futureKeys = Array.from({ length: 6 }, (_, i) => toIsoDate(addDays(weekStart, i + 1)));
    const rebalancedFutureTotal = futureKeys.reduce((sum, key) => sum + rebalanced.targetsByDate[key], 0);
    expect(rebalancedFutureTotal).toBe(rebalanced.remainingBudget);
    expect(rebalanced.overBudgetBy).toBe(0);
  });

  test('reports over-budget weeks when minimum commitments exceed weekly budget', () => {
    const anchorDate = addDays(weekStart, 1); // Monday
    const plannedCaloriesByDate: Record<string, number> = {};
    for (let idx = 1; idx < 7; idx++) {
      plannedCaloriesByDate[toIsoDate(addDays(weekStart, idx))] = 4000;
    }

    const result = calculateDynamicWeeklyCalorieTargets({
      weekStart,
      dailyTarget: baseTarget,
      anchorDate,
      actualCaloriesByDate: {},
      plannedCaloriesByDate,
    });

    expect(result.overBudgetBy).toBe(12000);
    for (let idx = 1; idx < 7; idx++) {
      expect(result.targetsByDate[toIsoDate(addDays(weekStart, idx))]).toBe(4000);
    }
  });

  test('never drops future-day budgets below a safety floor', () => {
    const anchorDate = addDays(weekStart, 1); // Monday
    const sundayKey = toIsoDate(addDays(weekStart, 0));

    const plannedCaloriesByDate: Record<string, number> = {};
    for (let idx = 1; idx < 7; idx++) {
      plannedCaloriesByDate[toIsoDate(addDays(weekStart, idx))] = 100; // mark days as entered but low
    }

    const result = calculateDynamicWeeklyCalorieTargets({
      weekStart,
      dailyTarget: baseTarget,
      minDailyTarget: 1200,
      anchorDate,
      actualCaloriesByDate: {
        [sundayKey]: 10000,
      },
      plannedCaloriesByDate,
    });

    for (let idx = 1; idx < 7; idx++) {
      expect(result.targetsByDate[toIsoDate(addDays(weekStart, idx))]).toBe(1200);
    }
    expect(result.overBudgetBy).toBe(3200);
  });
});
