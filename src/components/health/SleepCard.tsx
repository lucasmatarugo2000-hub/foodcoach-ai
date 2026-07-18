'use client'

import { useEffect, useState } from 'react'
import { Moon, Star } from 'lucide-react'
import HealthCardShell from './HealthCardShell'
import { computeSleepHours, formatSleepHours } from '@/lib/health'
import type { HealthLog } from '@/types'

interface SleepCardProps {
  log: HealthLog | null
  onChange: (fields: Partial<HealthLog>) => void
}

export default function SleepCard({ log, onChange }: SleepCardProps) {
  const [start, setStart] = useState(log?.sleep_start?.slice(0, 5) ?? '')
  const [end, setEnd] = useState(log?.sleep_end?.slice(0, 5) ?? '')
  const [quality, setQuality] = useState(log?.sleep_quality ?? 0)

  function report(newStart: string, newEnd: string, newQuality: number) {
    const fields: Partial<HealthLog> = {}
    if (newStart && newEnd) {
      fields.sleep_start = newStart
      fields.sleep_end = newEnd
      fields.sleep_hours = computeSleepHours(newStart, newEnd)
    }
    if (newQuality > 0) fields.sleep_quality = newQuality
    onChange(fields)
  }

  useEffect(() => {
    report(start, end, quality)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateStart(v: string) {
    setStart(v)
    report(v, end, quality)
  }
  function updateEnd(v: string) {
    setEnd(v)
    report(start, v, quality)
  }
  function updateQuality(n: number) {
    setQuality(n)
    report(start, end, n)
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
            onChange={(e) => updateStart(e.target.value)}
            className="w-full rounded-lg px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-white/50">Acordou</label>
          <input
            type="time"
            value={end}
            onChange={(e) => updateEnd(e.target.value)}
            className="w-full rounded-lg px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => updateQuality(n)} aria-label={`Qualidade ${n}`}>
            <Star size={18} className={quality >= n ? 'fill-primary text-primary' : 'text-border'} />
          </button>
        ))}
      </div>

      {filled && <p className="mt-2 text-xs text-white/60">{formatSleepHours(log?.sleep_hours)} de sono</p>}
    </HealthCardShell>
  )
}
