'use client'

import { useState } from 'react'
import { Dumbbell } from 'lucide-react'
import HealthCardShell from './HealthCardShell'
import { WORKOUT_TYPES } from '@/lib/health'
import type { HealthLog } from '@/types'

interface WorkoutCardProps {
  log: HealthLog | null
  onSave: (fields: Partial<HealthLog>) => Promise<boolean | undefined>
}

export default function WorkoutCard({ log, onSave }: WorkoutCardProps) {
  const [duration, setDuration] = useState(log?.workout_duration?.toString() ?? '')
  const [calories, setCalories] = useState(log?.workout_calories?.toString() ?? '')

  async function commitDuration() {
    await onSave({ workout_duration: duration ? Number(duration) || null : null })
  }
  async function commitCalories() {
    await onSave({ workout_calories: calories ? Number(calories) || null : null })
  }

  return (
    <HealthCardShell icon={<Dumbbell size={16} className="text-primary" />} title="Treino" filled={Boolean(log?.workout_type)}>
      <div className="mb-2 grid grid-cols-3 gap-1.5">
        {WORKOUT_TYPES.map((w) => (
          <button
            key={w.value}
            type="button"
            onClick={() => onSave({ workout_type: w.value })}
            className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${
              log?.workout_type === w.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-white/70'
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
          onChange={(e) => setDuration(e.target.value)}
          onBlur={commitDuration}
          placeholder="Minutos"
          className="w-full rounded-lg px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          onBlur={commitCalories}
          placeholder="Kcal (opc.)"
          className="w-full rounded-lg px-2 py-1.5 text-sm"
        />
      </div>
    </HealthCardShell>
  )
}
