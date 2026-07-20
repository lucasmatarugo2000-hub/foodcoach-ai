export type Goal = 'lose_weight' | 'gain_muscle' | 'maintenance' | 'reeducation'
export type CoachingStyle = 'direct' | 'gentle'
export type Gender = 'male' | 'female' | 'other'
export type MealType = 'cafe_da_manha' | 'lanche_manha' | 'almoco' | 'lanche_tarde' | 'jantar' | 'ceia'
export type DietStatus = 'on_track' | 'close' | 'diverged' | 'no_diet'
export type CoachMessageType = 'comment' | 'question' | 'pattern_insight' | 'substitution' | 'system'
export type CoachSender = 'kai' | 'user'
export type KaiState = 'idle' | 'talking' | 'thinking'
export type UserRole = 'client' | 'nutritionist'

export interface UserProfile {
  id: string
  goal: Goal | null
  current_weight: number | null
  target_weight: number | null
  daily_calories_goal: number | null
  coaching_style: CoachingStyle
  onboarding_completed: boolean
  role: UserRole
  water_goal_ml: number
  gender: Gender | null
  birth_date: string | null
  created_at: string
}

export interface DietFood {
  name: string
  quantity: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface DietMeal {
  meal_type: MealType
  time_reference: string
  foods: DietFood[]
  total_calories: number
}

export interface DietMealsJson {
  meals: DietMeal[]
  daily_total_calories: number
  observations: string
}

export interface DietPlan {
  id: string
  user_id: string
  raw_text: string | null
  meals_json: DietMealsJson
  created_at: string
  is_active: boolean
  label: string | null
  started_at: string | null
}

export interface DietComparison {
  prescribed_meal: string
  status: DietStatus
  calories_diff: number
  notes: string
}

export interface Meal {
  id: string
  user_id: string
  photo_url: string | null
  food_name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  meal_type: MealType | null
  eaten_at: string
  confirmed: boolean
  diet_comparison: DietComparison | null
}

export interface CoachMessage {
  id: string
  user_id: string
  meal_id: string | null
  message: string
  type: CoachMessageType
  sender: CoachSender
  role: 'user' | 'assistant'
  created_at: string
}

export interface AnalyzeMealResult {
  food_name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  portion: string
  confidence: 'high' | 'medium' | 'low'
}

export interface ReadDietResult {
  meals: DietMeal[]
  daily_total_calories: number
  observations: string
  error?: 'not_a_diet'
}

export interface Substitution {
  name: string
  quantity: string
  calories: number
  reason: string
}

export interface SuggestSubstitutionResult {
  substitutions: Substitution[]
}

// v2.0 — nutritionist area ---------------------------------------------------

export interface Nutritionist {
  id: string
  user_id: string
  nome: string
  crn: string | null
  clinic_name: string | null
  created_at: string
}

export type ClientLinkStatus = 'active' | 'inactive'

export interface ClientNutritionist {
  id: string
  client_id: string
  nutritionist_id: string
  status: ClientLinkStatus
  created_at: string
}

export type RecommendationType = 'recipe' | 'substitution' | 'tip' | 'orientation'

export interface Recommendation {
  id: string
  nutritionist_id: string
  client_id: string | null
  type: RecommendationType
  title: string
  content: string
  created_at: string
}

export interface Bioimpedance {
  id: string
  user_id: string
  date: string
  weight: number | null
  body_fat_pct: number | null
  muscle_mass: number | null
  bone_mass: number | null
  water_pct: number | null
  visceral_fat: number | null
  bmr: number | null
  bmi: number | null
  raw_text: string | null
  photo_url: string | null
  created_at: string
}

export interface ReadBioimpedanceResult {
  date: string | null
  weight: number | null
  body_fat_pct: number | null
  muscle_mass: number | null
  bone_mass: number | null
  water_pct: number | null
  visceral_fat: number | null
  bmr: number | null
  bmi: number | null
  raw_text: string | null
  error?: 'not_bioimpedance'
}

export interface ClientSummary {
  client_id: string
  email: string
  profile: UserProfile | null
  last_meal_at: string | null
  adherence_pct: number | null
  linked_at: string
}

// Health Hub -------------------------------------------------------------

export type DataSource = 'manual' | 'apple_health' | 'google_fit' | 'chat'

export interface HealthLog {
  id: string
  user_id: string
  date: string
  sleep_start: string | null
  sleep_end: string | null
  sleep_hours: number | null
  sleep_quality: number | null
  water_ml: number
  weight: number | null
  mood: number | null
  energy: number | null
  symptoms: string[] | null
  workout_type: string | null
  workout_duration: number | null
  workout_calories: number | null
  steps: number | null
  notes: string | null
  data_source: DataSource
  created_at: string
}

export interface ExtractedHealthData {
  sleep_start: string | null
  sleep_end: string | null
  sleep_hours: number | null
  sleep_quality: number | null
  water_ml: number | null
  weight: number | null
  mood: number | null
  energy: number | null
  workout_type: string | null
  workout_duration: number | null
  workout_calories: number | null
  steps: number | null
  symptoms: string[] | null
  period_started: boolean | null
}

export interface ExtractHealthDataResult {
  extracted: boolean
  success?: boolean
  data?: HealthLog
  saved?: HealthLog
  message?: string
  savedFields?: string[]
  error?: { message: string; code?: string; details?: string | null; hint?: string | null }
}

// Ciclo menstrual ---------------------------------------------------------

export type CyclePhase = 'menstrual' | 'folicular' | 'ovulatoria' | 'lutea'

export interface MenstrualCycle {
  id: string
  user_id: string
  cycle_start: string
  cycle_length: number
  period_length: number
  symptoms: string[] | null
  notes: string | null
  created_at: string
}
