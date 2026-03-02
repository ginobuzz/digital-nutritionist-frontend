import { PlannedMealDraft } from './plannedMeals';
import { constrainPlannedMealDraftsToInput, shouldLimitToSinglePlannedMeal } from './plannedMealSelection';

const makeDraft = (overrides: Partial<PlannedMealDraft>): PlannedMealDraft => ({
  name: 'Meal',
  calories: 400,
  meal_type: 'snack',
  time: '15:00',
  description: null,
  ...overrides,
});

describe('plannedMealSelection', () => {
  test('limits to a single meal when prompt looks like one meal request', () => {
    expect(shouldLimitToSinglePlannedMeal('Scrambled eggs with toast and apple')).toBe(true);
  });

  test('does not limit when user explicitly asks for multiple meal types', () => {
    expect(shouldLimitToSinglePlannedMeal('Breakfast: oatmeal. Lunch: turkey sandwich.')).toBe(false);
    expect(shouldLimitToSinglePlannedMeal('Create a full day meal plan')).toBe(false);
  });

  test('keeps only the most relevant draft when single meal mode applies', () => {
    const drafts: PlannedMealDraft[] = [
      makeDraft({
        name: 'Turkey and avocado sandwich with side salad',
        meal_type: 'lunch',
      }),
      makeDraft({
        name: 'Scrambled eggs with toast and apple',
        meal_type: 'breakfast',
      }),
      makeDraft({
        name: 'Greek yogurt with berries and almonds',
        meal_type: 'snack',
      }),
    ];

    const constrained = constrainPlannedMealDraftsToInput(drafts, 'eggs and an apple for breakfast');
    expect(constrained).toHaveLength(1);
    expect(constrained[0].name).toBe('Scrambled eggs with toast and apple');
  });

  test('does not remove drafts when input indicates a multi-meal request', () => {
    const drafts: PlannedMealDraft[] = [
      makeDraft({ name: 'Eggs', meal_type: 'breakfast' }),
      makeDraft({ name: 'Chicken salad', meal_type: 'lunch' }),
    ];

    const constrained = constrainPlannedMealDraftsToInput(drafts, 'Breakfast eggs and lunch chicken salad');
    expect(constrained).toHaveLength(2);
  });
});
