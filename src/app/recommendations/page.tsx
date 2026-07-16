'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import RecommendationCard from '@/components/RecommendationCard'
import BottomNav from '@/components/BottomNav'
import ThemeToggle from '@/components/ThemeToggle'
import type { Recommendation, RecommendationType } from '@/types'

const TYPE_FILTERS: { value: RecommendationType | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'recipe', label: 'Receitas' },
  { value: 'substitution', label: 'Substituições' },
  { value: 'tip', label: 'Dicas' },
  { value: 'orientation', label: 'Orientações' },
]

export default function RecommendationsPage() {
  const supabase = createClient()
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<RecommendationType | 'all'>('all')

  useEffect(() => {
    async function load() {
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
        .eq('client_id', user.id)
        .order('created_at', { ascending: false })
        .returns<Recommendation[]>()
      setRecommendations(data ?? [])
      setLoading(false)
    }
    load()
  }, [supabase])

  const filtered =
    typeFilter === 'all' ? recommendations : recommendations.filter((r) => r.type === typeFilter)

  return (
    <div className="min-h-screen px-4 pb-28 pt-6">
      <ThemeToggle className="fixed right-4 top-4 z-50" />
      <h1 className="mb-1 text-xl font-bold">Recomendações</h1>
      <p className="mb-5 text-xs text-white/50">Dicas e orientações do seu nutricionista.</p>

      {/* Type filter pills */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {TYPE_FILTERS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTypeFilter(t.value)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              typeFilter === t.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-white/60'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-white/50">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-white/40">
            {recommendations.length === 0
              ? 'Seu nutricionista ainda não enviou recomendações.'
              : 'Nenhuma recomendação nesta categoria.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((rec) => (
            <RecommendationCard key={rec.id} recommendation={rec} />
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  )
}
