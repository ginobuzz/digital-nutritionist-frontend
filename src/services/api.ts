import { User, WeightLog } from '../types';

const API_BASE_URL = 'https://sundaymornings-backend-297759956270.europe-west1.run.app';

// API Response types based on FastAPI backend
export interface UserResponse {
  id: string;
  name: string;
  age: number;
  height_feet: number;
  height_inches: number;
  weight: number;
  gender: 'male' | 'female';
  activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
  target_weight: number;
  target_date: string; // ISO date string
  daily_calorie_target: number;
  daily_deficit_target: number;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  age: number;
  height_feet: number;
  height_inches: number;
  weight: number;
  gender: 'male' | 'female';
  activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
  target_weight: number;
  target_date: string; // ISO date string
  daily_calorie_target?: number;
  daily_deficit_target?: number;
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
export const convertUserToBackend = (user: User): CreateUserRequest => ({
  name: user.name,
  email: `${user.name.toLowerCase().replace(/\s+/g, '.')}@example.com`, // Generate email from name
  password: 'password123', // Default password for testing
  age: user.age,
  height_feet: user.height.feet,
  height_inches: user.height.inches,
  weight: user.weight,
  gender: user.gender,
  activity_level: user.activityLevel,
  target_weight: user.targetWeight,
  target_date: user.targetDate.toISOString().split('T')[0],
  // Only include calorie fields if they are valid numbers
  ...(user.dailyCalorieTarget > 0 && { daily_calorie_target: user.dailyCalorieTarget }),
  ...(user.dailyDeficitTarget > 0 && { daily_deficit_target: user.dailyDeficitTarget }),
});

export const convertUserFromBackend = (userResponse: UserResponse): User => ({
  id: userResponse.id,
  name: userResponse.name,
  age: userResponse.age,
  height: {
    feet: userResponse.height_feet,
    inches: userResponse.height_inches,
  },
  weight: userResponse.weight,
  gender: userResponse.gender,
  activityLevel: userResponse.activity_level,
  targetWeight: userResponse.target_weight,
  targetDate: new Date(userResponse.target_date),
  dailyCalorieTarget: userResponse.daily_calorie_target,
  dailyDeficitTarget: userResponse.daily_deficit_target,
});

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
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
      
      // Try to get more detailed error information for 422 errors
      if (response.status === 422) {
        try {
          const errorData = await response.json();
          errorMessage += ` - ${JSON.stringify(errorData)}`;
        } catch (e) {
          // If we can't parse the error response, just use the status
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