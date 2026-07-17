'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { caloriesByDay, bioimpedanceSeries, healthLogsByDay } from '@/lib/charts'
import { CHART_COLORS, chartTooltipStyle } from '@/lib/chartTheme'
import { formatDateFull } from '@/lib/format'
import { DEFAULT_WATER_GOAL_ML } from '@/lib/health'
import BottomNav from '@/components/BottomNav'
import ThemeToggle from '@/components/ThemeToggle'
import type { Bioimpedance, HealthLog, Meal, UserProfile } from '@/types'

export default function ProgressPage() {
  const supabase = createClient()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [meals, setMeals] = useState<Meal[]>([])
  const [bioRecords, setBioRecords] = useState<Bioimpedance[]>([])
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 30)
      const cutoffDate = cutoff.toISOString().slice(0, 10)

      const [{ data: profileData }, { data: mealsData }, { data: bioData }, { data: healthData }] = await Promise.all([
        supabase.from('users_profile').select('*').eq('id', user.id).maybeSingle<UserProfile>(),
        supabase
          .from('meals')
          .select('*')
          .eq('user_id', user.id)
          .gte('eaten_at', cutoff.toISOString())
          .order('eaten_at', { ascending: true })
          .returns<Meal[]>(),
        supabase
          .from('bioimpedance')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: true })
          .returns<Bioimpedance[]>(),
        supabase
          .from('health_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', cutoffDate)
          .order('date', { ascending: true })
          .returns<HealthLog[]>(),
      ])

      setProfile(profileData ?? null)
      setMeals(mealsData ?? [])
      setBioRecords(bioData ?? [])
      setHealthLogs(healthData ?? [])
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [supabase])

  const calorieSeries = caloriesByDay(meals, 30)
  const bioSeries = bioimpedanceSeries(bioRecords)

  const goalCalories = profile?.daily_calories_goal ?? 2000
  const calSeriesWithGoal = calorieSeries.map((d) => ({ ...d, goal: goalCalories }))

  const waterGoal = profile?.water_goal_ml ?? DEFAULT_WATER_GOAL_ML
  const healthDaily = healthLogsByDay(healthLogs, 30)
  const healthDailyWithGoal = healthDaily.map((d) => ({ ...d, water_goal: waterGoal }))
  const sleepMoodScatter = healthDaily
    .filter((d) => d.sleep_hours !== null && d.mood !== null)
    .map((d) => ({ sleep_hours: d.sleep_hours, mood: d.mood, label: d.label }))

  const last7HealthLogs = healthLogs.filter((l) => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 6)
    return l.date >= cutoff.toISOString().slice(0, 10)
  })
  const sleepValues7d = last7HealthLogs.map((l) => l.sleep_hours).filter((v): v is number => v !== null)
  const moodValues7d = last7HealthLogs.map((l) => l.mood).filter((v): v is number => v !== null)
  const avgSleep7d = sleepValues7d.length > 0 ? sleepValues7d.reduce((a, b) => a + b, 0) / sleepValues7d.length : null
  const avgMood7d = moodValues7d.length > 0 ? moodValues7d.reduce((a, b) => a + b, 0) / moodValues7d.length : null

  const latest = bioRecords.length > 0 ? bioRecords[bioRecords.length - 1] : null
  const first = bioRecords.length > 0 ? bioRecords[0] : null

  const weightDelta =
    latest && first && latest.weight !== null && first.weight !== null
      ? +(latest.weight - first.weight).toFixed(1)
      : null

  const fatDelta =
    latest && first && latest.body_fat_pct !== null && first.body_fat_pct !== null
      ? +(latest.body_fat_pct - first.body_fat_pct).toFixed(1)
      : null

  const muscleDelta =
    latest && first && latest.muscle_mass !== null && first.muscle_mass !== null
      ? +(latest.muscle_mass - first.muscle_mass).toFixed(1)
      : null

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-white/50">Carregando...</div>
  }

  return (
    <div className="min-h-screen px-4 pb-28 pt-6">
      <ThemeToggle className="fixed right-4 top-4 z-50" />
      <h1 className="mb-1 text-xl font-bold">Evolução</h1>
      <p className="mb-5 text-xs text-white/50">Acompanhe seu progresso ao longo do tempo.</p>

      {/* Summary cards */}
      {bioRecords.length >= 2 && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <SummaryCard
            label="Peso"
            value={weightDelta !== null ? `${weightDelta > 0 ? '+' : ''}${weightDelta} kg` : '—'}
            sub="vs. 1º registro"
            positive={weightDelta !== null && weightDelta <= 0}
          />
          <SummaryCard
            label="Gordura"
            value={fatDelta !== null ? `${fatDelta > 0 ? '+' : ''}${fatDelta}%` : '—'}
            sub="vs. 1º registro"
            positive={fatDelta !== null && fatDelta <= 0}
          />
          <SummaryCard
            label="Músculo"
            value={muscleDelta !== null ? `${muscleDelta > 0 ? '+' : ''}${muscleDelta} kg` : '—'}
            sub="vs. 1º registro"
            positive={muscleDelta !== null && muscleDelta >= 0}
          />
        </div>
      )}

      {/* Calories chart */}
      <div className="mb-5 rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-white/70">Calorias — últimos 30 dias</h2>
        {meals.length === 0 ? (
          <p className="text-xs text-white/40">Sem registros no período.</p>
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={calSeriesWithGoal} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: CHART_COLORS.neutral }} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.neutral }} width={36} />
                <Tooltip {...chartTooltipStyle} />
                <Bar dataKey="calories" name="Calorias (kcal)" fill={CHART_COLORS.series1} radius={[3, 3, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="goal"
                  name="Meta"
                  stroke={CHART_COLORS.neutral}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Health hub insight + charts */}
      <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/10 p-4">
        <h2 className="mb-1 text-sm font-semibold text-primary">Insight do Kai</h2>
        <p className="text-xs text-white/70">
          {avgSleep7d !== null || avgMood7d !== null ? (
            <>
              Nos últimos 7 dias você dormiu em média {avgSleep7d !== null ? avgSleep7d.toFixed(1) : '—'}h
              {avgMood7d !== null ? ` e seu humor foi ${avgMood7d.toFixed(1)}/5.` : '.'}
            </>
          ) : (
            'Registre seu sono, água, peso e humor no Hub de Saúde para receber insights personalizados aqui.'
          )}
        </p>
      </div>

      {healthLogs.length > 0 && (
        <>
          <div className="mb-5 rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-white/70">Sono — últimos 30 dias</h2>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={healthDaily} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: CHART_COLORS.neutral }} interval={4} />
                  <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.neutral }} width={30} domain={[0, 12]} />
                  <Tooltip {...chartTooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="sleep_hours"
                    name="Sono (h)"
                    stroke={CHART_COLORS.series2}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mb-5 rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-white/70">Hidratação vs. meta — últimos 30 dias</h2>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={healthDailyWithGoal} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: CHART_COLORS.neutral }} interval={4} />
                  <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.neutral }} width={36} />
                  <Tooltip {...chartTooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="water_ml"
                    name="Água (ml)"
                    stroke={CHART_COLORS.series3}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="water_goal"
                    name="Meta"
                    stroke={CHART_COLORS.neutral}
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mb-5 rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-white/70">Peso e tendência — últimos 30 dias</h2>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={healthDaily} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: CHART_COLORS.neutral }} interval={4} />
                  <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.neutral }} width={36} domain={['auto', 'auto']} />
                  <Tooltip {...chartTooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    name="Peso (kg)"
                    stroke={CHART_COLORS.series1}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="weight_trend"
                    name="Tendência"
                    stroke={CHART_COLORS.neutral}
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mb-5 rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-white/70">Passos — últimos 30 dias</h2>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={healthDaily} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: CHART_COLORS.neutral }} interval={4} />
                  <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.neutral }} width={36} />
                  <Tooltip {...chartTooltipStyle} />
                  <Bar dataKey="steps" name="Passos" fill={CHART_COLORS.series4} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {sleepMoodScatter.length > 0 && (
            <div className="mb-5 rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold text-white/70">Sono x Humor</h2>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="sleep_hours"
                      name="Sono (h)"
                      tick={{ fontSize: 10, fill: CHART_COLORS.neutral }}
                      domain={[0, 12]}
                    />
                    <YAxis
                      type="number"
                      dataKey="mood"
                      name="Humor"
                      tick={{ fontSize: 10, fill: CHART_COLORS.neutral }}
                      width={30}
                      domain={[1, 5]}
                    />
                    <ZAxis range={[60, 60]} />
                    <Tooltip {...chartTooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter data={sleepMoodScatter} fill={CHART_COLORS.series2} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {/* Bioimpedance charts */}
      {bioSeries.length > 0 && (
        <>
          <div className="mb-5 rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-white/70">Peso ao longo do tempo</h2>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bioSeries} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART_COLORS.neutral }} />
                  <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.neutral }} width={36} domain={['auto', 'auto']} />
                  <Tooltip {...chartTooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    name="Peso (kg)"
                    stroke={CHART_COLORS.series1}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mb-5 rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-white/70">Composição corporal</h2>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bioSeries} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART_COLORS.neutral }} />
                  <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.neutral }} width={36} />
                  <Tooltip {...chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="body_fat_pct"
                    name="% Gordura"
                    stroke={CHART_COLORS.series4}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="muscle_mass"
                    name="Músculo (kg)"
                    stroke={CHART_COLORS.series2}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Latest bioimpedance snapshot */}
      {latest && (
        <div className="mb-5 rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold text-white/70">
            Último registro — {formatDateFull(`${latest.date}T00:00:00`)}
          </h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
            {latest.weight !== null && <span>Peso: {latest.weight} kg</span>}
            {latest.body_fat_pct !== null && <span>Gordura: {latest.body_fat_pct}%</span>}
            {latest.muscle_mass !== null && <span>Músculo: {latest.muscle_mass} kg</span>}
            {latest.bone_mass !== null && <span>Massa óssea: {latest.bone_mass} kg</span>}
            {latest.water_pct !== null && <span>Água: {latest.water_pct}%</span>}
            {latest.visceral_fat !== null && <span>Gordura visceral: {latest.visceral_fat}</span>}
            {latest.bmi !== null && <span>IMC: {latest.bmi}</span>}
            {latest.bmr !== null && <span>TMB: {latest.bmr} kcal</span>}
          </div>
        </div>
      )}

      {bioRecords.length === 0 && (
        <div className="mb-5 rounded-2xl border border-border bg-card p-4 text-center">
          <p className="mb-3 text-sm text-white/50">Você ainda não tem registros de bioimpedância.</p>
          <Link href="/bioimpedance" className="text-sm font-semibold text-primary">
            Adicionar agora →
          </Link>
        </div>
      )}

      <Link
        href="/history"
        className="block w-full rounded-xl border border-border py-3 text-center text-sm font-semibold text-white/70"
      >
        Ver histórico completo de refeições
      </Link>

      <BottomNav />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string
  value: string
  sub: string
  positive: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <p className="mb-0.5 text-xs text-white/50">{label}</p>
      <p className={`text-base font-bold ${positive ? 'text-primary' : 'text-danger'}`}>{value}</p>
      <p className="text-[10px] text-white/30">{sub}</p>
    </div>
  )
}
