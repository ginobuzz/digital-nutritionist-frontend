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

    // With no other meals planned/logged, other days stay at the base target.
    // The week becomes over budget because there aren't enough adjustable days.
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 0))]).toBe(2000); // Sunday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 1))]).toBe(2000); // Monday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 2))]).toBe(2000); // Tuesday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 3))]).toBe(2000); // Wednesday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 4))]).toBe(2000); // Thursday
    expect(result.targetsByDate[fridayKey]).toBe(3000); // Friday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 6))]).toBe(2000); // Saturday
    expect(result.overBudgetBy).toBe(1000);
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

    // With no other meals planned/logged, other days stay at the base target.
    // Under-eating Sunday reduces the week overage.
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 1))]).toBe(2000); // Monday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 2))]).toBe(2000); // Tuesday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 3))]).toBe(2000); // Wednesday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 4))]).toBe(2000); // Thursday
    expect(result.targetsByDate[fridayKey]).toBe(3000); // Friday
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 6))]).toBe(2000); // Saturday
    expect(result.overBudgetBy).toBe(500);
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

    // With no other meals planned/logged, remaining days stay at the base target,
    // so the overage carries to the weekly total.
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 1))]).toBe(2000);
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 2))]).toBe(2000);
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 3))]).toBe(2000);
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 4))]).toBe(2000);
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 5))]).toBe(2000);
    expect(result.targetsByDate[toIsoDate(addDays(weekStart, 6))]).toBe(2000);
    expect(result.overBudgetBy).toBe(500);
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

    const plannedCaloriesByDate: Record<string, number> = {};
    for (let idx = 1; idx < 7; idx++) {
      plannedCaloriesByDate[toIsoDate(addDays(weekStart, idx))] = 100; // mark days as "entered" but low
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

    // Remaining budget after Sunday forces reductions, but never below the safety floor.
    for (let idx = 1; idx < 7; idx++) {
      expect(result.targetsByDate[toIsoDate(addDays(weekStart, idx))]).toBe(1200);
    }
    expect(result.overBudgetBy).toBe(3200);
  });
});
