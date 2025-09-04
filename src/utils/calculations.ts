import { User } from '../types';

// Convert feet and inches to centimeters for BMR calculation
export const feetInchesToCm = (feet: number, inches: number): number => {
  return (feet * 12 + inches) * 2.54;
};

// Convert centimeters to feet and inches
export const cmToFeetInches = (cm: number): { feet: number; inches: number } => {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
};

// Mifflin-St Jeor BMR calculation
export const calculateBMR = (user: User): number => {
  const { weight, height, age, gender } = user;
  const heightCm = feetInchesToCm(height.feet, height.inches);
  // The app stores weight in pounds; Mifflin-St Jeor expects kilograms
  const weightKg = weight * 0.45359237;
  
  if (gender === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
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
  const totalCaloriesNeeded = weightToLose * 3500; // 1 lb ≈ 3500 calories
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
  return calories / 3500; // 1 lb ≈ 3500 calories
};

// Convert weight to calories
export const weightToCalories = (weight: number): number => {
  return weight * 3500;
}; 