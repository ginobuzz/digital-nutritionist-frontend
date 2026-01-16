import { addDays, differenceInCalendarDays, format, startOfDay } from 'date-fns';

const WEEK_LENGTH_DAYS = 7;
const ISO_DATE_FMT = 'yyyy-MM-dd';

export const toIsoDate = (date: Date) => format(date, ISO_DATE_FMT);

export type CaloriesByDate = Record<string, number | undefined>;

export interface DynamicWeeklyCalorieTargetsInput {
  weekStart: Date;
  dailyTarget: number;
  minDailyTarget?: number;
  anchorDate: Date;
  actualCaloriesByDate: CaloriesByDate;
  plannedCaloriesByDate: CaloriesByDate;
}

export interface DynamicWeeklyCalorieTargetsResult {
  targetsByDate: Record<string, number>;
  weekBudget: number;
  remainingBudget: number;
  overBudgetBy: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const distributePositiveDelta = (targets: number[], indices: number[], delta: number) => {
  if (delta <= 0 || indices.length === 0) return;
  const perDay = Math.floor(delta / indices.length);
  let remainder = delta % indices.length;
  for (const idx of indices) {
    const add = perDay + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    targets[idx] += add;
  }
};

const reduceToMeetBudget = (
  targets: number[],
  minTargets: number[],
  indices: number[],
  reductionNeeded: number
) => {
  let remaining = reductionNeeded;
  while (remaining > 0) {
    const candidates = indices.filter((idx) => targets[idx] > minTargets[idx]);
    if (candidates.length === 0) break;

    const perDay = Math.floor(remaining / candidates.length);
    let remainder = remaining % candidates.length;

    for (const idx of candidates) {
      if (remaining <= 0) break;
      const desired = perDay + (remainder > 0 ? 1 : 0);
      remainder = Math.max(0, remainder - 1);
      if (desired <= 0) continue;

      const reducible = targets[idx] - minTargets[idx];
      const reduceBy = Math.min(desired, reducible);
      targets[idx] -= reduceBy;
      remaining -= reduceBy;
    }
  }
  return remaining;
};

export const getMinimumHealthyDailyCalories = (gender: 'male' | 'female' | null | undefined) => {
  // Conservative safety floors commonly used in nutrition guidance.
  return gender === 'male' ? 1500 : 1200;
};

/**
 * Computes per-day calorie targets for a week that automatically "flex" based on
 * what you've already logged (actual) and what you've planned (future), so the
 * remaining days stay on track for the weekly total.
 *
 * - Weekly budget = round(dailyTarget) * 7
 * - Days before `anchorDate` are treated as "locked" and consume budget using
 *   `max(actual, planned)` (planned is a fallback if you didn't log). If neither
 *   exists for a past day, we assume you used the base daily target (prevents
 *   "free" rollover just because a day wasn't logged/planned).
 * - From `anchorDate` through end-of-week, targets are adjusted to fit the
 *   remaining weekly budget while never dropping below `max(actual, planned)`
 *   for any given day.
 */
export const calculateDynamicWeeklyCalorieTargets = (
  input: DynamicWeeklyCalorieTargetsInput
): DynamicWeeklyCalorieTargetsResult => {
  const baseTarget = Math.max(0, Math.round(input.dailyTarget || 0));
  const minDailyTarget = Math.max(0, Math.round(input.minDailyTarget || 0));
  const weekBudget = baseTarget * WEEK_LENGTH_DAYS;

  const weekStart = startOfDay(input.weekStart);
  const anchor = startOfDay(input.anchorDate);

  const anchorOffsetDays = differenceInCalendarDays(anchor, weekStart);
  const anchorIndex = clamp(anchorOffsetDays, 0, WEEK_LENGTH_DAYS);

  const weekKeys = Array.from({ length: WEEK_LENGTH_DAYS }, (_, idx) =>
    toIsoDate(addDays(weekStart, idx))
  );

  const actuals = weekKeys.map((key) => Math.max(0, Math.round(input.actualCaloriesByDate[key] || 0)));
  const planned = weekKeys.map((key) => Math.max(0, Math.round(input.plannedCaloriesByDate[key] || 0)));
  const minTargets = actuals.map((a, idx) =>
    idx < anchorIndex ? Math.max(a, planned[idx]) : Math.max(a, planned[idx], minDailyTarget)
  );

  const pastCommitted = minTargets
    .slice(0, anchorIndex)
    .reduce((sum, v) => sum + (v > 0 ? v : baseTarget), 0);
  const remainingBudget = weekBudget - pastCommitted;

  const targets = weekKeys.map((_, idx) =>
    idx < anchorIndex ? baseTarget : Math.max(baseTarget, minTargets[idx])
  );

  const adjustableIndices = Array.from({ length: WEEK_LENGTH_DAYS - anchorIndex }, (_, i) => i + anchorIndex);
  const adjustableSum = adjustableIndices.reduce((sum, idx) => sum + targets[idx], 0);

  const delta = remainingBudget - adjustableSum;

  let overBudgetBy = 0;
  if (delta > 0) {
    const candidates = adjustableIndices.filter((idx) => targets[idx] > minTargets[idx]);
    distributePositiveDelta(targets, candidates.length > 0 ? candidates : adjustableIndices, delta);
  } else if (delta < 0) {
    const reductionNeeded = -delta;
    const remainingReduction = reduceToMeetBudget(targets, minTargets, adjustableIndices, reductionNeeded);
    overBudgetBy = remainingReduction;
  }

  const targetsByDate = weekKeys.reduce<Record<string, number>>((acc, key, idx) => {
    acc[key] = targets[idx];
    return acc;
  }, {});

  return {
    targetsByDate,
    weekBudget,
    remainingBudget,
    overBudgetBy,
  };
};
