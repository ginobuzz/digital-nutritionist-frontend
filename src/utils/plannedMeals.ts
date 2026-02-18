export type PlanMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const normalizePlanMealType = (value: unknown): PlanMealType => {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'breakfast' || v === 'lunch' || v === 'dinner' || v === 'snack') return v;
  return 'snack';
};

export const defaultTimeForMealType = (mealType: PlanMealType): string => {
  switch (mealType) {
    case 'breakfast':
      return '08:00';
    case 'lunch':
      return '12:00';
    case 'dinner':
      return '18:00';
    case 'snack':
    default:
      return '15:00';
  }
};

export const coerceTime = (value: unknown, mealType: PlanMealType): string => {
  if (typeof value !== 'string') return defaultTimeForMealType(mealType);
  const trimmed = value.trim();
  const match = /^(\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) return defaultTimeForMealType(mealType);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return defaultTimeForMealType(mealType);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return defaultTimeForMealType(mealType);
  return `${match[1]}:${match[2]}`;
};

const extractJsonArray = (raw: string): string | null => {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
};

export type PlannedMealDraft = {
  name: string;
  calories: number;
  meal_type: PlanMealType;
  time: string; // HH:MM (24h)
  description: string | null;
};

export const parsePlannedMealDraftsFromReply = (reply: string): PlannedMealDraft[] => {
  const candidate = extractJsonArray(reply) ?? reply;
  const parsed = JSON.parse(candidate);
  if (!Array.isArray(parsed)) {
    throw new Error('I couldn’t understand that meal plan response. Please try again.');
  }

  return parsed
    .map((item): PlannedMealDraft | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      const calories = Number(record.calories);
      const mealType = normalizePlanMealType(record.meal_type);
      const time = coerceTime(record.time, mealType);
      const description =
        record.description == null
          ? null
          : typeof record.description === 'string'
            ? record.description.trim().slice(0, 500) || null
            : null;

      if (!name) return null;
      if (!Number.isFinite(calories)) return null;
      const caloriesInt = Math.max(0, Math.min(5000, Math.round(calories)));

      return {
        name,
        calories: caloriesInt,
        meal_type: mealType,
        time,
        description,
      };
    })
    .filter((item): item is PlannedMealDraft => Boolean(item));
};
