'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from '@/components/ThemeToggle'
import type { Nutritionist } from '@/types'

export default function NutriProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [nutri, setNutri] = useState<Nutritionist | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      setEmail(user.email ?? '')
      const { data } = await supabase
        .from('nutritionists')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle<Nutritionist>()
      setNutri(data)
      setLoading(false)
    }
    load()
  }, [supabase])

  async function save() {
    if (!nutri) return
    setSaving(true)
    setSaved(false)
    const { error } = await supabase
      .from('nutritionists')
      .update({ nome: nutri.nome, crn: nutri.crn, clinic_name: nutri.clinic_name })
      .eq('id', nutri.id)
    setSaving(false)
    if (!error) setSaved(true)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-white/50">Carregando...</div>
  }

  if (!nutri) {
    return <div className="flex min-h-screen items-center justify-center text-white/50">Perfil não encontrado.</div>
  }

  return (
    <div className="min-h-screen px-4 pb-6 pt-6 md:max-w-lg md:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Perfil</h1>
          <p className="text-sm text-white/50">{email}</p>
        </div>
        <ThemeToggle className="md:hidden" />
      </div>

      <label className="mb-1 block text-xs text-white/60">Nome completo</label>
      <input
        value={nutri.nome}
        onChange={(e) => setNutri({ ...nutri, nome: e.target.value })}
        className="mb-4 w-full rounded-xl px-4 py-3 outline-none focus:border-primary"
      />

      <label className="mb-1 block text-xs text-white/60">CRN</label>
      <input
        value={nutri.crn ?? ''}
        onChange={(e) => setNutri({ ...nutri, crn: e.target.value })}
        className="mb-4 w-full rounded-xl px-4 py-3 outline-none focus:border-primary"
      />

      <label className="mb-1 block text-xs text-white/60">Nome da clínica</label>
      <input
        value={nutri.clinic_name ?? ''}
        onChange={(e) => setNutri({ ...nutri, clinic_name: e.target.value })}
        className="mb-6 w-full rounded-xl px-4 py-3 outline-none focus:border-primary"
      />

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-xl bg-primary py-3 font-semibold text-black disabled:opacity-50"
      >
        {saving ? 'Salvando...' : saved ? 'Salvo ✓' : 'Salvar alterações'}
      </button>

      <button
        onClick={() => setShowLogoutModal(true)}
        className="mt-3 w-full rounded-xl border border-danger py-3 font-semibold text-danger"
      >
        Sair da conta
      </button>

      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-xs rounded-2xl border border-border bg-card p-5">
            <h3 className="mb-2 text-base font-semibold">Sair da conta?</h3>
            <p className="mb-4 text-sm text-white/60">Você precisará entrar novamente para continuar.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-white/80"
              >
                Cancelar
              </button>
              <button onClick={logout} className="flex-1 rounded-xl bg-danger py-2.5 text-sm font-semibold text-white">
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
