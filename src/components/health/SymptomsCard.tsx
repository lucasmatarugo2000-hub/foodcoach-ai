'use client'

import { useState } from 'react'
import { Activity } from 'lucide-react'
import HealthCardShell from './HealthCardShell'
import SaveButton from './SaveButton'
import { SYMPTOM_OPTIONS } from '@/lib/health'
import type { HealthLog } from '@/types'

interface SymptomsCardProps {
  log: HealthLog | null
  onSave: (fields: Partial<HealthLog>) => Promise<boolean | undefined>
}

export default function SymptomsCard({ log, onSave }: SymptomsCardProps) {
  const [selected, setSelected] = useState<string[]>(log?.symptoms ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function toggle(symptom: string) {
    setSelected((prev) => (prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]))
  }

  async function commit() {
    setSaving(true)
    const ok = await onSave({ symptoms: selected })
    setSaving(false)
    if (ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
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
      <SaveButton onClick={commit} saving={saving} saved={saved} />
    </HealthCardShell>
  )
}
