'use client'

import { useEffect, useState } from 'react'
import { Scale } from 'lucide-react'
import HealthCardShell from './HealthCardShell'
import type { HealthLog } from '@/types'

interface WeightCardProps {
  log: HealthLog | null
  previousWeight: number | null
  onChange: (fields: Partial<HealthLog>) => void
}

export default function WeightCard({ log, previousWeight, onChange }: WeightCardProps) {
  const [weight, setWeight] = useState(log?.weight?.toString() ?? '')

  function report(value: string) {
    const n = Number(value)
    if (value && !Number.isNaN(n)) onChange({ weight: n })
  }

  useEffect(() => {
    report(weight)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function update(value: string) {
    setWeight(value)
    report(value)
  }

  const delta = log?.weight != null && previousWeight != null ? Math.round((log.weight - previousWeight) * 10) / 10 : null

  return (
    <HealthCardShell icon={<Scale size={16} className="text-primary" />} title="Peso" filled={log?.weight != null}>
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        value={weight}
        onChange={(e) => update(e.target.value)}
        placeholder="kg"
        className="w-full rounded-lg px-2 py-2 text-sm"
      />
      {delta !== null && (
        <p className={`mt-2 text-xs font-semibold ${delta > 0 ? 'text-warning' : delta < 0 ? 'text-primary' : 'text-white/50'}`}>
          {delta > 0 ? '↑' : delta < 0 ? '↓' : '='} {Math.abs(delta)}kg vs último registro
        </p>
      )}
    </HealthCardShell>
  )
}
