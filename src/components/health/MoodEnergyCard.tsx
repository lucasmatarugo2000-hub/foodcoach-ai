'use client'

import { useState } from 'react'
import { Smile } from 'lucide-react'
import HealthCardShell from './HealthCardShell'
import SaveButton from './SaveButton'
import type { HealthLog } from '@/types'

// One mouth curve per mood level, 1 (very sad) through 5 (very happy).
const MOOD_MOUTH_PATHS = [
  'M8,15 Q12,10 16,15',
  'M8,14 Q12,11.5 16,14',
  'M8,13 L16,13',
  'M8,12 Q12,15 16,12',
  'M7,11 Q12,17 17,11',
] as const

interface MoodFaceProps {
  level: number
  active: boolean
  onClick: () => void
}

function MoodFace({ level, active, onClick }: MoodFaceProps) {
  const color = active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'
  const mouth = MOOD_MOUTH_PATHS[level - 1] ?? MOOD_MOUTH_PATHS[2]
  return (
    <button type="button" onClick={onClick} aria-label={`Humor ${level}`} className="flex flex-col items-center">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
        <circle cx="9" cy="10" r="1.2" fill={color} />
        <circle cx="15" cy="10" r="1.2" fill={color} />
        <path d={mouth} stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
    </button>
  )
}

interface MoodEnergyCardProps {
  log: HealthLog | null
  onSave: (fields: Partial<HealthLog>) => Promise<boolean | undefined>
}

export default function MoodEnergyCard({ log, onSave }: MoodEnergyCardProps) {
  const [mood, setMood] = useState(log?.mood ?? 0)
  const [energy, setEnergy] = useState(log?.energy ?? 0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function commit() {
    const fields: Partial<HealthLog> = {}
    if (mood > 0) fields.mood = mood
    if (energy > 0) fields.energy = energy
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
    <HealthCardShell
      icon={<Smile size={16} className="text-primary" />}
      title="Humor & Energia"
      filled={log?.mood != null && log?.energy != null}
    >
      <p className="mb-1.5 text-[11px] text-white/50">Humor</p>
      <div className="mb-3 flex justify-between px-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <MoodFace key={n} level={n} active={mood === n} onClick={() => setMood(n)} />
        ))}
      </div>
      <p className="mb-1.5 text-[11px] text-white/50">Energia</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setEnergy(n)}
            aria-label={`Energia ${n}`}
            className="h-2 flex-1 rounded-full transition-colors"
            style={{ backgroundColor: energy >= n ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))' }}
          />
        ))}
      </div>
      <SaveButton onClick={commit} saving={saving} saved={saved} />
    </HealthCardShell>
  )
}
