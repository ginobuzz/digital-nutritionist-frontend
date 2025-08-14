import { User, WeightLog } from '../types';

// Use absolute URLs to avoid proxy issues
const API_BASE_URL = 'https://sundaymornings-backend-297759956270.europe-west1.run.app';

// API Response types based on FastAPI backend
export interface UserResponse {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  height_in: number | null;
  starting_weight_lb: number | null;
  goal_weight_lb: number | null;
  goal_weight_date: string | null;
  daily_calorie_budget: number | null;
  age: number;
  gender: 'male' | 'female';
  activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
  created_at: string;
  updated_at: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  age?: number;
  gender?: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
  activity_level?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';
  height_in?: number;
  starting_weight_lb?: number;
  goal_weight_lb?: number;
  goal_weight_date?: string;
  daily_calorie_budget?: number;
}

export interface UpdateUserRequest extends Partial<CreateUserRequest> {
  id: string;
}

export interface WeightLogResponse {
  id: string;
  user_id: string;
  weight: number;
  date: string; // ISO date string
  notes?: string;
}

export interface CreateWeightLogRequest {
  user_id: string;
  weight: number;
  date: string; // ISO date string
  notes?: string;
}

// Helper functions to convert between frontend and backend formats
export const convertUserToBackend = (user: User): CreateUserRequest => {
  // Split name into first and last name
  const nameParts = user.name.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  // Map activity level to backend format
  const activityLevelMap: Record<string, string> = {
    'extremely_active': 'extra_active',
    'moderately_active': 'moderately_active',
    'lightly_active': 'lightly_active',
    'sedentary': 'sedentary',
    'very_active': 'very_active',
  };
  
  // Log the conversion for debugging purposes
  if (user.dailyCalorieTarget !== Math.round(user.dailyCalorieTarget)) {
    console.log(`Rounding dailyCalorieTarget from ${user.dailyCalorieTarget} to ${Math.round(user.dailyCalorieTarget)}`);
  }
  
  return {
    email: `${user.name.toLowerCase().replace(/\s+/g, '.')}@example.com`, // Generate email from name
    password: 'password123', // Default password for testing
    first_name: firstName,
    last_name: lastName,
    age: user.age,
    gender: user.gender,
    activity_level: activityLevelMap[user.activityLevel] as any,
    // Convert height from feet/inches to total inches
    height_in: user.height.feet * 12 + user.height.inches,
    // Convert weight to pounds (already in pounds)
    starting_weight_lb: user.weight,
    goal_weight_lb: user.targetWeight,
    goal_weight_date: user.targetDate.toISOString().split('T')[0],
    daily_calorie_budget: Math.round(user.dailyCalorieTarget),
  };
};

export const convertUserFromBackend = (userResponse: UserResponse): User => {
  // Convert height from inches back to feet/inches
  const totalInches = userResponse.height_in || 0;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  
  // Combine first and last name
  const fullName = [userResponse.first_name, userResponse.last_name]
    .filter(Boolean)
    .join(' ') || 'Unknown User';
  
  return {
    id: userResponse.id,
    name: fullName,
    age: userResponse.age,
    height: {
      feet: feet,
      inches: inches,
    },
    weight: userResponse.starting_weight_lb || 0,
    gender: userResponse.gender,
    activityLevel: userResponse.activity_level,
    targetWeight: userResponse.goal_weight_lb || 0,
    targetDate: userResponse.goal_weight_date ? new Date(userResponse.goal_weight_date) : new Date(),
    dailyCalorieTarget: userResponse.daily_calorie_budget || 0,
    dailyDeficitTarget: 0, // Not provided by backend
  };
};

export const convertWeightLogFromBackend = (logResponse: WeightLogResponse): WeightLog => ({
  id: logResponse.id,
  weight: logResponse.weight,
  date: new Date(logResponse.date),
  notes: logResponse.notes,
});

// API service class
class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
      mode: 'cors',
      credentials: 'omit',
      ...options,
    });

    if (!response.ok) {
      let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
      
      // Try to get more detailed error information for 422 errors
      if (response.status === 422) {
        try {
          const errorData = await response.json();
          
          // Provide user-friendly error messages for common validation errors
          if (Array.isArray(errorData.detail)) {
            const userFriendlyErrors = errorData.detail.map((error: any) => {
              if (error.type === 'int_from_float' && error.loc.includes('daily_calorie_budget')) {
                return 'Daily calorie budget must be a whole number. The system has automatically rounded this value for you.';
              }
              if (error.type === 'missing') {
                return `Missing required field: ${error.loc.join('.')}`;
              }
              if (error.type === 'value_error') {
                return `Invalid value for ${error.loc.join('.')}: ${error.msg}`;
              }
              return `${error.loc.join('.')}: ${error.msg}`;
            });
            
            if (userFriendlyErrors.length > 0) {
              errorMessage = userFriendlyErrors.join('; ');
            } else {
              errorMessage += ` - ${JSON.stringify(errorData)}`;
            }
          } else {
            errorMessage += ` - ${JSON.stringify(errorData)}`;
          }
        } catch (e) {
          // If we can't parse the error response, just use the status
        }
      }
      
      // For 500 errors, try to get the response text
      if (response.status === 500) {
        try {
          const errorText = await response.text();
          errorMessage += ` - ${errorText}`;
        } catch (e) {
          // If we can't read the response, just use the status
        }
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // User endpoints
  async createUser(userData: CreateUserRequest): Promise<UserResponse> {
    console.log('Sending user data to backend:', userData);
    return this.request<UserResponse>('/users/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getUser(userId: string): Promise<UserResponse> {
    return this.request<UserResponse>(`/users/${userId}`);
  }

  async updateUser(userId: string, userData: Partial<CreateUserRequest>): Promise<UserResponse> {
    return this.request<UserResponse>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(userId: string): Promise<void> {
    await this.request(`/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // Weight log endpoints
  async getWeightLogs(userId: string): Promise<WeightLogResponse[]> {
    return this.request<WeightLogResponse[]>(`/users/${userId}/weight-logs`);
  }

  async createWeightLog(weightLogData: CreateWeightLogRequest): Promise<WeightLogResponse> {
    return this.request<WeightLogResponse>('/weight-logs/', {
      method: 'POST',
      body: JSON.stringify(weightLogData),
    });
  }

  async updateWeightLog(logId: string, weightLogData: Partial<CreateWeightLogRequest>): Promise<WeightLogResponse> {
    return this.request<WeightLogResponse>(`/weight-logs/${logId}`, {
      method: 'PUT',
      body: JSON.stringify(weightLogData),
    });
  }

  async deleteWeightLog(logId: string): Promise<void> {
    await this.request(`/weight-logs/${logId}`, {
      method: 'DELETE',
    });
  }
}

// Export singleton instance
export const apiService = new ApiService(); 