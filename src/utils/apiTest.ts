import { apiService } from '../services/api';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

export const testApiConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    // Test the API connection by making a simple request
    // We'll try to get the API docs or health endpoint
    const response = await fetch(`${API_BASE_URL}/docs`);
    
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