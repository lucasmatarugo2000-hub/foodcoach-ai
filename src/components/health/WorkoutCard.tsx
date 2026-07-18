'use client'

import { useEffect, useState } from 'react'
import { Dumbbell } from 'lucide-react'
import HealthCardShell from './HealthCardShell'
import { WORKOUT_TYPES } from '@/lib/health'
import type { HealthLog } from '@/types'

interface WorkoutCardProps {
  log: HealthLog | null
  onChange: (fields: Partial<HealthLog>) => void
}

export default function WorkoutCard({ log, onChange }: WorkoutCardProps) {
  const [type, setType] = useState<string | null>(log?.workout_type ?? null)
  const [duration, setDuration] = useState(log?.workout_duration?.toString() ?? '')
  const [calories, setCalories] = useState(log?.workout_calories?.toString() ?? '')

  function report(t: string | null, d: string, c: string) {
    const fields: Partial<HealthLog> = {}
    if (t) fields.workout_type = t
    if (d) fields.workout_duration = Number(d) || null
    if (c) fields.workout_calories = Number(c) || null
    onChange(fields)
  }

  useEffect(() => {
    report(type, duration, calories)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateType(t: string) {
    setType(t)
    report(t, duration, calories)
  }
  function updateDuration(v: string) {
    setDuration(v)
    report(type, v, calories)
  }
  function updateCalories(v: string) {
    setCalories(v)
    report(type, duration, v)
  }

  return (
    <HealthCardShell icon={<Dumbbell size={16} className="text-primary" />} title="Treino" filled={Boolean(log?.workout_type)}>
      <div className="mb-2 grid grid-cols-3 gap-1.5">
        {WORKOUT_TYPES.map((w) => (
          <button
            key={w.value}
            type="button"
            onClick={() => updateType(w.value)}
            className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${
              type === w.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-white/70'
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          value={duration}
          onChange={(e) => updateDuration(e.target.value)}
          placeholder="Minutos"
          className="w-full rounded-lg px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          value={calories}
          onChange={(e) => updateCalories(e.target.value)}
          placeholder="Kcal (opc.)"
          className="w-full rounded-lg px-2 py-1.5 text-sm"
        />
      </div>
    </HealthCardShell>
  )
}
