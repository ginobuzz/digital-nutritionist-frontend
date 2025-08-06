import { apiService } from '../services/api';

export const testMinimalUserCreation = async () => {
  const minimalUser = {
    name: 'Test User',
    email: 'test.user@example.com',
    password: 'password123',
    age: 30,
    height_feet: 5,
    height_inches: 10,
    weight: 160,
    gender: 'male' as const,
    activity_level: 'moderately_active' as const,
    target_weight: 150,
    target_date: '2024-06-01',
    // Omitting calorie fields to test if they're the issue
  };

  console.log('Testing with minimal user data:', minimalUser);
  
  try {
    const result = await apiService.createUser(minimalUser);
    console.log('Success! Created user:', result);
    return { success: true, user: result };
  } catch (error) {
    console.error('Failed to create user:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export const testFullUserCreation = async () => {
  const fullUser = {
    name: 'Test User',
    email: 'test.user@example.com',
    password: 'password123',
    age: 30,
    height_feet: 5,
    height_inches: 10,
    weight: 160,
    gender: 'male' as const,
    activity_level: 'moderately_active' as const,
    target_weight: 150,
    target_date: '2024-06-01',
    daily_calorie_target: 2000,
    daily_deficit_target: 500,
  };

  console.log('Testing with full user data:', fullUser);
  
  try {
    const result = await apiService.createUser(fullUser);
    console.log('Success! Created user:', result);
    return { success: true, user: result };
  } catch (error) {
    console.error('Failed to create user:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}; 