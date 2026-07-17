'use client'

import { useState } from 'react'
import { Moon, Star } from 'lucide-react'
import HealthCardShell from './HealthCardShell'
import { computeSleepHours, formatSleepHours } from '@/lib/health'
import type { HealthLog } from '@/types'

interface SleepCardProps {
  log: HealthLog | null
  onSave: (fields: Partial<HealthLog>) => Promise<boolean | undefined>
}

export default function SleepCard({ log, onSave }: SleepCardProps) {
  const [start, setStart] = useState(log?.sleep_start?.slice(0, 5) ?? '')
  const [end, setEnd] = useState(log?.sleep_end?.slice(0, 5) ?? '')

  async function commitTimes(newStart: string, newEnd: string) {
    if (!newStart || !newEnd) return
    const hours = computeSleepHours(newStart, newEnd)
    await onSave({ sleep_start: newStart, sleep_end: newEnd, sleep_hours: hours })
  }

  const filled = log?.sleep_hours !== null && log?.sleep_hours !== undefined

  return (
    <HealthCardShell icon={<Moon size={16} className="text-primary" />} title="Sono" filled={filled}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[11px] text-white/50">Dormiu</label>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            onBlur={() => commitTimes(start, end)}
            className="w-full rounded-lg px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-white/50">Acordou</label>
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            onBlur={() => commitTimes(start, end)}
            className="w-full rounded-lg px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onSave({ sleep_quality: n })} aria-label={`Qualidade ${n}`}>
            <Star size={18} className={(log?.sleep_quality ?? 0) >= n ? 'fill-primary text-primary' : 'text-border'} />
          </button>
        ))}
      </div>

      {filled && <p className="mt-2 text-xs text-white/60">{formatSleepHours(log?.sleep_hours)} de sono</p>}
    </HealthCardShell>
  )
}
