import { coerceTime, normalizePlanMealType, parsePlannedMealDraftsFromReply } from './plannedMeals';

describe('plannedMeals', () => {
  test('normalizePlanMealType defaults to snack', () => {
    expect(normalizePlanMealType('DINNER')).toBe('dinner');
    expect(normalizePlanMealType('unknown')).toBe('snack');
    expect(normalizePlanMealType(null)).toBe('snack');
  });

  test('coerceTime returns default for invalid values', () => {
    expect(coerceTime('25:99', 'lunch')).toBe('12:00');
    expect(coerceTime('nope', 'breakfast')).toBe('08:00');
    expect(coerceTime(undefined, 'snack')).toBe('15:00');
    expect(coerceTime('09:30', 'dinner')).toBe('09:30');
  });

  test('parsePlannedMealDraftsFromReply extracts JSON array from surrounding text', () => {
    const reply = [
      'Here are a few options:',
      '',
      JSON.stringify([
        { name: 'Greek yogurt bowl', calories: 420.2, meal_type: 'breakfast', time: '08:15', description: 'High protein' },
        { name: 'Chicken salad', calories: 610, meal_type: 'lunch', time: '12:00' },
        { name: '', calories: 100, meal_type: 'snack', time: '15:00' },
        { name: 'Bad calories', calories: 'nope', meal_type: 'dinner', time: '18:00' },
      ]),
      '',
      'Enjoy!',
    ].join('\n');

    const drafts = parsePlannedMealDraftsFromReply(reply);
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toEqual({
      name: 'Greek yogurt bowl',
      calories: 420,
      meal_type: 'breakfast',
      time: '08:15',
      description: 'High protein',
    });
    expect(drafts[1].meal_type).toBe('lunch');
  });

  test('parsePlannedMealDraftsFromReply clamps calories and coerces time/meal_type', () => {
    const reply = JSON.stringify([
      { name: 'Huge meal', calories: 999999, meal_type: 'dinner', time: '99:99' },
      { name: 'Negative meal', calories: -10, meal_type: '???', time: '10:00', description: '  ' },
    ]);

    const drafts = parsePlannedMealDraftsFromReply(reply);
    expect(drafts[0].calories).toBe(5000);
    expect(drafts[0].time).toBe('18:00'); // default dinner time
    expect(drafts[1].calories).toBe(0);
    expect(drafts[1].meal_type).toBe('snack');
    expect(drafts[1].description).toBeNull();
  });
});

