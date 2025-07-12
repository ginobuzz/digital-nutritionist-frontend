import { User } from '../types';

// Mifflin-St Jeor BMR calculation
export const calculateBMR = (user: User): number => {
  const { weight, height, age, gender } = user;
  
  if (gender === 'male') {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }
};

// Activity multipliers
const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9
};

// Calculate daily calorie expenditure
export const calculateDailyExpenditure = (user: User): number => {
  const bmr = calculateBMR(user);
  return bmr * ACTIVITY_MULTIPLIERS[user.activityLevel];
};

// Calculate daily calorie target for weight loss
export const calculateDailyCalorieTarget = (user: User): number => {
  const expenditure = calculateDailyExpenditure(user);
  return expenditure - user.dailyDeficitTarget;
};

// Calculate weight loss timeline
export const calculateWeightLossTimeline = (user: User): number => {
  const weightToLose = user.weight - user.targetWeight;
  const totalCaloriesNeeded = weightToLose * 7700; // 1 kg ≈ 7700 calories
  return Math.ceil(totalCaloriesNeeded / user.dailyDeficitTarget);
};

// Calculate progress percentage
export const calculateProgressPercentage = (user: User, currentWeight: number): number => {
  const totalWeightToLose = user.weight - user.targetWeight;
  const weightLost = user.weight - currentWeight;
  return Math.min(100, Math.max(0, (weightLost / totalWeightToLose) * 100));
};

// Convert calories to weight (approximate)
export const caloriesToWeight = (calories: number): number => {
  return calories / 7700; // 1 kg ≈ 7700 calories
};

// Convert weight to calories
export const weightToCalories = (weight: number): number => {
  return weight * 7700;
}; 