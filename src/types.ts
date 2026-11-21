export type TabId =
  | 'home'
  | 'tasks'
  | 'diet'
  | 'workout'
  | 'gifts'
  | 'progress'
  | 'settings';

export type TaskCategory = 'work' | 'wellness' | 'personal' | 'errands';
export type TaskPriority = 'high' | 'medium' | 'low';
export type RecurrenceRule = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface PlannerTask {
  id: string;
  ownerId: string;
  title: string;
  notes: string;
  category: TaskCategory;
  priority: TaskPriority;
  orderIndex: number;
  completed: boolean;
  completedAt?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime: string; // HH:mm or ''
  reminderOffsetMinutes: number;
  recurrence: RecurrenceRule;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type DietEntryType = 'meal' | 'activity' | 'hydration';
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'movement' | 'hydration';
export type ActivityIntensity = 'gentle' | 'moderate' | 'vigorous';

export interface DietActivityLog {
  id: string;
  ownerId: string;
  date: string; // YYYY-MM-DD
  entryType: DietEntryType;
  mealSlot: MealSlot;
  title: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatsGrams: number;
  durationMinutes: number;
  waterGlasses?: number;
  intensity: ActivityIntensity;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  sets: number;
  repsOrDuration: string;
  restSeconds: number;
  formCue: string;
  completed: boolean;
}

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';

export interface WorkoutPlan {
  id: string;
  ownerId: string;
  title: string;
  goal: string;
  fitnessLevel: FitnessLevel;
  durationMinutes: number;
  equipment: string;
  rationale: string;
  exercises: WorkoutExercise[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type OccasionType = 'birthday' | 'anniversary' | 'holiday' | 'milestone';

export interface GiftIdea {
  id: string;
  title: string;
  estimatedPrice: number;
  purchased: boolean;
  notes: string;
}

export interface SpecialDay {
  id: string;
  ownerId: string;
  personOrEvent: string;
  occasionType: OccasionType;
  date: string; // YYYY-MM-DD
  repeatsYearly: boolean;
  reminderDaysBefore: number;
  customReminderTime: string; // HH:mm
  budget: number;
  giftIdeas: GiftIdea[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type HabitFocusArea = 'productivity' | 'nutrition' | 'movement' | 'recovery';

export interface HabitInsight {
  id: string;
  ownerId: string;
  title: string;
  patternObservation: string;
  suggestedAction: string;
  focusArea: HabitFocusArea;
  adopted: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ThemePreference = 'light' | 'dark' | 'system';
export type TierMode = 'pro' | 'free';

export interface UserSettings {
  ownerId: string;
  theme: ThemePreference;
  tierPreview: TierMode;
  notificationsEnabled: boolean;
  adaptiveRemindersEnabled?: boolean;
  defaultReminderLeadMinutes: number;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatsTarget: number;
  waterTargetGlasses: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  ownerId: string;
  displayName: string;
  email: string;
  provider: 'google' | 'apple' | 'guest';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ReminderNotification {
  id: string;
  taskId?: string;
  source: 'task' | 'special-day' | 'system';
  title: string;
  detail: string;
  timeLabel: string;
  suggestedTime?: string;
  suggestedOffsetMinutes?: number;
  adaptiveReason?: string;
  canOptimize?: boolean;
}

export interface AchievementBadge {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  progressText: string;
}

export const FIELD_LIMITS = {
  ID_REGEX: /^[a-zA-Z0-9_-]{1,128}$/,
  TASK_TITLE_MAX: 200,
  TASK_NOTES_MAX: 1000,
  DIET_TITLE_MAX: 160,
  WORKOUT_TITLE_MAX: 160,
  WORKOUT_GOAL_MAX: 120,
  WORKOUT_EQUIPMENT_MAX: 120,
  WORKOUT_RATIONALE_MAX: 1000,
  SPECIAL_DAY_TITLE_MAX: 160,
  ARRAY_MAX: 25,
} as const;
