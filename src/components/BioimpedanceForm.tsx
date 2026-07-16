'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface BioimpedanceFormValues {
  date: string
  weight: string
  body_fat_pct: string
  muscle_mass: string
  bone_mass: string
  water_pct: string
  visceral_fat: string
  bmr: string
  bmi: string
}

const EMPTY: BioimpedanceFormValues = {
  date: new Date().toISOString().slice(0, 10),
  weight: '',
  body_fat_pct: '',
  muscle_mass: '',
  bone_mass: '',
  water_pct: '',
  visceral_fat: '',
  bmr: '',
  bmi: '',
}

const FIELDS: { key: keyof Omit<BioimpedanceFormValues, 'date'>; label: string; unit: string }[] = [
  { key: 'weight', label: 'Peso', unit: 'kg' },
  { key: 'body_fat_pct', label: '% Gordura', unit: '%' },
  { key: 'muscle_mass', label: 'Massa muscular', unit: 'kg' },
  { key: 'bone_mass', label: 'Massa óssea', unit: 'kg' },
  { key: 'water_pct', label: '% Água', unit: '%' },
  { key: 'visceral_fat', label: 'Gordura visceral', unit: '' },
  { key: 'bmr', label: 'TMB', unit: 'kcal' },
  { key: 'bmi', label: 'IMC', unit: '' },
]

interface BioimpedanceFormProps {
  userId: string
  initial?: Partial<BioimpedanceFormValues>
  rawText?: string | null
  photoDataUrl?: string | null
  submitLabel?: string
  onSaved: () => void
  onCancel?: () => void
}

export default function BioimpedanceForm({
  userId,
  initial,
  rawText = null,
  photoDataUrl = null,
  submitLabel = 'Salvar registro',
  onSaved,
  onCancel,
}: BioimpedanceFormProps) {
  const supabase = createClient()
  const [values, setValues] = useState<BioimpedanceFormValues>({ ...EMPTY, ...initial })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(key: keyof BioimpedanceFormValues, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    let photoUrl: string | null = null
    if (photoDataUrl) {
      try {
        const blob = await (await fetch(photoDataUrl)).blob()
        const path = `${userId}/${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('bioimpedance-photos')
          .upload(path, blob, { contentType: blob.type || 'image/jpeg' })
        if (!uploadError) {
          const { data: pub } = supabase.storage.from('bioimpedance-photos').getPublicUrl(path)
          photoUrl = pub.publicUrl
        }
      } catch {
        photoUrl = null
      }
    }

    const { error: insertError } = await supabase.from('bioimpedance').insert({
      user_id: userId,
      date: values.date,
      weight: values.weight ? Number(values.weight) : null,
      body_fat_pct: values.body_fat_pct ? Number(values.body_fat_pct) : null,
      muscle_mass: values.muscle_mass ? Number(values.muscle_mass) : null,
      bone_mass: values.bone_mass ? Number(values.bone_mass) : null,
      water_pct: values.water_pct ? Number(values.water_pct) : null,
      visceral_fat: values.visceral_fat ? Number(values.visceral_fat) : null,
      bmr: values.bmr ? Number(values.bmr) : null,
      bmi: values.bmi ? Number(values.bmi) : null,
      raw_text: rawText,
      photo_url: photoUrl,
    })

    setSaving(false)
    if (insertError) {
      setError('Não foi possível salvar o registro. Tente novamente.')
      return
    }
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-xs text-white/60">Data</label>
        <input
          type="date"
          required
          value={values.date}
          onChange={(e) => set('date', e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="mb-1 block text-xs text-white/60">
              {f.label} {f.unit && `(${f.unit})`}
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={values[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="mt-1 flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-white/80"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-black disabled:opacity-50"
        >
          {saving ? 'Salvando...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
