'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import ThemeToggle from '@/components/ThemeToggle'
import type { CoachingStyle, Goal, Nutritionist, UserProfile } from '@/types'

const GOALS: { value: Goal; label: string }[] = [
  { value: 'lose_weight', label: 'Emagrecer' },
  { value: 'gain_muscle', label: 'Ganhar massa' },
  { value: 'maintenance', label: 'Manutenção' },
  { value: 'reeducation', label: 'Reeducação alimentar' },
]

const STYLES: { value: CoachingStyle; label: string }[] = [
  { value: 'direct', label: 'Direto' },
  { value: 'gentle', label: 'Acolhedor' },
]

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [linkedNutri, setLinkedNutri] = useState<Nutritionist | null>(null)
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
      const [{ data: profileData }, { data: linkData }] = await Promise.all([
        supabase.from('users_profile').select('*').eq('id', user.id).maybeSingle<UserProfile>(),
        supabase
          .from('client_nutritionist')
          .select('nutritionist_id')
          .eq('client_id', user.id)
          .eq('status', 'active')
          .maybeSingle<{ nutritionist_id: string }>(),
      ])
      setProfile(profileData)
      if (linkData?.nutritionist_id) {
        const { data: nutriData } = await supabase
          .from('nutritionists')
          .select('*')
          .eq('user_id', linkData.nutritionist_id)
          .maybeSingle<Nutritionist>()
        setLinkedNutri(nutriData ?? null)
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  async function save() {
    if (!profile) return
    setSaving(true)
    setSaved(false)
    const { error } = await supabase
      .from('users_profile')
      .update({
        goal: profile.goal,
        current_weight: profile.current_weight,
        target_weight: profile.target_weight,
        daily_calories_goal: profile.daily_calories_goal,
        coaching_style: profile.coaching_style,
      })
      .eq('id', profile.id)
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

  if (!profile) {
    return <div className="flex min-h-screen items-center justify-center text-white/50">Perfil não encontrado.</div>
  }

  return (
    <div className="min-h-screen px-4 pb-28 pt-6">
      <ThemeToggle className="fixed right-4 top-4 z-50" />
      <h1 className="mb-1 text-xl font-bold">Perfil</h1>
      <p className="mb-6 text-sm text-white/50">{email}</p>

      {linkedNutri && (
        <div className="mb-5 rounded-2xl border border-border bg-card p-4">
          <p className="mb-0.5 text-xs text-white/50">Nutricionista vinculado</p>
          <p className="text-sm font-semibold">{linkedNutri.nome}</p>
          {linkedNutri.clinic_name && (
            <p className="text-xs text-white/40">{linkedNutri.clinic_name}</p>
          )}
          {linkedNutri.crn && (
            <p className="text-xs text-white/30">CRN: {linkedNutri.crn}</p>
          )}
        </div>
      )}

      <label className="mb-1 block text-xs text-white/60">Objetivo</label>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {GOALS.map((g) => (
          <button
            key={g.value}
            onClick={() => setProfile({ ...profile, goal: g.value })}
            className={`rounded-xl border p-3 text-left text-sm transition ${
              profile.goal === g.value ? 'border-primary bg-primary/10' : 'border-border bg-card'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <label className="mb-1 block text-xs text-white/60">Peso atual (kg)</label>
      <input
        type="number"
        value={profile.current_weight ?? ''}
        onChange={(e) => setProfile({ ...profile, current_weight: Number(e.target.value) || null })}
        className="mb-4 w-full rounded-xl px-4 py-3 outline-none focus:border-primary"
      />

      <label className="mb-1 block text-xs text-white/60">Peso meta (kg)</label>
      <input
        type="number"
        value={profile.target_weight ?? ''}
        onChange={(e) => setProfile({ ...profile, target_weight: Number(e.target.value) || null })}
        className="mb-4 w-full rounded-xl px-4 py-3 outline-none focus:border-primary"
      />

      <label className="mb-1 block text-xs text-white/60">Meta calórica diária</label>
      <input
        type="number"
        value={profile.daily_calories_goal ?? ''}
        onChange={(e) => setProfile({ ...profile, daily_calories_goal: Number(e.target.value) || null })}
        className="mb-4 w-full rounded-xl px-4 py-3 outline-none focus:border-primary"
      />

      <label className="mb-1 block text-xs text-white/60">Estilo de coaching</label>
      <div className="mb-6 grid grid-cols-2 gap-2">
        {STYLES.map((s) => (
          <button
            key={s.value}
            onClick={() => setProfile({ ...profile, coaching_style: s.value })}
            className={`rounded-xl border p-3 text-sm transition ${
              profile.coaching_style === s.value ? 'border-primary bg-primary/10' : 'border-border bg-card'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-xl bg-primary py-3 font-semibold text-black disabled:opacity-50"
      >
        {saving ? 'Salvando...' : saved ? 'Salvo ✓' : 'Salvar alterações'}
      </button>

      <Link href="/diet" className="mt-3 block">
        <div className="w-full rounded-xl border border-border py-3 text-center font-semibold text-white/80">
          Gerenciar dieta ativa
        </div>
      </Link>

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
              <button
                onClick={logout}
                className="flex-1 rounded-xl bg-danger py-2.5 text-sm font-semibold text-white"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
