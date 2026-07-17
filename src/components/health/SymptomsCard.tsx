'use client'

import { Activity } from 'lucide-react'
import HealthCardShell from './HealthCardShell'
import { SYMPTOM_OPTIONS } from '@/lib/health'
import type { HealthLog } from '@/types'

interface SymptomsCardProps {
  log: HealthLog | null
  onSave: (fields: Partial<HealthLog>) => Promise<boolean | undefined>
}

export default function SymptomsCard({ log, onSave }: SymptomsCardProps) {
  const selected = new Set(log?.symptoms ?? [])

  async function toggle(symptom: string) {
    const next = new Set(selected)
    if (next.has(symptom)) next.delete(symptom)
    else next.add(symptom)
    await onSave({ symptoms: Array.from(next) })
  }

  return (
    <HealthCardShell icon={<Activity size={16} className="text-primary" />} title="Sintomas" filled={selected.size > 0}>
      <div className="flex flex-wrap gap-1.5">
        {SYMPTOM_OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              selected.has(s) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-white/70'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </HealthCardShell>
  )
}
