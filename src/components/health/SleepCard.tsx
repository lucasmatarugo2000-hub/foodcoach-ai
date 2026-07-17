'use client'

import { useState } from 'react'
import { Moon, Star } from 'lucide-react'
import HealthCardShell from './HealthCardShell'
import SaveButton from './SaveButton'
import { computeSleepHours, formatSleepHours } from '@/lib/health'
import type { HealthLog } from '@/types'

interface SleepCardProps {
  log: HealthLog | null
  onSave: (fields: Partial<HealthLog>) => Promise<boolean | undefined>
}

export default function SleepCard({ log, onSave }: SleepCardProps) {
  const [start, setStart] = useState(log?.sleep_start?.slice(0, 5) ?? '')
  const [end, setEnd] = useState(log?.sleep_end?.slice(0, 5) ?? '')
  const [quality, setQuality] = useState(log?.sleep_quality ?? 0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const filled = log?.sleep_hours !== null && log?.sleep_hours !== undefined

  async function commit() {
    const fields: Partial<HealthLog> = {}
    if (start && end) {
      fields.sleep_start = start
      fields.sleep_end = end
      fields.sleep_hours = computeSleepHours(start, end)
    }
    if (quality > 0) fields.sleep_quality = quality
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
    <HealthCardShell icon={<Moon size={16} className="text-primary" />} title="Sono" filled={filled}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[11px] text-white/50">Dormiu</label>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full rounded-lg px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-white/50">Acordou</label>
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full rounded-lg px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setQuality(n)} aria-label={`Qualidade ${n}`}>
            <Star size={18} className={quality >= n ? 'fill-primary text-primary' : 'text-border'} />
          </button>
        ))}
      </div>

      {filled && <p className="mt-2 text-xs text-white/60">{formatSleepHours(log?.sleep_hours)} de sono</p>}
      <SaveButton onClick={commit} saving={saving} saved={saved} />
    </HealthCardShell>
  )
}
