import { apiService } from '../services/api';

export const testMinimalUserCreation = async () => {
  const minimalUser = {
    email: 'test.user@example.com',
    password: 'password123',
    first_name: 'Test',
    last_name: 'User',
    age: 30,
    gender: 'male' as const,
    activity_level: 'moderately_active' as const,
    height_in: 70, // 5'10" in inches
    starting_weight_lb: 160,
    goal_weight_lb: 150,
    goal_weight_date: '2024-06-01',
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
    email: 'test.user@example.com',
    password: 'password123',
    first_name: 'Test',
    last_name: 'User',
    age: 30,
    gender: 'male' as const,
    activity_level: 'moderately_active' as const,
    height_in: 70, // 5'10" in inches
    starting_weight_lb: 160,
    goal_weight_lb: 150,
    goal_weight_date: '2024-06-01',
    daily_calorie_budget: 2000,
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