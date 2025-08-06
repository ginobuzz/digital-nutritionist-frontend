import { apiService } from '../services/api';

export const testApiConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    // Test the API connection by making a simple request
    // We'll try to get the API docs or health endpoint
    const response = await fetch('https://sundaymornings-backend-297759956270.europe-west1.run.app/docs');
    
    if (response.ok) {
      return {
        success: true,
        message: 'API connection successful - backend is accessible'
      };
    } else {
      return {
        success: false,
        message: `API connection failed - Status: ${response.status} ${response.statusText}`
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `API connection failed - ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

export const testUserCreation = async (): Promise<{ success: boolean; message: string; userId?: string }> => {
  try {
    const testUser = {
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

    const createdUser = await apiService.createUser(testUser);
    
    return {
      success: true,
      message: 'User creation test successful',
      userId: createdUser.id
    };
  } catch (error) {
    return {
      success: false,
      message: `User creation test failed - ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}; 