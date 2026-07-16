'use client'

import { useMemo, useState } from 'react'
import { useLinkedClients, clientDisplayName } from '@/lib/nutri'
import ClientListCard from '@/components/nutri/ClientListCard'
import AddClientModal from '@/components/nutri/AddClientModal'

export default function NutriClientsPage() {
  const { clients, loading, refresh } = useLinkedClients()
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => clientDisplayName(c.email).toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
  }, [clients, search])

  return (
    <div className="min-h-screen px-4 pb-6 pt-6 md:px-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Clientes</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-black"
        >
          + Adicionar
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar cliente por e-mail..."
        className="mb-6 w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
      />

      {loading ? (
        <p className="text-sm text-white/50">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-white/40">Nenhum cliente encontrado.</p>
      ) : (
        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3">
          {filtered.map((client) => (
            <ClientListCard key={client.client_id} client={client} />
          ))}
        </div>
      )}

      {showAddModal && <AddClientModal onClose={() => setShowAddModal(false)} onAdded={refresh} />}
    </div>
  )
}
