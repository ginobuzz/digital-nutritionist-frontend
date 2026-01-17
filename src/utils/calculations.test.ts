import {
  caloriesToWeight,
  calculateBMR,
  calculateDailyCalorieTarget,
  calculateDailyExpenditure,
  calculateProgressPercentage,
  calculateWeightLossTimeline,
  cmToFeetInches,
  feetInchesToCm,
  getMinimumCalorieTarget,
  weightToCalories,
} from './calculations';
import { User } from '../types';

const baseUser: User = {
  id: 'u1',
  name: 'Test User',
  age: 30,
  height: { feet: 5, inches: 10 },
  weight: 160,
  gender: 'male',
  activityLevel: 'moderately_active',
  targetWeight: 150,
  targetDate: new Date('2030-01-01'),
  dailyCalorieTarget: 2000,
  dailyDeficitTarget: 500,
};

describe('calculations', () => {
  test('feetInchesToCm converts correctly', () => {
    expect(feetInchesToCm(5, 10)).toBeCloseTo(177.8, 4);
  });

  test('cmToFeetInches converts (roughly) correctly', () => {
    expect(cmToFeetInches(177.8)).toEqual({ feet: 5, inches: 10 });
  });

  test('calculateBMR uses Mifflin-St Jeor (male)', () => {
    // Expected: ~1691.998 (see calculation in analysis).
    expect(calculateBMR(baseUser)).toBeCloseTo(1691.9978, 3);
  });

  test('calculateBMR uses Mifflin-St Jeor (female)', () => {
    const femaleUser: User = { ...baseUser, gender: 'female' };
    // Expected: ~1525.998
    expect(calculateBMR(femaleUser)).toBeCloseTo(1525.9978, 3);
  });

  test('calculateDailyExpenditure applies activity multipliers', () => {
    const sedentary = { ...baseUser, activityLevel: 'sedentary' as const };
    const veryActive = { ...baseUser, activityLevel: 'very_active' as const };
    expect(calculateDailyExpenditure(veryActive)).toBeGreaterThan(calculateDailyExpenditure(sedentary));
  });

  test('calculateDailyCalorieTarget subtracts dailyDeficitTarget', () => {
    const expenditure = calculateDailyExpenditure(baseUser);
    expect(calculateDailyCalorieTarget(baseUser)).toBeCloseTo(expenditure - baseUser.dailyDeficitTarget, 6);
  });

  test('calculateDailyCalorieTarget enforces a healthy minimum', () => {
    const femaleUser: User = { ...baseUser, gender: 'female', dailyDeficitTarget: 5000 };
    expect(calculateDailyCalorieTarget(femaleUser)).toBe(getMinimumCalorieTarget('female'));
  });

  test('calculateWeightLossTimeline returns days (ceil)', () => {
    const user: User = { ...baseUser, weight: 160, targetWeight: 150, dailyDeficitTarget: 500 };
    // 10lb * 3500 / 500 = 70 exactly
    expect(calculateWeightLossTimeline(user)).toBe(70);
  });

  test('calculateProgressPercentage clamps between 0 and 100', () => {
    const user: User = { ...baseUser, weight: 200, targetWeight: 180 };
    expect(calculateProgressPercentage(user, 210)).toBe(0);
    expect(calculateProgressPercentage(user, 190)).toBeCloseTo(50, 6);
    expect(calculateProgressPercentage(user, 160)).toBe(100);
  });

  test('caloriesToWeight and weightToCalories are inverses', () => {
    expect(weightToCalories(2)).toBe(7000);
    expect(caloriesToWeight(7000)).toBe(2);
  });
});
