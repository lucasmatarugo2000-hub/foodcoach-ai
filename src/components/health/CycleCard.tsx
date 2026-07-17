'use client'

import { useState } from 'react'
import { Moon } from 'lucide-react'
import HealthCardShell from './HealthCardShell'
import { computeCycleStatus, CYCLE_SYMPTOM_OPTIONS, PHASE_LABELS } from '@/lib/cycle'
import type { MenstrualCycle } from '@/types'

export interface NewCycleFields {
  cycle_start: string
  cycle_length: number
  period_length: number
  symptoms: string[]
}

interface CycleCardProps {
  cycle: MenstrualCycle | null
  onRegister: (fields: NewCycleFields) => Promise<boolean | undefined>
}

export default function CycleCard({ cycle, onRegister }: CycleCardProps) {
  const [showForm, setShowForm] = useState(false)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [cycleLength, setCycleLength] = useState('28')
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const status = cycle ? computeCycleStatus(cycle) : null

  function toggleSymptom(s: string) {
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  async function submit() {
    setSaving(true)
    const ok = await onRegister({
      cycle_start: startDate,
      cycle_length: Number(cycleLength) || 28,
      period_length: 5,
      symptoms,
    })
    setSaving(false)
    if (ok) {
      setShowForm(false)
      setSymptoms([])
    }
  }

  return (
    <HealthCardShell icon={<Moon size={16} className="text-primary" />} title="Ciclo Menstrual" filled={cycle !== null}>
      {status ? (
        <div className="mb-3">
          <p className="text-lg font-bold">{PHASE_LABELS[status.phase]}</p>
          <p className="text-xs text-white/50">
            Dia {status.cycleDay} de {status.cycleLength} · Próximo período em {Math.max(status.daysUntilNextPeriod, 0)} dias
          </p>
        </div>
      ) : (
        <p className="mb-3 text-xs text-white/50">Nenhum ciclo registrado ainda.</p>
      )}

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full rounded-lg border border-primary/40 py-2 text-xs font-semibold text-primary"
        >
          Registrar início do período
        </button>
      ) : (
        <div className="space-y-2">
          <label className="block text-xs text-white/60">Data de início</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg px-2 py-2 text-sm"
          />
          <label className="block text-xs text-white/60">Duração estimada do ciclo (dias)</label>
          <input
            type="number"
            value={cycleLength}
            onChange={(e) => setCycleLength(e.target.value)}
            className="w-full rounded-lg px-2 py-2 text-sm"
          />
          <label className="block text-xs text-white/60">Sintomas</label>
          <div className="flex flex-wrap gap-1.5">
            {CYCLE_SYMPTOM_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSymptom(s)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  symptoms.includes(s) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-white/70'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 rounded-lg border border-border py-2 text-xs font-semibold text-white/70"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="flex-1 rounded-lg bg-primary py-2 text-xs font-semibold text-black disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </HealthCardShell>
  )
}
