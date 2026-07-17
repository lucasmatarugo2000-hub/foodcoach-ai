export const WORKOUT_TYPES = [
  { value: 'cardio', label: 'Cardio' },
  { value: 'musculacao', label: 'Musculação' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'caminhada', label: 'Caminhada' },
  { value: 'outro', label: 'Outro' },
] as const

export const SYMPTOM_OPTIONS = ['Inchaço', 'Cansaço', 'Dor de cabeça', 'Irritabilidade', 'Boa disposição', 'Outros'] as const

export const DEFAULT_STEPS_GOAL = 10000
export const DEFAULT_WATER_GOAL_ML = 2000
export const WATER_QUICK_ADD = [200, 300, 500] as const

export function formatSleepHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '—'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

export function formatWaterMl(ml: number): string {
  if (ml >= 1000) {
    const liters = ml / 1000
    return `${Number.isInteger(liters) ? liters : liters.toFixed(1)}L`
  }
  return `${ml}ml`
}

/** Hours between two "HH:MM" times, assuming the sleep crossed midnight if end <= start. */
export function computeSleepHours(start: string, end: string): number | null {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if (sh === undefined || sm === undefined || eh === undefined || em === undefined) return null
  if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) return null

  const startMinutes = sh * 60 + sm
  let endMinutes = eh * 60 + em
  if (endMinutes <= startMinutes) endMinutes += 24 * 60

  return Math.round(((endMinutes - startMinutes) / 60) * 100) / 100
}

export function workoutTypeLabel(type: string | null | undefined): string {
  if (!type) return ''
  return WORKOUT_TYPES.find((w) => w.value === type)?.label ?? type
}
