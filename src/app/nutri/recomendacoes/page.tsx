'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLinkedClients, clientDisplayName } from '@/lib/nutri'
import RecommendationCard from '@/components/RecommendationCard'
import RecommendationModal from '@/components/nutri/RecommendationModal'
import type { Recommendation, RecommendationType } from '@/types'

const TYPE_FILTERS: { value: RecommendationType | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'recipe', label: 'Receitas' },
  { value: 'substitution', label: 'Substituições' },
  { value: 'tip', label: 'Dicas' },
  { value: 'orientation', label: 'Orientações' },
]

export default function NutriRecommendationsPage() {
  const supabase = createClient()
  const { clients } = useLinkedClients()
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<RecommendationType | 'all'>('all')
  const [clientFilter, setClientFilter] = useState<'all' | 'templates' | string>('all')
  const [showNewModal, setShowNewModal] = useState(false)
  const [sendingTemplate, setSendingTemplate] = useState<Recommendation | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('recommendations')
      .select('*')
      .eq('nutritionist_id', user.id)
      .order('created_at', { ascending: false })
      .returns<Recommendation[]>()
    setRecommendations(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    return recommendations.filter((r) => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false
      if (clientFilter === 'templates' && r.client_id !== null) return false
      if (clientFilter !== 'all' && clientFilter !== 'templates' && r.client_id !== clientFilter) return false
      return true
    })
  }, [recommendations, typeFilter, clientFilter])

  return (
    <div className="min-h-screen px-4 pb-6 pt-6 md:px-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Recomendações</h1>
        <button
          onClick={() => setShowNewModal(true)}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-black"
        >
          + Novo template
        </button>
      </div>

      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as RecommendationType | 'all')}
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary sm:w-auto"
        >
          {TYPE_FILTERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary sm:w-auto"
        >
          <option value="all">Todos os clientes</option>
          <option value="templates">Somente templates</option>
          {clients.map((c) => (
            <option key={c.client_id} value={c.client_id}>
              {clientDisplayName(c.email)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-white/50">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-white/40">Nenhuma recomendação encontrada.</p>
      ) : (
        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3">
          {filtered.map((rec) => (
            <div key={rec.id}>
              <RecommendationCard recommendation={rec} />
              {rec.client_id === null && (
                <button
                  onClick={() => setSendingTemplate(rec)}
                  className="mt-2 w-full rounded-xl border border-primary py-2 text-xs font-semibold text-primary"
                >
                  Enviar para clientes
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showNewModal && (
        <RecommendationModal clientId={null} onClose={() => setShowNewModal(false)} onSaved={load} />
      )}

      {sendingTemplate && (
        <SendTemplateModal
          template={sendingTemplate}
          onClose={() => setSendingTemplate(null)}
          onSent={load}
        />
      )}
    </div>
  )
}

function SendTemplateModal({
  template,
  onClose,
  onSent,
}: {
  template: Recommendation
  onClose: () => void
  onSent: () => void
}) {
  const supabase = createClient()
  const { clients } = useLinkedClients()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSend() {
    if (selected.size === 0) return
    setSending(true)
    setError(null)

    const rows = Array.from(selected).map((clientId) => ({
      nutritionist_id: template.nutritionist_id,
      client_id: clientId,
      type: template.type,
      title: template.title,
      content: template.content,
    }))

    const { error: insertError } = await supabase.from('recommendations').insert(rows)
    setSending(false)
    if (insertError) {
      setError('Não foi possível enviar para todos os clientes. Tente novamente.')
      return
    }
    onSent()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-1 text-base font-semibold">Enviar &quot;{template.title}&quot;</h3>
        <p className="mb-4 text-sm text-white/60">Selecione os clientes que devem receber esta recomendação.</p>

        {clients.length === 0 ? (
          <p className="mb-4 text-sm text-white/40">Você ainda não tem clientes vinculados.</p>
        ) : (
          <div className="mb-4 flex max-h-60 flex-col gap-2 overflow-y-auto">
            {clients.map((c) => (
              <label
                key={c.client_id}
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"
              >
                <input type="checkbox" checked={selected.has(c.client_id)} onChange={() => toggle(c.client_id)} />
                {clientDisplayName(c.email)}
              </label>
            ))}
          </div>
        )}

        {error && <p className="mb-3 text-xs text-danger">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-white/80"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={sending || selected.size === 0}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          >
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
