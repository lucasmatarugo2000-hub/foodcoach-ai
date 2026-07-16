'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLinkedClients, isStale } from '@/lib/nutri'
import ClientListCard from '@/components/nutri/ClientListCard'
import AddClientModal from '@/components/nutri/AddClientModal'

export default function NutriDashboardPage() {
  const supabase = createClient()
  const { clients, loading, refresh } = useLinkedClients()
  const [nutriName, setNutriName] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('nutritionists')
        .select('nome')
        .eq('user_id', user.id)
        .maybeSingle<{ nome: string }>()
      setNutriName(data?.nome ?? null)
    }
    load()
  }, [supabase])

  const activeThisWeek = useMemo(() => clients.filter((c) => c.last_meal_at !== null).length, [clients])
  const alerts = useMemo(() => clients.filter((c) => isStale(c.last_meal_at)), [clients])

  return (
    <div className="min-h-screen px-4 pb-6 pt-6 md:px-8">
      <div className="mb-6 flex items-center justify-between md:hidden">
        <div>
          <div className="text-lg font-bold text-primary">FoodCoach AI</div>
          <div className="text-xs text-white/50">{nutriName ?? 'Nutricionista'}</div>
        </div>
      </div>

      <h1 className="mb-4 text-xl font-bold">Dashboard</h1>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <div className="text-2xl font-bold">{clients.length}</div>
          <div className="text-[11px] text-white/50">Clientes</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <div className="text-2xl font-bold text-primary">{activeThisWeek}</div>
          <div className="text-[11px] text-white/50">Ativos na semana</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <div className="text-2xl font-bold text-warning">{alerts.length}</div>
          <div className="text-[11px] text-white/50">Alertas</div>
        </div>
      </div>

      <button
        onClick={() => setShowAddModal(true)}
        className="mb-6 w-full rounded-xl bg-primary py-3 font-semibold text-black md:w-auto md:px-6"
      >
        + Adicionar cliente
      </button>

      {alerts.length > 0 && (
        <div className="mb-6 rounded-2xl border border-warning/30 bg-warning/10 p-4">
          <h2 className="mb-1 text-sm font-semibold text-warning">Sem registro há 3+ dias</h2>
          <p className="text-xs text-white/60">
            {alerts.length} cliente{alerts.length > 1 ? 's' : ''} sem registrar refeições recentemente.
          </p>
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold text-white/70">Seus clientes</h2>
      {loading ? (
        <p className="text-sm text-white/50">Carregando...</p>
      ) : clients.length === 0 ? (
        <p className="text-sm text-white/40">Você ainda não tem clientes vinculados.</p>
      ) : (
        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3">
          {clients.map((client) => (
            <ClientListCard key={client.client_id} client={client} />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddClientModal onClose={() => setShowAddModal(false)} onAdded={refresh} />
      )}
    </div>
  )
}
