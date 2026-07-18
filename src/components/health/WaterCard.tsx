'use client'

import { useEffect, useState } from 'react'
import { Droplet } from 'lucide-react'
import HealthCardShell from './HealthCardShell'
import { formatWaterMl, WATER_QUICK_ADD } from '@/lib/health'
import type { HealthLog } from '@/types'

interface WaterCardProps {
  log: HealthLog | null
  goalMl: number
  onChange: (fields: Partial<HealthLog>) => void
}

export default function WaterCard({ log, goalMl, onChange }: WaterCardProps) {
  const [current, setCurrent] = useState(log?.water_ml ?? 0)

  useEffect(() => {
    onChange({ water_ml: current })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function add(amount: number) {
    const next = current + amount
    setCurrent(next)
    onChange({ water_ml: next })
  }

  const pct = Math.min(100, Math.round((current / goalMl) * 100))
  const barColor = pct < 40 ? '#ef4444' : pct < 80 ? '#f59e0b' : 'rgb(var(--color-primary))'

  return (
    <HealthCardShell icon={<Droplet size={16} className="text-primary" />} title="Água" filled={(log?.water_ml ?? 0) > 0}>
      <p className="text-lg font-bold">
        {formatWaterMl(current)} <span className="text-sm font-normal text-white/40">/ {formatWaterMl(goalMl)}</span>
      </p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      <div className="mt-3 flex gap-2">
        {WATER_QUICK_ADD.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => add(amount)}
            className="flex-1 rounded-lg border border-border py-1.5 text-xs font-semibold text-white/80"
          >
            +{amount}ml
          </button>
        ))}
      </div>
    </HealthCardShell>
  )
}
