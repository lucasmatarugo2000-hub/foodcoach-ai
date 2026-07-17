import type { CyclePhase, MenstrualCycle } from '@/types'

export interface CycleStatus {
  phase: CyclePhase
  cycleDay: number
  cycleLength: number
  periodLength: number
  daysUntilNextPeriod: number
}

export const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual: 'Menstruação',
  folicular: 'Folicular',
  ovulatoria: 'Ovulação',
  lutea: 'Lútea',
}

/** Cycle day/phase derived from the most recent cycle_start, wrapping around cycle_length for cycles that were never re-logged. */
export function computeCycleStatus(cycle: MenstrualCycle, today: Date = new Date()): CycleStatus {
  const start = new Date(`${cycle.cycle_start}T00:00:00`)
  const todayMidnight = new Date(`${today.toISOString().slice(0, 10)}T00:00:00`)
  const diffDays = Math.round((todayMidnight.getTime() - start.getTime()) / 86400000)
  const cycleLength = cycle.cycle_length || 28
  const periodLength = cycle.period_length || 5

  const cycleDayIndex = ((diffDays % cycleLength) + cycleLength) % cycleLength
  const cycleDay = cycleDayIndex + 1

  let phase: CyclePhase
  if (cycleDay <= periodLength) phase = 'menstrual'
  else if (cycleDay <= 13) phase = 'folicular'
  else if (cycleDay <= 16) phase = 'ovulatoria'
  else phase = 'lutea'

  const daysUntilNextPeriod = cycleLength - cycleDay + 1

  return { phase, cycleDay, cycleLength, periodLength, daysUntilNextPeriod }
}

export const CYCLE_SYMPTOM_OPTIONS = ['Cólica', 'Inchaço', 'Cansaço', 'Irritabilidade', 'Ansiedade', 'Desejo por doces'] as const
