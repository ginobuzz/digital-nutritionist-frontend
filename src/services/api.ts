import { User, WeightLog } from '../types';
import { format } from 'date-fns';
import { authService } from './auth';
import { API_BASE_URL } from './config';
import { calculateDailyExpenditure } from '../utils/calculations';

const toIsoDate = (d: Date) => format(d, 'yyyy-MM-dd');

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
  activity_level:
    | 'sedentary'
    | 'lightly_active'
    | 'moderately_active'
    | 'very_active'
    | 'extremely_active'
    | 'extra_active';
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

// Meal log types (align with FastAPI backend models)
export interface MealLogResponse {
  id: string;
  user_id: string | number;
  date: string; // YYYY-MM-DD
  meal_type?: string | null;
  user_description: string;
  estimated_calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateMealLogRequest {
  user_id: string | number;
  date: string; // YYYY-MM-DD
  user_description: string;
  meal_type?: string | null;
  estimated_calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  // Optional time-of-day for UI logging; stored in backend `created_at`.
  time?: string;
}

export interface UpdateMealLogRequest extends Partial<CreateMealLogRequest> {}

export interface PlannedMealResponse {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  name: string;
  calories: number;
  meal_type: string;
  time: string; // ISO datetime
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePlannedMealRequest {
  user_id: string;
  date: string; // YYYY-MM-DD
  name: string;
  calories: number;
  meal_type: string;
  time: string; // ISO datetime
  description?: string | null;
}

export interface UpdatePlannedMealRequest extends Partial<CreatePlannedMealRequest> {}

export interface ActivityLogResponse {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  name: string;
  calories_burned: number;
  duration: number;
  type: string;
  time: string; // ISO datetime
  created_at: string;
  updated_at: string;
}

export interface CreateActivityLogRequest {
  user_id: string;
  date: string; // YYYY-MM-DD
  name: string;
  calories_burned: number;
  duration: number;
  type: string;
  time: string; // ISO datetime
}

export interface UpdateActivityLogRequest extends Partial<CreateActivityLogRequest> {}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  user_id?: string | number;
  history?: ChatTurn[];
  client_local_date?: string; // YYYY-MM-DD (user's local date)
  client_time_zone?: string; // IANA tz name (e.g., America/Los_Angeles)
  image_data_url?: string; // data:image/*;base64,...
}

export interface ChatResponse {
  reply: string;
  model?: string | null;
  usage?: any;
  created_meal_logs?: MealLogResponse[];
  created_planned_meals?: PlannedMealResponse[];
}

export class UserNotFoundError extends Error {
  constructor() {
    super('');
    this.name = 'UserNotFoundError';
  }
}

export const isUserNotFoundError = (error: unknown): error is UserNotFoundError =>
  error instanceof Error && error.name === 'UserNotFoundError';

const readTokenFromStorage = (): string | null => {
  try {
    return authService.getToken();
  } catch {
    return null;
  }
};

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

export const convertUserProfileUpdateToBackend = (user: User): Partial<CreateUserRequest> => {
  const nameParts = user.name.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const activityLevelMap: Record<string, string> = {
    extremely_active: 'extra_active',
    moderately_active: 'moderately_active',
    lightly_active: 'lightly_active',
    sedentary: 'sedentary',
    very_active: 'very_active',
  };

  return {
    first_name: firstName,
    last_name: lastName,
    age: user.age,
    gender: user.gender,
    activity_level: activityLevelMap[user.activityLevel] as CreateUserRequest['activity_level'],
    height_in: user.height.feet * 12 + user.height.inches,
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
  
  const activityLevel: User['activityLevel'] =
    userResponse.activity_level === 'extra_active' ? 'extremely_active' : userResponse.activity_level;

  const dailyCalorieTarget = userResponse.daily_calorie_budget || 0;

  const baseUser: User = {
    id: userResponse.id,
    name: fullName,
    age: userResponse.age,
    height: {
      feet: feet,
      inches: inches,
    },
    weight: userResponse.starting_weight_lb || 0,
    gender: userResponse.gender,
    activityLevel,
    targetWeight: userResponse.goal_weight_lb || 0,
    targetDate: userResponse.goal_weight_date ? new Date(userResponse.goal_weight_date) : new Date(),
    dailyCalorieTarget,
    dailyDeficitTarget: 0,
  };

  const dailyExpenditure = calculateDailyExpenditure(baseUser);
  const dailyDeficitTarget =
    dailyCalorieTarget > 0 && Number.isFinite(dailyExpenditure)
      ? Math.max(0, dailyExpenditure - dailyCalorieTarget)
      : 0;

  return {
    ...baseUser,
    dailyDeficitTarget,
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
  private authToken: string | null = null;
  private isRedirectingToSignIn = false;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    // Ensure refreshed tabs can make authenticated requests immediately, even
    // before React effects run and call `setAuthToken`.
    this.authToken = readTokenFromStorage();
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.authToken) {
      this.authToken = readTokenFromStorage();
    }
    const url = `${this.baseUrl}${endpoint}`;
    const method = (options.method ?? 'GET').toString().toUpperCase();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };
    if (this.authToken) {
      (headers as any).Authorization = `Bearer ${this.authToken}`;
    }
    let response: Response;
    try {
      response = await fetch(url, {
        headers,
        mode: 'cors',
        credentials: 'omit',
        ...options,
      });
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('We couldn’t reach the server. Check your internet connection and try again.');
      }
      throw error;
    }

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      let errorData: any = null;
      if (responseText) {
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = null;
        }
      }

      if (response.status === 401) {
        const detail = typeof errorData?.detail === 'string' ? errorData.detail : responseText;
        this.handleUnauthorized(detail);
        const detailStr = typeof detail === 'string' ? detail : '';
        throw new Error(/token expired|expired/i.test(detailStr) ? 'Your session expired. Please sign in again.' : 'Please sign in again to continue.');
      }

      if (response.status === 404) {
        const detail = typeof errorData?.detail === 'string' ? errorData.detail : '';
        const combinedDetail = `${detail} ${responseText}`.trim();
        if (/user not found/i.test(combinedDetail)) {
          this.handleUserNotFound();
          throw new UserNotFoundError();
        }
        // Special-case 404 for endpoints that might not exist yet in dev (e.g., weight logs)
        try {
          // Peek at method and endpoint to detect list endpoints we control
          const isGet = method === 'GET';
          const looksLikeWeightLogs = endpoint.includes('/weight-logs') || endpoint.includes('/weight_logs');
          if (isGet && looksLikeWeightLogs) {
            return ([] as unknown) as T;
          }
        } catch {}
        throw new Error('We couldn’t find that. Please try again.');
      }
      
      if (response.status === 422) {
        const formatFieldLabel = (loc: unknown): string | null => {
          if (!Array.isArray(loc)) return null;
          const parts = loc.filter((part) => typeof part === 'string') as string[];
          const leaf = parts[parts.length - 1];
          if (!leaf) return null;
          const map: Record<string, string> = {
            daily_calorie_budget: 'daily calorie budget',
            email: 'email',
            password: 'password',
            first_name: 'first name',
            last_name: 'last name',
            age: 'age',
            gender: 'gender',
            activity_level: 'activity level',
            height_in: 'height',
            starting_weight_lb: 'starting weight',
            goal_weight_lb: 'goal weight',
            goal_weight_date: 'goal date',
            user_description: 'description',
            estimated_calories: 'calories',
            protein_g: 'protein',
            carbs_g: 'carbs',
            fat_g: 'fat',
            meal_type: 'meal type',
            name: 'name',
            calories: 'calories',
            time: 'time',
            date: 'date',
          };
          return map[leaf] || null;
        };

        const detailList = Array.isArray(errorData?.detail) ? (errorData.detail as any[]) : [];
        const messages = detailList
          .map((item) => {
            const field = formatFieldLabel(item?.loc);
            if (!field) return null;
            if (item?.type === 'int_from_float' && Array.isArray(item?.loc) && item.loc.includes('daily_calorie_budget')) {
              return 'Daily calorie budget needs to be a whole number. We’ll round it for you.';
            }
            if (item?.type === 'missing') return `Please enter your ${field}.`;
            return `Please check your ${field}.`;
          })
          .filter((m): m is string => Boolean(m));

        if (messages.length) {
          throw new Error(Array.from(new Set(messages)).slice(0, 3).join(' '));
        }

        throw new Error('Some details need a second look. Please check your entries and try again.');
      }

      if (response.status === 413) {
        throw new Error(
          endpoint.includes('/chat')
            ? 'That message is too large. Try shortening it or using a smaller photo.'
            : 'That request is too large. Please shorten your input and try again.'
        );
      }

      if (response.status === 429) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      }

      if (response.status >= 500) {
        throw new Error('We’re having trouble on our side. Please try again in a moment.');
      }

      const action =
        endpoint.includes('/chat')
          ? 'get a reply'
          : method === 'GET'
            ? 'load that'
            : method === 'DELETE'
              ? 'delete that'
              : 'save that';
      throw new Error(`We couldn’t ${action}. Please try again.`);
    }

    // Many DELETE endpoints return `204 No Content`; attempting to parse JSON would throw.
    if (response.status === 204 || response.status === 205) {
      return (undefined as unknown) as T;
    }

    // Parse response body safely (handles empty bodies and avoids `Unexpected end of JSON input`).
    const responseText = await response.text().catch(() => '');
    if (!responseText) {
      return (undefined as unknown) as T;
    }
    try {
      return JSON.parse(responseText) as T;
    } catch {
      throw new Error('We couldn’t read the server response. Please try again.');
    }
  }

  private handleUserNotFound() {
    authService.logout();
    this.setAuthToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('setupComplete');
    if (typeof window !== 'undefined') {
      const base = process.env.PUBLIC_URL || '';
      window.location.assign(`${base}/signin`);
    }
  }

  private handleUnauthorized(detail: unknown) {
    if (this.isRedirectingToSignIn) return;
    this.isRedirectingToSignIn = true;

    authService.logout();
    this.setAuthToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('setupComplete');

    if (typeof window === 'undefined') return;

    const detailStr = typeof detail === 'string' ? detail : '';
    const reason = /token expired|expired/i.test(detailStr) ? 'expired' : 'unauthorized';

    const base = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
    let next = '/';
    try {
      const pathname = window.location.pathname || '/';
      const search = window.location.search || '';
      const hash = window.location.hash || '';
      const basePrefix = base ? `${base}/` : '';
      let relPathname = pathname;
      if (base && pathname === base) relPathname = '/';
      else if (basePrefix && pathname.startsWith(basePrefix)) relPathname = pathname.slice(base.length) || '/';
      if (!relPathname.startsWith('/')) relPathname = `/${relPathname}`;
      next = `${relPathname}${search}${hash}` || '/';
      if (next.startsWith('/signin')) next = '/';
    } catch {
      next = '/';
    }

    const qs = new URLSearchParams();
    qs.set('reason', reason);
    qs.set('next', next);
    window.location.assign(`${base}/signin?${qs.toString()}`);
  }

  // User endpoints
  async createUser(userData: CreateUserRequest): Promise<UserResponse> {
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

  // Meal log list endpoint (date range)
  async getMealLogs(params: { userId: string | number; start?: Date; end?: Date }): Promise<MealLogResponse[]> {
    const qs = new URLSearchParams();
    qs.set('user_id', String(params.userId));
    if (params.start) qs.set('start', toIsoDate(params.start));
    if (params.end) qs.set('end', toIsoDate(params.end));
    return this.request<MealLogResponse[]>(`/meal-logs/?${qs.toString()}`);
  }

  async createMealLog(payload: CreateMealLogRequest): Promise<MealLogResponse> {
    return this.request<MealLogResponse>('/meal-logs/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateMealLog(logId: string, payload: UpdateMealLogRequest): Promise<MealLogResponse> {
    return this.request<MealLogResponse>(`/meal-logs/${logId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteMealLog(logId: string): Promise<void> {
    await this.request(`/meal-logs/${logId}`, { method: 'DELETE' });
  }

  // Planned meal endpoints
  async getPlannedMeals(params: { userId: string; start?: Date; end?: Date }): Promise<PlannedMealResponse[]> {
    const qs = new URLSearchParams();
    qs.set('user_id', String(params.userId));
    if (params.start) qs.set('start', toIsoDate(params.start));
    if (params.end) qs.set('end', toIsoDate(params.end));
    return this.request<PlannedMealResponse[]>(`/planned-meals/?${qs.toString()}`);
  }

  async createPlannedMeal(payload: CreatePlannedMealRequest): Promise<PlannedMealResponse> {
    return this.request<PlannedMealResponse>('/planned-meals/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updatePlannedMeal(mealId: string, payload: UpdatePlannedMealRequest): Promise<PlannedMealResponse> {
    return this.request<PlannedMealResponse>(`/planned-meals/${mealId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deletePlannedMeal(mealId: string): Promise<void> {
    await this.request(`/planned-meals/${mealId}`, { method: 'DELETE' });
  }

  // Activity log endpoints
  async getActivityLogs(params: { userId: string; start?: Date; end?: Date }): Promise<ActivityLogResponse[]> {
    const qs = new URLSearchParams();
    qs.set('user_id', String(params.userId));
    if (params.start) qs.set('start', toIsoDate(params.start));
    if (params.end) qs.set('end', toIsoDate(params.end));
    return this.request<ActivityLogResponse[]>(`/activity-logs/?${qs.toString()}`);
  }

  async createActivityLog(payload: CreateActivityLogRequest): Promise<ActivityLogResponse> {
    return this.request<ActivityLogResponse>('/activity-logs/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateActivityLog(activityId: string, payload: UpdateActivityLogRequest): Promise<ActivityLogResponse> {
    return this.request<ActivityLogResponse>(`/activity-logs/${activityId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteActivityLog(activityId: string): Promise<void> {
    await this.request(`/activity-logs/${activityId}`, { method: 'DELETE' });
  }

  // Chat endpoint (LLM-backed)
  async chat(payload: ChatRequest): Promise<ChatResponse> {
    return this.request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

// Export singleton instance
export const apiService = new ApiService(); 
