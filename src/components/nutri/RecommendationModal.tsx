'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RecommendationType } from '@/types'

const TYPES: { value: RecommendationType; label: string }[] = [
  { value: 'recipe', label: 'Receita' },
  { value: 'substitution', label: 'Substituição' },
  { value: 'tip', label: 'Dica' },
  { value: 'orientation', label: 'Orientação' },
]

interface RecommendationModalProps {
  clientId: string | null
  onClose: () => void
  onSaved: () => void
}

export default function RecommendationModal({ clientId, onClose, onSaved }: RecommendationModalProps) {
  const supabase = createClient()
  const [type, setType] = useState<RecommendationType>('tip')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      setError('Sessão expirada. Faça login novamente.')
      return
    }

    const { error: insertError } = await supabase.from('recommendations').insert({
      nutritionist_id: user.id,
      client_id: clientId,
      type,
      title: title.trim(),
      content: content.trim(),
    })

    setSaving(false)
    if (insertError) {
      setError('Não foi possível salvar a recomendação. Tente novamente.')
      return
    }
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-4 text-base font-semibold">
          {clientId ? 'Nova recomendação' : 'Novo template de recomendação'}
        </h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs text-white/60">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    type === t.value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/60">Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
              placeholder="Ex: Substitua o pão branco"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/60">Conteúdo</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
              placeholder="Descreva a recomendação..."
            />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="mt-1 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-white/80"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !content.trim()}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-black disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
