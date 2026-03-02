import { startOfDay } from 'date-fns';
import { calculateDynamicWeeklyCalorieTargets, CaloriesByDate, toIsoDate } from './weeklyTargets';

const LOCKED_TODAY_TARGETS_STORAGE_KEY = 'dn_locked_today_targets_v1';

interface ResolveLockedTodayTargetInput {
  userId: string | number | null | undefined;
  today: Date;
  weekStart: Date;
  dailyTarget: number;
  minDailyTarget: number;
  actualCaloriesByDate: CaloriesByDate;
  plannedCaloriesByDate: CaloriesByDate;
}

const normalizeTarget = (value: number) => Math.max(0, Math.round(value || 0));

const computeStartOfDayTarget = ({
  today,
  weekStart,
  dailyTarget,
  minDailyTarget,
  actualCaloriesByDate,
  plannedCaloriesByDate,
}: Omit<ResolveLockedTodayTargetInput, 'userId'>): number => {
  const todayStart = startOfDay(today);
  const todayKey = toIsoDate(todayStart);
  const fallbackTarget = normalizeTarget(dailyTarget);

  const actualAtDayStart = {
    ...actualCaloriesByDate,
    [todayKey]: 0,
  };

  const dayStartWeek = calculateDynamicWeeklyCalorieTargets({
    weekStart,
    dailyTarget: fallbackTarget,
    minDailyTarget: normalizeTarget(minDailyTarget),
    anchorDate: todayStart,
    actualCaloriesByDate: actualAtDayStart,
    plannedCaloriesByDate,
  });

  return normalizeTarget(dayStartWeek.targetsByDate[todayKey] ?? fallbackTarget);
};

const sanitizeStoredTargets = (raw: unknown): Record<string, number> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.entries(raw as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, value]) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return acc;
    acc[key] = normalizeTarget(value);
    return acc;
  }, {});
};

export const resolveLockedTodayTarget = (input: ResolveLockedTodayTargetInput): number => {
  const todayStart = startOfDay(input.today);
  const todayKey = toIsoDate(todayStart);
  const userKey = input.userId == null ? 'anonymous' : String(input.userId);
  const storageKey = `${userKey}:${todayKey}`;
  const computedTarget = computeStartOfDayTarget(input);

  if (typeof window === 'undefined' || !window.localStorage) {
    return computedTarget;
  }

  try {
    const raw = window.localStorage.getItem(LOCKED_TODAY_TARGETS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const storedTargets = sanitizeStoredTargets(parsed);
    const storedValue = storedTargets[storageKey];
    if (typeof storedValue === 'number') {
      return storedValue;
    }
    storedTargets[storageKey] = computedTarget;
    window.localStorage.setItem(LOCKED_TODAY_TARGETS_STORAGE_KEY, JSON.stringify(storedTargets));
  } catch {
    return computedTarget;
  }

  return computedTarget;
};
