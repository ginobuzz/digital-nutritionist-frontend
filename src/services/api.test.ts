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
    
    expect(backendUser.name).toBe(testUser.name);
    expect(backendUser.age).toBe(testUser.age);
    expect(backendUser.height_feet).toBe(testUser.height.feet);
    expect(backendUser.height_inches).toBe(testUser.height.inches);
    expect(backendUser.weight).toBe(testUser.weight);
    expect(backendUser.gender).toBe(testUser.gender);
    expect(backendUser.activity_level).toBe(testUser.activityLevel);
    expect(backendUser.target_weight).toBe(testUser.targetWeight);
    expect(backendUser.daily_calorie_target).toBe(testUser.dailyCalorieTarget);
    expect(backendUser.daily_deficit_target).toBe(testUser.dailyDeficitTarget);
  });

  test('convertUserFromBackend should convert backend user to frontend format', () => {
    // Create a mock UserResponse (backend format) with an id
    const backendUserResponse = {
      id: 'test-1',
      name: testUser.name,
      age: testUser.age,
      height_feet: testUser.height.feet,
      height_inches: testUser.height.inches,
      weight: testUser.weight,
      gender: testUser.gender,
      activity_level: testUser.activityLevel,
      target_weight: testUser.targetWeight,
      target_date: testUser.targetDate.toISOString().split('T')[0],
      daily_calorie_target: testUser.dailyCalorieTarget,
      daily_deficit_target: testUser.dailyDeficitTarget,
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
    expect(frontendUser.dailyDeficitTarget).toBe(testUser.dailyDeficitTarget);
  });

  test('API service should have correct base URL', () => {
    expect(apiService).toBeDefined();
  });
}); 