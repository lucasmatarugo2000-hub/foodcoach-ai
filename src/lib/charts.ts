import type { Bioimpedance, Meal } from '@/types'

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function shortDayLabel(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export interface DailyCalories {
  date: string
  label: string
  calories: number
}

/** Total calories per day for the last `days` days (oldest first), including empty days. */
export function caloriesByDay(meals: Meal[], days: number, endDate: Date = new Date()): DailyCalories[] {
  const totals = new Map<string, number>()
  for (const meal of meals) {
    const key = dateKey(new Date(meal.eaten_at))
    totals.set(key, (totals.get(key) ?? 0) + meal.calories)
  }

  const result: DailyCalories[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endDate)
    d.setDate(d.getDate() - i)
    const key = dateKey(d)
    result.push({ date: key, label: shortDayLabel(d), calories: Math.round(totals.get(key) ?? 0) })
  }
  return result
}

export interface WeekdayCalories {
  day: string
  calories: number
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Total calories per weekday for the last 7 days (oldest first). */
export function caloriesByWeekday(meals: Meal[], endDate: Date = new Date()): WeekdayCalories[] {
  const daily = caloriesByDay(meals, 7, endDate)
  return daily.map((d) => ({ day: WEEKDAY_LABELS[new Date(d.date).getUTCDay()] ?? d.label, calories: d.calories }))
}

export interface MacroAverages {
  protein: number
  carbs: number
  fat: number
}

/** Average macro grams per day, over the meals passed in (assumed to be within one window). */
export function macroAverages(meals: Meal[]): MacroAverages {
  if (meals.length === 0) return { protein: 0, carbs: 0, fat: 0 }
  const days = new Set(meals.map((m) => dateKey(new Date(m.eaten_at)))).size || 1
  const totals = meals.reduce(
    (acc, m) => ({ protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat }),
    { protein: 0, carbs: 0, fat: 0 }
  )
  return {
    protein: Math.round(totals.protein / days),
    carbs: Math.round(totals.carbs / days),
    fat: Math.round(totals.fat / days),
  }
}

/** % of meals marked "on_track" against the prescribed diet, or null if no diet comparisons exist. */
export function adherencePct(meals: Meal[]): number | null {
  const withComparison = meals.filter((m) => m.diet_comparison !== null)
  if (withComparison.length === 0) return null
  const onTrack = withComparison.filter((m) => m.diet_comparison?.status === 'on_track').length
  return Math.round((onTrack / withComparison.length) * 100)
}

export interface BioimpedancePoint {
  date: string
  label: string
  weight: number | null
  body_fat_pct: number | null
  muscle_mass: number | null
}

export function bioimpedanceSeries(records: Bioimpedance[]): BioimpedancePoint[] {
  return records
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((r) => ({
      date: r.date,
      label: shortDayLabel(new Date(`${r.date}T00:00:00`)),
      weight: r.weight,
      body_fat_pct: r.body_fat_pct,
      muscle_mass: r.muscle_mass,
    }))
}
