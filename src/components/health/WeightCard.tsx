'use client'

import { useState } from 'react'
import { Scale } from 'lucide-react'
import HealthCardShell from './HealthCardShell'
import type { HealthLog } from '@/types'

interface WeightCardProps {
  log: HealthLog | null
  previousWeight: number | null
  onSave: (fields: Partial<HealthLog>) => Promise<boolean | undefined>
}

export default function WeightCard({ log, previousWeight, onSave }: WeightCardProps) {
  const [weight, setWeight] = useState(log?.weight?.toString() ?? '')

  async function commit() {
    const n = Number(weight)
    if (!weight || Number.isNaN(n)) return
    await onSave({ weight: n })
  }

  const delta = log?.weight != null && previousWeight != null ? Math.round((log.weight - previousWeight) * 10) / 10 : null

  return (
    <HealthCardShell icon={<Scale size={16} className="text-primary" />} title="Peso" filled={log?.weight != null}>
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={commit}
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
