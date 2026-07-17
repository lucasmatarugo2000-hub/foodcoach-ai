'use client'

import { useState } from 'react'
import { Dumbbell } from 'lucide-react'
import HealthCardShell from './HealthCardShell'
import SaveButton from './SaveButton'
import { WORKOUT_TYPES } from '@/lib/health'
import type { HealthLog } from '@/types'

interface WorkoutCardProps {
  log: HealthLog | null
  onSave: (fields: Partial<HealthLog>) => Promise<boolean | undefined>
}

export default function WorkoutCard({ log, onSave }: WorkoutCardProps) {
  const [type, setType] = useState<string | null>(log?.workout_type ?? null)
  const [duration, setDuration] = useState(log?.workout_duration?.toString() ?? '')
  const [calories, setCalories] = useState(log?.workout_calories?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function commit() {
    const fields: Partial<HealthLog> = {}
    if (type) fields.workout_type = type
    if (duration) fields.workout_duration = Number(duration) || null
    if (calories) fields.workout_calories = Number(calories) || null
    if (Object.keys(fields).length === 0) return

    setSaving(true)
    const ok = await onSave(fields)
    setSaving(false)
    if (ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <HealthCardShell icon={<Dumbbell size={16} className="text-primary" />} title="Treino" filled={Boolean(log?.workout_type)}>
      <div className="mb-2 grid grid-cols-3 gap-1.5">
        {WORKOUT_TYPES.map((w) => (
          <button
            key={w.value}
            type="button"
            onClick={() => setType(w.value)}
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
          onChange={(e) => setDuration(e.target.value)}
          placeholder="Minutos"
          className="w-full rounded-lg px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          placeholder="Kcal (opc.)"
          className="w-full rounded-lg px-2 py-1.5 text-sm"
        />
      </div>
      <SaveButton onClick={commit} saving={saving} saved={saved} />
    </HealthCardShell>
  )
}
