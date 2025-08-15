export interface User {
  id: string;
  name: string;
  age: number;
  height: {
    feet: number;
    inches: number;
  };
  weight: number; // in lbs
  gender: 'male' | 'female';
  activityLevel: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
  targetWeight: number; // in lbs
  targetDate: Date;
  dailyCalorieTarget: number;
  dailyDeficitTarget: number;
}

export interface Meal {
  id: string;
  name: string;
  calories: number;
  time: Date;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  description?: string;
}

export interface PlannedMeal extends Meal {
  isPlanned: true;
}

export interface ActualMeal extends Meal {
  isPlanned: false;
  actualCalories?: number;
  notes?: string;
}

export interface Activity {
  id: string;
  name: string;
  caloriesBurned: number;
  duration: number; // in minutes
  time: Date;
  type: 'cardio' | 'strength' | 'flexibility' | 'other';
}

export interface WeightLog {
  id: string;
  weight: number; // in lbs
  date: Date;
  notes?: string;
}

export interface CalorieDeficit {
  date: Date;
  plannedCalories: number;
  actualCalories: number;
  caloriesBurned: number;
  deficit: number;
  cumulativeDeficit: number;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  type: 'meal_log' | 'planning' | 'encouragement' | 'reminder' | 'general';
}

export interface LogEntry {
  id: string;
  date: Date;
  type: 'meal' | 'activity';
  isPlanned: boolean;
  data: PlannedMeal | ActualMeal | Activity;
}

export interface DailyProgress {
  date: Date;
  totalPlanned: number;
  totalActual: number;
  totalBurned: number;
  deficit: number;
  weight?: number;
  meals: (PlannedMeal | ActualMeal)[];
  activities: Activity[];
  logEntries: LogEntry[];
}

export interface WeeklyProgress {
  weekStart: Date;
  totalDeficit: number;
  averageDailyDeficit: number;
  weightChange: number;
  days: DailyProgress[];
} 