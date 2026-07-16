'use client'

import Link from 'next/link'
import { formatDateFull } from '@/lib/format'
import { clientDisplayName, isStale } from '@/lib/nutri'
import type { ClientSummary } from '@/types'

export default function ClientListCard({ client }: { client: ClientSummary }) {
  const name = clientDisplayName(client.email)
  const stale = isStale(client.last_meal_at)

  return (
    <Link href={`/nutri/cliente/${client.client_id}`} className="block">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-md shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-lg">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold uppercase text-primary">
          {name.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="truncate text-xs text-white/50">
            {client.last_meal_at ? `Último registro: ${formatDateFull(client.last_meal_at)}` : 'Nenhum registro ainda'}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {client.adherence_pct !== null && (
            <span className="text-xs font-semibold text-primary">{client.adherence_pct}% aderência</span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              stale ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'
            }`}
          >
            {stale ? 'Alerta' : 'Ativo'}
          </span>
        </div>
      </div>
    </Link>
  )
}
