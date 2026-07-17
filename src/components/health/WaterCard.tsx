'use client'

import { useState } from 'react'
import { Droplet } from 'lucide-react'
import HealthCardShell from './HealthCardShell'
import SaveButton from './SaveButton'
import { formatWaterMl, WATER_QUICK_ADD } from '@/lib/health'
import type { HealthLog } from '@/types'

interface WaterCardProps {
  log: HealthLog | null
  goalMl: number
  onSave: (fields: Partial<HealthLog>) => Promise<boolean | undefined>
}

export default function WaterCard({ log, goalMl, onSave }: WaterCardProps) {
  const savedMl = log?.water_ml ?? 0
  const [pendingAdd, setPendingAdd] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const current = savedMl + pendingAdd
  const pct = Math.min(100, Math.round((current / goalMl) * 100))
  const barColor = pct < 40 ? '#ef4444' : pct < 80 ? '#f59e0b' : 'rgb(var(--color-primary))'

  async function commit() {
    if (pendingAdd === 0) return
    setSaving(true)
    const ok = await onSave({ water_ml: current })
    setSaving(false)
    if (ok) {
      setPendingAdd(0)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <HealthCardShell icon={<Droplet size={16} className="text-primary" />} title="Água" filled={savedMl > 0}>
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
            onClick={() => setPendingAdd((p) => p + amount)}
            className="flex-1 rounded-lg border border-border py-1.5 text-xs font-semibold text-white/80"
          >
            +{amount}ml
          </button>
        ))}
      </div>
      <SaveButton onClick={commit} saving={saving} saved={saved} disabled={pendingAdd === 0} />
    </HealthCardShell>
  )
}
