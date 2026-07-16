import { formatDateFull } from '@/lib/format'
import type { Recommendation, RecommendationType } from '@/types'

const TYPE_META: Record<RecommendationType, { label: string; color: string }> = {
  recipe: { label: 'Receita', color: '#00d4aa' },
  substitution: { label: 'Substituição', color: '#38bdf8' },
  tip: { label: 'Dica', color: '#eab308' },
  orientation: { label: 'Orientação', color: '#a78bfa' },
}

export default function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const meta = TYPE_META[recommendation.type]

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-md shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: `${meta.color}26`, color: meta.color }}
        >
          {meta.label}
        </span>
        <span className="text-[11px] text-white/40">{formatDateFull(recommendation.created_at)}</span>
      </div>
      <h3 className="mb-1 text-sm font-semibold">{recommendation.title}</h3>
      <p className="whitespace-pre-wrap text-sm text-white/70">{recommendation.content}</p>
    </div>
  )
}
