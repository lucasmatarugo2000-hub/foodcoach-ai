'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_WATER_GOAL_ML } from '@/lib/health'
import BottomNav from '@/components/BottomNav'
import ThemeToggle from '@/components/ThemeToggle'
import SleepCard from '@/components/health/SleepCard'
import WaterCard from '@/components/health/WaterCard'
import WeightCard from '@/components/health/WeightCard'
import MoodEnergyCard from '@/components/health/MoodEnergyCard'
import WorkoutCard from '@/components/health/WorkoutCard'
import StepsCard from '@/components/health/StepsCard'
import SymptomsCard from '@/components/health/SymptomsCard'
import type { HealthLog, UserProfile } from '@/types'

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatHeaderDate(d: Date): string {
  if (dateKey(d) === dateKey(new Date())) return 'Hoje'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

export default function HealthPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [log, setLog] = useState<HealthLog | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [previousWeight, setPreviousWeight] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
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
    setLoading(false)
  }, [supabase, selectedDate])

  useEffect(() => {
    load()
  }, [load])

  function changeDay(delta: number) {
    setSelectedDate((d) => {
      const next = new Date(d)
      next.setDate(next.getDate() + delta)
      return next
    })
  }

  async function upsertField(fields: Partial<HealthLog>): Promise<boolean | undefined> {
    if (!userId) return
    const key = dateKey(selectedDate)
    const { data, error } = await supabase
      .from('health_logs')
      .upsert({ user_id: userId, date: key, data_source: 'manual', ...fields }, { onConflict: 'user_id,date' })
      .select()
      .single<HealthLog>()
    if (!error && data) {
      setLog(data)
      return true
    }
    console.error('health_logs upsert error', error)
    return false
  }

  const isToday = dateKey(selectedDate) >= dateKey(new Date())

  return (
    <div className="min-h-screen px-4 pb-28 pt-16">
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
          <SleepCard log={log} onSave={upsertField} />
          <WaterCard log={log} goalMl={profile?.water_goal_ml ?? DEFAULT_WATER_GOAL_ML} onSave={upsertField} />
          <WeightCard log={log} previousWeight={previousWeight} onSave={upsertField} />
          <MoodEnergyCard log={log} onSave={upsertField} />
          <WorkoutCard log={log} onSave={upsertField} />
          <StepsCard log={log} onSave={upsertField} />
          <SymptomsCard log={log} onSave={upsertField} />
        </div>
      )}

      <BottomNav />
    </div>
  )
}
