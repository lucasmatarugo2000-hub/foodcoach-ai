'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateFull } from '@/lib/format'
import DietFoodsEditor from './DietFoodsEditor'
import type { DietMealsJson, DietPlan } from '@/types'

interface DietCardProps {
  diet: DietPlan
  onChanged: () => void | Promise<void>
}

export default function DietCard({ diet, onChanged }: DietCardProps) {
  const supabase = createClient()
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState<DietMealsJson>(diet.meals_json)
  const [dirty, setDirty] = useState(false)
  const [label, setLabel] = useState(diet.label ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [settingActive, setSettingActive] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function saveLabel() {
    const trimmed = label.trim()
    if (trimmed === (diet.label ?? '')) return
    await supabase.from('diet_plans').update({ label: trimmed || null }).eq('id', diet.id)
    await onChanged()
  }

  async function saveFoods() {
    setSaving(true)
    setSaved(false)
    const { error } = await supabase.from('diet_plans').update({ meals_json: draft }).eq('id', diet.id)
    setSaving(false)
    if (!error) {
      setSaved(true)
      setDirty(false)
      await onChanged()
    }
  }

  async function setActive() {
    setSettingActive(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('diet_plans').update({ is_active: false }).eq('user_id', user.id).eq('is_active', true)
      await supabase.from('diet_plans').update({ is_active: true }).eq('id', diet.id)
    }
    setSettingActive(false)
    await onChanged()
  }

  async function confirmDelete() {
    setDeleting(true)
    await supabase.from('diet_plans').delete().eq('id', diet.id)
    setDeleting(false)
    await onChanged()
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={saveLabel}
            placeholder="Nome da dieta"
            className="w-full truncate rounded-lg border-none bg-transparent px-0 py-0.5 text-sm font-semibold outline-none focus:underline"
          />
          <p className="mt-0.5 text-xs text-white/50">Cadastrada em {formatDateFull(diet.created_at)}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            diet.is_active ? 'bg-primary/15 text-primary' : 'bg-border text-white/50'
          }`}
        >
          {diet.is_active ? 'Ativa' : 'Inativa'}
        </span>
      </div>

      <p className="mt-3 text-sm">
        <span className="text-white/60">Meta diária: </span>
        <span className="font-semibold text-primary">{diet.meals_json.daily_total_calories} kcal</span>
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-white/80"
        >
          {expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
        </button>
        {!diet.is_active && (
          <button
            onClick={setActive}
            disabled={settingActive}
            className="rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
          >
            {settingActive ? 'Definindo...' : 'Definir como ativa'}
          </button>
        )}
        <button
          onClick={() => setConfirmingDelete(true)}
          className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-semibold text-danger"
        >
          Remover
        </button>
      </div>

      {confirmingDelete && (
        <div className="mt-3 rounded-xl border border-danger/30 bg-danger/10 p-3">
          <p className="text-sm text-danger">Tem certeza que deseja remover esta dieta?</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setConfirmingDelete(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-white/80"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {deleting ? 'Removendo...' : 'Remover'}
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="mt-4 border-t border-border pt-4">
          <DietFoodsEditor
            diet={draft}
            onChange={(next) => {
              setDraft(next)
              setDirty(true)
              setSaved(false)
            }}
          />
          <button
            onClick={saveFoods}
            disabled={saving || !dirty}
            className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          >
            {saving ? 'Salvando...' : saved ? 'Alterações salvas' : 'Salvar alterações'}
          </button>
        </div>
      )}
    </div>
  )
}
