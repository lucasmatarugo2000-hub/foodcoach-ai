'use client'

import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import HealthCardShell from './HealthCardShell'
import { SYMPTOM_OPTIONS } from '@/lib/health'
import type { HealthLog } from '@/types'

interface SymptomsCardProps {
  log: HealthLog | null
  onChange: (fields: Partial<HealthLog>) => void
}

export default function SymptomsCard({ log, onChange }: SymptomsCardProps) {
  const [selected, setSelected] = useState<string[]>(log?.symptoms ?? [])

  useEffect(() => {
    onChange({ symptoms: selected })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle(symptom: string) {
    setSelected((prev) => {
      const next = prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
      onChange({ symptoms: next })
      return next
    })
  }

  return (
    <HealthCardShell icon={<Activity size={16} className="text-primary" />} title="Sintomas" filled={selected.length > 0}>
      <div className="flex flex-wrap gap-1.5">
        {SYMPTOM_OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              selected.includes(s) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-white/70'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </HealthCardShell>
  )
}
