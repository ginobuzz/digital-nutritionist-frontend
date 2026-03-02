import { format, startOfDay } from 'date-fns';
import { CreateMealLogRequest, MealLogResponse, PlannedMealResponse } from '../services/api';

const toIsoDate = (d: Date) => format(d, 'yyyy-MM-dd');

const normalizeMealTypeForBackend = (value: string | null | undefined): string | null => {
  const normalized = (value || '').trim().toLowerCase();
  return normalized ? normalized : null;
};

const normalizeText = (value: string | null | undefined): string => (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const buildPlannedMealDescription = (meal: PlannedMealResponse): string => {
  const description = (meal.description || '').trim();
  return description ? `${meal.name} - ${description}` : meal.name;
};

const buildLogSignature = (params: {
  date: string;
  mealType: string | null;
  calories: number;
  userDescription: string;
}) => {
  const { date, mealType, calories, userDescription } = params;
  return `${date}|${mealType || ''}|${Math.max(0, Math.round(calories))}|${normalizeText(userDescription)}`;
};

const buildSignatureFromMealLog = (log: MealLogResponse): string =>
  buildLogSignature({
    date: log.date,
    mealType: normalizeMealTypeForBackend(log.meal_type),
    calories: Number(log.estimated_calories || 0),
    userDescription: log.user_description || '',
  });

const buildSignatureFromPlannedMeal = (meal: PlannedMealResponse): string =>
  buildLogSignature({
    date: meal.date,
    mealType: normalizeMealTypeForBackend(meal.meal_type),
    calories: Number(meal.calories || 0),
    userDescription: buildPlannedMealDescription(meal),
  });

export interface PlannedMealAutoLoggerApi {
  createMealLog: (payload: CreateMealLogRequest) => Promise<MealLogResponse>;
  deletePlannedMeal: (mealId: string) => Promise<void>;
}

export interface AutoLogDuePlannedMealsInput {
  api: PlannedMealAutoLoggerApi;
  userId: string | number;
  today: Date;
  logs: MealLogResponse[];
  plannedMeals: PlannedMealResponse[];
  onError?: (error: unknown, context: { action: 'create-log' | 'delete-planned'; meal: PlannedMealResponse }) => void;
}

export interface AutoLogDuePlannedMealsResult {
  logs: MealLogResponse[];
  plannedMeals: PlannedMealResponse[];
  changed: boolean;
}

export const autoLogDuePlannedMeals = async (
  input: AutoLogDuePlannedMealsInput
): Promise<AutoLogDuePlannedMealsResult> => {
  const todayKey = toIsoDate(startOfDay(input.today));
  const nextLogs = [...input.logs];
  const existingSignatures = new Set(nextLogs.map(buildSignatureFromMealLog));
  const removedPlannedIds = new Set<string>();
  let changed = false;

  const duePlannedMeals = input.plannedMeals.filter((meal) => meal.date <= todayKey);
  if (duePlannedMeals.length === 0) {
    return {
      logs: nextLogs,
      plannedMeals: input.plannedMeals,
      changed: false,
    };
  }

  for (const meal of duePlannedMeals) {
    const plannedSignature = buildSignatureFromPlannedMeal(meal);

    if (!existingSignatures.has(plannedSignature)) {
      const payload: CreateMealLogRequest = {
        user_id: input.userId,
        date: meal.date,
        user_description: buildPlannedMealDescription(meal),
        meal_type: normalizeMealTypeForBackend(meal.meal_type),
        estimated_calories: Number(meal.calories || 0),
        time: meal.time,
      };

      try {
        const createdLog = await input.api.createMealLog(payload);
        nextLogs.push(createdLog);
        existingSignatures.add(plannedSignature);
        changed = true;
      } catch (error) {
        input.onError?.(error, { action: 'create-log', meal });
        continue;
      }
    }

    try {
      await input.api.deletePlannedMeal(String(meal.id));
      removedPlannedIds.add(String(meal.id));
      changed = true;
    } catch (error) {
      input.onError?.(error, { action: 'delete-planned', meal });
    }
  }

  const nextPlannedMeals = removedPlannedIds.size === 0
    ? input.plannedMeals
    : input.plannedMeals.filter((meal) => !removedPlannedIds.has(String(meal.id)));

  return {
    logs: nextLogs,
    plannedMeals: nextPlannedMeals,
    changed,
  };
};
