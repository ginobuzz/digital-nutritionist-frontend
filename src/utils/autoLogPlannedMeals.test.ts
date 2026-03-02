import { autoLogDuePlannedMeals } from './autoLogPlannedMeals';
import { MealLogResponse, PlannedMealResponse } from '../services/api';

const makePlannedMeal = (overrides: Partial<PlannedMealResponse> = {}): PlannedMealResponse => ({
  id: 'planned-1',
  user_id: 'user-1',
  date: '2026-03-01',
  name: 'Chicken bowl',
  calories: 600,
  meal_type: 'lunch',
  time: '2026-03-01T12:30:00Z',
  description: 'extra veggies',
  created_at: '2026-02-27T10:00:00Z',
  updated_at: '2026-02-27T10:00:00Z',
  ...overrides,
});

const makeMealLog = (overrides: Partial<MealLogResponse> = {}): MealLogResponse => ({
  id: 'log-1',
  user_id: 'user-1',
  date: '2026-03-01',
  meal_type: 'lunch',
  user_description: 'Chicken bowl - extra veggies',
  estimated_calories: 600,
  ...overrides,
});

describe('autoLogDuePlannedMeals', () => {
  test('creates meal logs for due planned meals and deletes planned entries', async () => {
    const planned = makePlannedMeal();
    const createMealLog = jest.fn().mockResolvedValue(makeMealLog({ id: 'log-created' }));
    const deletePlannedMeal = jest.fn().mockResolvedValue(undefined);

    const result = await autoLogDuePlannedMeals({
      api: { createMealLog, deletePlannedMeal },
      userId: 'user-1',
      today: new Date('2026-03-02T08:00:00Z'),
      logs: [],
      plannedMeals: [planned],
    });

    expect(createMealLog).toHaveBeenCalledTimes(1);
    expect(deletePlannedMeal).toHaveBeenCalledWith('planned-1');
    expect(result.logs).toHaveLength(1);
    expect(result.plannedMeals).toHaveLength(0);
    expect(result.changed).toBe(true);
  });

  test('does not create duplicate logs when a matching log already exists', async () => {
    const planned = makePlannedMeal();
    const createMealLog = jest.fn().mockResolvedValue(makeMealLog({ id: 'log-created' }));
    const deletePlannedMeal = jest.fn().mockResolvedValue(undefined);

    const result = await autoLogDuePlannedMeals({
      api: { createMealLog, deletePlannedMeal },
      userId: 'user-1',
      today: new Date('2026-03-02T08:00:00Z'),
      logs: [makeMealLog()],
      plannedMeals: [planned],
    });

    expect(createMealLog).not.toHaveBeenCalled();
    expect(deletePlannedMeal).toHaveBeenCalledWith('planned-1');
    expect(result.logs).toHaveLength(1);
    expect(result.plannedMeals).toHaveLength(0);
    expect(result.changed).toBe(true);
  });

  test('skips future planned meals', async () => {
    const futurePlanned = makePlannedMeal({ id: 'planned-future', date: '2026-03-04' });
    const createMealLog = jest.fn().mockResolvedValue(makeMealLog({ id: 'log-created' }));
    const deletePlannedMeal = jest.fn().mockResolvedValue(undefined);

    const result = await autoLogDuePlannedMeals({
      api: { createMealLog, deletePlannedMeal },
      userId: 'user-1',
      today: new Date('2026-03-02T08:00:00Z'),
      logs: [],
      plannedMeals: [futurePlanned],
    });

    expect(createMealLog).not.toHaveBeenCalled();
    expect(deletePlannedMeal).not.toHaveBeenCalled();
    expect(result.logs).toHaveLength(0);
    expect(result.plannedMeals).toHaveLength(1);
    expect(result.changed).toBe(false);
  });
});
