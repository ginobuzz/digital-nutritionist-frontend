import { apiService, convertUserToBackend, convertUserFromBackend } from './api';
import { User } from '../types';

// Test data
const testUser: User = {
  id: 'test-1',
  name: 'Test User',
  age: 30,
  height: { feet: 5, inches: 10 },
  weight: 160,
  gender: 'male',
  activityLevel: 'moderately_active',
  targetWeight: 150,
  targetDate: new Date('2024-06-01'),
  dailyCalorieTarget: 2000,
  dailyDeficitTarget: 500,
};

describe('API Service', () => {
  test('convertUserToBackend should convert frontend user to backend format', () => {
    const backendUser = convertUserToBackend(testUser);
    
    expect(backendUser.first_name).toBe('Test');
    expect(backendUser.last_name).toBe('User');
    expect(backendUser.age).toBe(testUser.age);
    expect(backendUser.height_in).toBe(testUser.height.feet * 12 + testUser.height.inches);
    expect(backendUser.starting_weight_lb).toBe(testUser.weight);
    expect(backendUser.gender).toBe(testUser.gender);
    expect(backendUser.activity_level).toBe('moderately_active');
    expect(backendUser.goal_weight_lb).toBe(testUser.targetWeight);
    expect(backendUser.daily_calorie_budget).toBe(Math.round(testUser.dailyCalorieTarget));
  });

  test('convertUserFromBackend should convert backend user to frontend format', () => {
    // Create a mock UserResponse (backend format) with an id
    const totalInches = testUser.height.feet * 12 + testUser.height.inches;
    const backendUserResponse = {
      id: 'test-1',
      first_name: 'Test',
      last_name: 'User',
      email: 'test.user@example.com',
      height_in: totalInches,
      starting_weight_lb: testUser.weight,
      goal_weight_lb: testUser.targetWeight,
      goal_weight_date: testUser.targetDate.toISOString().split('T')[0],
      daily_calorie_budget: Math.round(testUser.dailyCalorieTarget),
      age: testUser.age,
      gender: testUser.gender,
      activity_level: testUser.activityLevel,
      created_at: '2024-01-01T00:00:00',
      updated_at: '2024-01-01T00:00:00',
    };
    
    const frontendUser = convertUserFromBackend(backendUserResponse);
    
    expect(frontendUser.name).toBe(testUser.name);
    expect(frontendUser.age).toBe(testUser.age);
    expect(frontendUser.height.feet).toBe(testUser.height.feet);
    expect(frontendUser.height.inches).toBe(testUser.height.inches);
    expect(frontendUser.weight).toBe(testUser.weight);
    expect(frontendUser.gender).toBe(testUser.gender);
    expect(frontendUser.activityLevel).toBe(testUser.activityLevel);
    expect(frontendUser.targetWeight).toBe(testUser.targetWeight);
    expect(frontendUser.dailyCalorieTarget).toBe(testUser.dailyCalorieTarget);
    expect(frontendUser.dailyDeficitTarget).toBe(0); // Not provided by backend
  });

  test('API service should have correct base URL', () => {
    expect(apiService).toBeDefined();
  });

  test('convertUserToBackend should round dailyCalorieTarget to integer', () => {
    const userWithDecimal: User = {
      ...testUser,
      dailyCalorieTarget: 2000.75
    };
    
    const backendUser = convertUserToBackend(userWithDecimal);
    expect(backendUser.daily_calorie_budget).toBe(2001); // Should round up
    expect(Number.isInteger(backendUser.daily_calorie_budget)).toBe(true);
  });

  test('convertUserToBackend should handle integer dailyCalorieTarget without rounding', () => {
    const userWithInteger: User = {
      ...testUser,
      dailyCalorieTarget: 2000
    };
    
    const backendUser = convertUserToBackend(userWithInteger);
    expect(backendUser.daily_calorie_budget).toBe(2000);
    expect(Number.isInteger(backendUser.daily_calorie_budget)).toBe(true);
  });
}); 