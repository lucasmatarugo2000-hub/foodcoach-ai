'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_WATER_GOAL_ML } from '@/lib/health'
import { requireSession } from '@/lib/requireSession'
import BottomNav from '@/components/BottomNav'
import ThemeToggle from '@/components/ThemeToggle'
import SleepCard from '@/components/health/SleepCard'
import WaterCard from '@/components/health/WaterCard'
import WeightCard from '@/components/health/WeightCard'
import MoodEnergyCard from '@/components/health/MoodEnergyCard'
import WorkoutCard from '@/components/health/WorkoutCard'
import StepsCard from '@/components/health/StepsCard'
import SymptomsCard from '@/components/health/SymptomsCard'
import CycleCard, { type NewCycleFields } from '@/components/health/CycleCard'
import type { HealthLog, MenstrualCycle, UserProfile } from '@/types'

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatHeaderDate(d: Date): string {
  if (dateKey(d) === dateKey(new Date())) return 'Hoje'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

export default function HealthPage() {
  const router = useRouter()
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [log, setLog] = useState<HealthLog | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [previousWeight, setPreviousWeight] = useState<number | null>(null)
  const [latestCycle, setLatestCycle] = useState<MenstrualCycle | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<Partial<HealthLog>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setPending({})
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    setUserId(user.id)
    const key = dateKey(selectedDate)

    const [{ data: logData }, { data: profileData }, { data: prevWeightData }] = await Promise.all([
      supabase.from('health_logs').select('*').eq('user_id', user.id).eq('date', key).maybeSingle<HealthLog>(),
      supabase.from('users_profile').select('*').eq('id', user.id).maybeSingle<UserProfile>(),
      supabase
        .from('health_logs')
        .select('weight, date')
        .eq('user_id', user.id)
        .not('weight', 'is', null)
        .lt('date', key)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle<{ weight: number; date: string }>(),
    ])

    setLog(logData ?? null)
    setProfile(profileData ?? null)
    setPreviousWeight(prevWeightData?.weight ?? null)

    if (profileData?.gender === 'female') {
      const { data: cycleData } = await supabase
        .from('menstrual_cycles')
        .select('*')
        .eq('user_id', user.id)
        .order('cycle_start', { ascending: false })
        .limit(1)
        .maybeSingle<MenstrualCycle>()
      setLatestCycle(cycleData ?? null)
    } else {
      setLatestCycle(null)
    }

    setLoading(false)
  }, [supabase, selectedDate])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 30000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    function onFocus() {
      load(true)
      router.refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load, router])

  function changeDay(delta: number) {
    setSelectedDate((d) => {
      const next = new Date(d)
      next.setDate(next.getDate() + delta)
      return next
    })
  }

  function updatePending(fields: Partial<HealthLog>) {
    setPending((prev) => ({ ...prev, ...fields }))
  }

  async function saveAll() {
    if (!userId || Object.keys(pending).length === 0) return
    setSaveError(null)

    const session = await requireSession(supabase)
    if (!session) {
      router.push('/login')
      return
    }
    if (session.user.id !== userId) {
      console.error('saveAll: session user_id mismatch', { sessionUserId: session.user.id, userId })
    }

    setSaving(true)
    const key = dateKey(selectedDate)
    const payload = { user_id: session.user.id, date: key, data_source: 'manual', ...pending }

    for (const [field, value] of Object.entries(pending)) {
      console.log(`Salvando campo "${field}":`, value)
    }
    console.log('Salvando health_logs (upsert completo):', payload)

    const { data, error } = await supabase
      .from('health_logs')
      .upsert(payload, { onConflict: 'user_id,date' })
      .select()
      .single<HealthLog>()
    setSaving(false)
    if (!error && data) {
      console.log('health_logs upsert bem-sucedido:', data)
      setLog(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
      return
    }
    console.error('health_logs upsert error', error)
    setSaveError(
      error
        ? `Erro ao salvar: ${error.message}${error.code ? ` (código ${error.code})` : ''}`
        : 'Erro ao salvar: nenhum dado retornado pelo Supabase.'
    )
  }

  async function registerCycle(fields: NewCycleFields): Promise<boolean | undefined> {
    if (!userId) return
    const { data, error } = await supabase
      .from('menstrual_cycles')
      .insert({ user_id: userId, ...fields })
      .select()
      .single<MenstrualCycle>()
    if (!error && data) {
      router.refresh()
      setLatestCycle(data)
      return true
    }
    console.error('menstrual_cycles insert error', error)
    return false
  }

  const isToday = dateKey(selectedDate) >= dateKey(new Date())

  return (
    <div className="min-h-screen px-4 pb-48 pt-16">
      <ThemeToggle className="fixed right-4 top-4 z-50" />

      <h1 className="mb-3 text-xl font-bold">Minha Saúde</h1>

      <div className="mb-5 flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
        <button
          type="button"
          onClick={() => changeDay(-1)}
          className="rounded-lg p-1.5 text-white/70 hover:text-primary"
          aria-label="Dia anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold">{formatHeaderDate(selectedDate)}</span>
        <button
          type="button"
          onClick={() => changeDay(1)}
          disabled={isToday}
          className="rounded-lg p-1.5 text-white/70 hover:text-primary disabled:opacity-30"
          aria-label="Próximo dia"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-white/50">Carregando...</p>
      ) : (
        <div key={dateKey(selectedDate)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SleepCard log={log} onChange={updatePending} />
          <WaterCard log={log} goalMl={profile?.water_goal_ml ?? DEFAULT_WATER_GOAL_ML} onChange={updatePending} />
          <WeightCard log={log} previousWeight={previousWeight} onChange={updatePending} />
          <MoodEnergyCard log={log} onChange={updatePending} />
          <WorkoutCard log={log} onChange={updatePending} />
          <StepsCard log={log} onChange={updatePending} />
          <SymptomsCard log={log} onChange={updatePending} />
          {profile?.gender === 'female' && <CycleCard cycle={latestCycle} onRegister={registerCycle} />}
        </div>
      )}

      <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-border bg-background px-4 py-3">
        {saveError && (
          <p className="mx-auto mb-2 max-w-md text-center text-xs text-danger">{saveError}</p>
        )}
        <button
          type="button"
          onClick={saveAll}
          disabled={saving || loading}
          className={`mx-auto block w-full max-w-md rounded-xl py-3 text-sm font-bold transition disabled:opacity-50 ${
            saved ? 'bg-primary/15 text-primary' : 'bg-primary text-black'
          }`}
        >
          {saving ? 'Salvando...' : saved ? '✓ Informações salvas!' : 'Salvar informações do dia'}
        </button>
      </div>

      <BottomNav />
    </div>
  )
}
