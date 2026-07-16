import type { Substitution } from '@/types'

export default function SubstitutionCard({ substitutions }: { substitutions: Substitution[] }) {
  return (
    <div className="flex flex-col gap-2">
      {substitutions.map((s, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{s.name}</span>
            <span className="text-xs text-primary">{s.calories} kcal</span>
          </div>
          <p className="text-xs text-white/50">{s.quantity}</p>
          <p className="mt-1 text-xs text-white/60">{s.reason}</p>
        </div>
      ))}
    </div>
  )
}
