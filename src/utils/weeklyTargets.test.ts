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

    // Sunday is assumed to have used the base target (no free rollover),
    // so the rest of the week stays at the base target as well.
    const keys = Array.from({ length: 7 }, (_, idx) => toIsoDate(addDays(weekStart, idx)));
    for (const key of keys) {
      expect(result.targetsByDate[key]).toBe(baseTarget);
    }
    expect(result.weekBudget).toBe(14000);
    expect(result.overBudgetBy).toBe(0);
  });

  test('redistributes calories when a future day is planned over target', () => {
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

    // Sunday assumed at 2000; remaining budget (Mon-Sat) = 12000.
    // Friday gets 3000, other five days get 1800 each.
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 0))]).toBe(2000); // Sunday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 1))]).toBe(1800); // Monday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 2))]).toBe(1800); // Tuesday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 3))]).toBe(1800); // Wednesday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 4))]).toBe(1800); // Thursday
    expect(result.targetsByDate[fridayKey]).toBe(3000); // Friday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 6))]).toBe(1800); // Saturday
    expect(result.overBudgetBy).toBe(0);
  });

  test('rewards under-budget past day with more calories later in week', () => {
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

    // Remaining budget increases by 500 vs the default,
    // so the "other" days only need to drop by 100 each.
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

    // Need to reduce remaining 6 days by 500 total.
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 1))]).toBe(1916);
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 2))]).toBe(1916);
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 3))]).toBe(1917);
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 4))]).toBe(1917);
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 5))]).toBe(1917);
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 6))]).toBe(1917);
    expect(result.overBudgetBy).toBe(0);
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
    // Targets should never drop below the planned commitments.
    for (let idx = 1; idx < 7; idx++) {
      expect(result.targetsByDate[toIsoDate(addDays(weekStart, idx))]).toBe(4000);
    }
  });

  test('never drops future-day budgets below a safety floor', () => {
    const anchorDate = addDays(weekStart, 1); // Monday
    const sundayKey = toIsoDate(addDays(weekStart, 0));

    const result = calculateDynamicWeeklyCalorieTargets({
      weekStart,
      dailyTarget: baseTarget,
      minDailyTarget: 1200,
      anchorDate,
      actualCaloriesByDate: {
        [sundayKey]: 10000,
      },
      plannedCaloriesByDate: {},
    });

    // Remaining budget after Sunday is only 4000. Even so, Mon-Sat budgets never fall below 1200.
    for (let idx = 1; idx < 7; idx++) {
      expect(result.targetsByDate[toIsoDate(addDays(weekStart, idx))]).toBe(1200);
    }
    expect(result.overBudgetBy).toBe(3200);
  });
});
