'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AddClientModalProps {
  onClose: () => void
  onAdded: () => void
}

export default function AddClientModal({ onClose, onAdded }: AddClientModalProps) {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return

    setSubmitting(true)
    setNotFound(false)
    setError(null)

    const {
      data: { user: nutritionist },
    } = await supabase.auth.getUser()

    if (!nutritionist) {
      setSubmitting(false)
      setError('Sessão expirada. Faça login novamente.')
      return
    }

    const { data: clientId, error: rpcError } = await supabase.rpc('find_user_id_by_email', {
      lookup_email: trimmed,
    })

    if (rpcError) {
      setSubmitting(false)
      setError('Não foi possível verificar esse e-mail agora. Tente novamente.')
      return
    }

    if (!clientId) {
      setSubmitting(false)
      setNotFound(true)
      return
    }

    const { error: linkError } = await supabase.from('client_nutritionist').upsert(
      { client_id: clientId as string, nutritionist_id: nutritionist.id, status: 'active' },
      { onConflict: 'client_id,nutritionist_id' }
    )

    if (linkError) {
      setSubmitting(false)
      setError('Não foi possível vincular esse cliente. Tente novamente.')
      return
    }

    await supabase.from('coach_messages').insert({
      user_id: clientId as string,
      message: 'Você foi vinculado a um nutricionista. Suas refeições e evolução agora podem ser acompanhadas por ele(a).',
      type: 'system',
      sender: 'kai',
    })

    setSubmitting(false)
    setSuccess(true)
    onAdded()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-1 text-base font-semibold">Adicionar cliente</h3>
        <p className="mb-4 text-sm text-white/60">Digite o e-mail da conta do cliente no FoodCoach AI.</p>

        {success ? (
          <>
            <p className="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
              Cliente vinculado com sucesso!
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-black"
            >
              Fechar
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="cliente@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setNotFound(false)
              }}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
            />

            {notFound && (
              <p className="text-xs text-warning">
                Cliente ainda não tem conta. Envie o link do app para ele se cadastrar.
              </p>
            )}
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
                disabled={submitting || !email.trim()}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-black disabled:opacity-50"
              >
                {submitting ? 'Verificando...' : 'Adicionar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
