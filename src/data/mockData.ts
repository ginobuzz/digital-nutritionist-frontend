import { User, PlannedMeal, ActualMeal, Activity, WeightLog, ChatMessage, DailyProgress } from '../types';

export const mockUser: User = {
  id: '1',
  name: 'Sarah Johnson',
  age: 32,
  height: { feet: 5, inches: 5 }, // 165 cm ≈ 5'5"
  weight: 165, // 75 kg ≈ 165 lbs
  gender: 'female',
  activityLevel: 'moderately_active',
  targetWeight: 143, // 65 kg ≈ 143 lbs
  targetDate: new Date('2024-06-01'),
  dailyCalorieTarget: 1800,
  dailyDeficitTarget: 500
};

export const mockPlannedMeals: PlannedMeal[] = [
  {
    id: '1',
    name: 'Oatmeal with Berries',
    calories: 300,
    time: new Date('2024-01-15T08:00:00'),
    type: 'breakfast',
    description: 'Steel cut oats with mixed berries and almond milk',
    isPlanned: true
  },
  {
    id: '2',
    name: 'Chicken Salad',
    calories: 500,
    time: new Date('2024-01-15T12:00:00'),
    type: 'lunch',
    description: 'Mixed greens with grilled chicken, avocado, and balsamic dressing',
    isPlanned: true
  },
  {
    id: '3',
    name: 'Pasta with Vegetables',
    calories: 600,
    time: new Date('2024-01-15T18:00:00'),
    type: 'dinner',
    description: 'Whole wheat pasta with roasted vegetables and olive oil',
    isPlanned: true
  }
];

export const mockActualMeals: ActualMeal[] = [
  {
    id: '4',
    name: 'Oatmeal with Berries',
    calories: 300,
    time: new Date('2024-01-15T08:30:00'),
    type: 'breakfast',
    description: 'Steel cut oats with mixed berries and almond milk',
    isPlanned: false,
    actualCalories: 320,
    notes: 'Added extra berries'
  },
  {
    id: '5',
    name: 'Burger and Fries',
    calories: 500,
    time: new Date('2024-01-15T12:30:00'),
    type: 'lunch',
    description: 'Cheeseburger with side of fries',
    isPlanned: false,
    actualCalories: 700,
    notes: 'Had to grab lunch on the go'
  }
];

export const mockActivities: Activity[] = [
  {
    id: '1',
    name: 'Morning Run',
    caloriesBurned: 300,
    duration: 30,
    time: new Date('2024-01-15T07:00:00'),
    type: 'cardio'
  },
  {
    id: '2',
    name: 'Yoga Session',
    caloriesBurned: 150,
    duration: 45,
    time: new Date('2024-01-15T17:00:00'),
    type: 'flexibility'
  }
];

export const mockWeightLogs: WeightLog[] = [
  {
    id: '1',
    weight: 165, // 75 kg ≈ 165 lbs
    date: new Date('2024-01-01'),
    notes: 'Starting weight'
  },
  {
    id: '2',
    weight: 163.2, // 74.2 kg ≈ 163.2 lbs
    date: new Date('2024-01-08'),
    notes: 'Week 1 progress'
  },
  {
    id: '3',
    weight: 161.7, // 73.5 kg ≈ 161.7 lbs
    date: new Date('2024-01-15'),
    notes: 'Week 2 progress'
  }
];

export const mockChatMessages: ChatMessage[] = [
  {
    id: '1',
    text: 'Good morning Sarah! 🌅 Ready to log your breakfast?',
    sender: 'ai',
    timestamp: new Date('2024-01-15T08:00:00'),
    type: 'reminder'
  },
  {
    id: '2',
    text: 'I had oatmeal with berries for breakfast',
    sender: 'user',
    timestamp: new Date('2024-01-15T08:30:00'),
    type: 'meal_log'
  },
  {
    id: '3',
    text: 'Great choice! 🥣 I\'ve logged your oatmeal with berries (320 calories). That\'s a healthy start to your day!',
    sender: 'ai',
    timestamp: new Date('2024-01-15T08:31:00'),
    type: 'encouragement'
  },
  {
    id: '4',
    text: 'How did lunch go? Did you have that chicken salad as planned?',
    sender: 'ai',
    timestamp: new Date('2024-01-15T13:00:00'),
    type: 'reminder'
  },
  {
    id: '5',
    text: 'Actually I had a burger and fries instead',
    sender: 'user',
    timestamp: new Date('2024-01-15T13:30:00'),
    type: 'meal_log'
  },
  {
    id: '6',
    text: 'No worries at all! 😊 I\'ve logged your burger and fries (700 calories). You\'re still on track for the week - we can adjust dinner to stay within your daily goal.',
    sender: 'ai',
    timestamp: new Date('2024-01-15T13:31:00'),
    type: 'encouragement'
  }
];

export const mockDailyProgress: DailyProgress = {
  date: new Date('2024-01-15'),
  totalPlanned: 1400,
  totalActual: 1020,
  totalBurned: 450,
  deficit: 350,
  weight: 161.7, // 73.5 kg ≈ 161.7 lbs
  meals: [...mockPlannedMeals, ...mockActualMeals],
  activities: mockActivities,
  logEntries: [
    ...mockPlannedMeals.map(meal => ({
      id: `log-${meal.id}`,
      date: meal.time,
      type: 'meal' as const,
      isPlanned: true,
      data: meal
    })),
    ...mockActualMeals.map(meal => ({
      id: `log-${meal.id}`,
      date: meal.time,
      type: 'meal' as const,
      isPlanned: false,
      data: meal
    })),
    ...mockActivities.map(activity => ({
      id: `log-${activity.id}`,
      date: activity.time,
      type: 'activity' as const,
      isPlanned: false,
      data: activity
    }))
  ]
};

// Mock API functions
export const mockAPI = {
  getUser: (): Promise<User> => Promise.resolve(mockUser),
  getPlannedMeals: (date: Date): Promise<PlannedMeal[]> => Promise.resolve(mockPlannedMeals),
  getActualMeals: (date: Date): Promise<ActualMeal[]> => Promise.resolve(mockActualMeals),
  getActivities: (date: Date): Promise<Activity[]> => Promise.resolve(mockActivities),
  getWeightLogs: (): Promise<WeightLog[]> => Promise.resolve(mockWeightLogs),
  getChatMessages: (): Promise<ChatMessage[]> => Promise.resolve(mockChatMessages),
  getDailyProgress: (date: Date): Promise<DailyProgress> => Promise.resolve(mockDailyProgress),
  
  // Simulate API delays
  delay: (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms))
}; 