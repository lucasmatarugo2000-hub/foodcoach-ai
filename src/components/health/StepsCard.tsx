'use client'

import { useEffect, useState } from 'react'
import { Footprints } from 'lucide-react'
import HealthCardShell from './HealthCardShell'
import { DEFAULT_STEPS_GOAL } from '@/lib/health'
import type { HealthLog } from '@/types'

interface StepsCardProps {
  log: HealthLog | null
  onChange: (fields: Partial<HealthLog>) => void
}

export default function StepsCard({ log, onChange }: StepsCardProps) {
  const [steps, setSteps] = useState(log?.steps?.toString() ?? '')

  useEffect(() => {
    onChange({ steps: steps ? Number(steps) || null : null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function update(v: string) {
    setSteps(v)
    onChange({ steps: v ? Number(v) || null : null })
  }

  const value = log?.steps ?? 0
  const pct = Math.min(100, Math.round((value / DEFAULT_STEPS_GOAL) * 100))

  return (
    <HealthCardShell icon={<Footprints size={16} className="text-primary" />} title="Passos" filled={Boolean(log?.steps)}>
      <input
        type="number"
        value={steps}
        onChange={(e) => update(e.target.value)}
        placeholder="0"
        className="w-full rounded-lg px-2 py-2 text-sm"
      />
      <p className="mt-2 text-xs text-white/50">
        {value.toLocaleString('pt-BR')} / {DEFAULT_STEPS_GOAL.toLocaleString('pt-BR')} passos
      </p>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </HealthCardShell>
  )
}
