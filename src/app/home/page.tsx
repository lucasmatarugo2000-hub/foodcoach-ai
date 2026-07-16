'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import {
  isSameDay,
  mealTypeLabel,
  statusBadge,
  formatTime,
  greetingPrefix,
  greetingEmoji,
  displayNameFromEmail,
} from '@/lib/format'
import { caloriesByWeekday } from '@/lib/charts'
import { CHART_COLORS, chartTooltipStyle } from '@/lib/chartTheme'
import KaiAvatar from '@/components/KaiAvatar'
import BottomNav from '@/components/BottomNav'
import ThemeToggle from '@/components/ThemeToggle'
import RecommendationCard from '@/components/RecommendationCard'
import type { CoachMessage, Meal, Recommendation, UserProfile } from '@/types'

const MOTIVATIONAL_PHRASES = [
  'Um passo de cada vez já é progresso. 🌱',
  'Consistência vale mais que perfeição.',
  'Seu corpo agradece cada escolha boa que você faz hoje.',
  'Você não precisa ser perfeito, só precisa continuar.',
]

export default function HomePage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [name, setName] = useState('')
  const [motivationalPhrase] = useState(
    () => MOTIVATIONAL_PHRASES[Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)] ?? MOTIVATIONAL_PHRASES[0]
  )
  const [todayMeals, setTodayMeals] = useState<Meal[]>([])
  const [weekMeals, setWeekMeals] = useState<Meal[]>([])
  const [lastMessage, setLastMessage] = useState<CoachMessage | null>(null)
  const [latestRec, setLatestRec] = useState<Recommendation | null>(null)
  const [hasDiet, setHasDiet] = useState(false)
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
      setName(displayNameFromEmail(user.email))

      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)

      const [{ data: profileData }, { data: mealsData }, { data: messagesData }, { data: dietData }, { data: recData }] =
        await Promise.all([
          supabase.from('users_profile').select('*').eq('id', user.id).maybeSingle<UserProfile>(),
          supabase
            .from('meals')
            .select('*')
            .eq('user_id', user.id)
            .gte('eaten_at', weekAgo.toISOString())
            .order('eaten_at', { ascending: false })
            .returns<Meal[]>(),
          supabase
            .from('coach_messages')
            .select('*')
            .eq('user_id', user.id)
            .eq('sender', 'kai')
            .order('created_at', { ascending: false })
            .limit(1)
            .returns<CoachMessage[]>(),
          supabase.from('diet_plans').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
          supabase
            .from('recommendations')
            .select('*')
            .eq('client_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .returns<Recommendation[]>(),
        ])

      setProfile(profileData ?? null)
      const today = new Date()
      const all = mealsData ?? []
      setTodayMeals(all.filter((m) => isSameDay(new Date(m.eaten_at), today)))
      setWeekMeals(all)
      setLastMessage(messagesData?.[0] ?? null)
      setLatestRec(recData?.[0] ?? null)
      setHasDiet(!!dietData)
      setLoading(false)
    }
    load()
  }, [supabase])

  const totalCalories = todayMeals.reduce((s, m) => s + m.calories, 0)
  const goalCalories = profile?.daily_calories_goal ?? 2000
  const remaining = Math.max(0, goalCalories - totalCalories)
  const progressPct = Math.min(100, Math.round((totalCalories / goalCalories) * 100))

  const onTrackCount = todayMeals.filter((m) => m.diet_comparison?.status === 'on_track').length
  const adherencePct = todayMeals.length > 0 ? Math.round((onTrackCount / todayMeals.length) * 100) : 0

  const donutData = [
    { name: 'Consumido', value: Math.min(totalCalories, goalCalories) },
    { name: 'Restante', value: remaining },
  ]

  const weeklyData = caloriesByWeekday(weekMeals)

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-white/50">Carregando...</div>
  }

  return (
    <div className="min-h-screen pb-28">
      <ThemeToggle className="fixed right-4 top-4 z-50" />

      {/* Gradient hero header — dark green in dark mode, light green in light mode */}
      <div
        className="relative px-4 pb-20 pt-10"
        style={{ background: 'linear-gradient(180deg, var(--hero-from) 0%, var(--hero-to) 100%)', minHeight: '35vh' }}
      >
        <p className="text-sm text-white/60">
          {greetingPrefix()} {greetingEmoji()}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white">{name || 'bem-vindo(a)'}!</h1>
        <p className="mt-3 max-w-xs text-sm text-white/70">{motivationalPhrase}</p>
      </div>

      <div className="px-4">
        {/* Floating calorie card — overlaps the header */}
        <div className="relative z-10 -mt-14 flex animate-fade-in gap-4 rounded-2xl border border-border bg-card p-4 shadow-2xl shadow-black/40">
          <div className="flex flex-1 flex-col items-center justify-center py-1">
            <div className="h-28 w-28">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius="62%"
                    outerRadius="82%"
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    strokeWidth={0}
                    animationBegin={150}
                    animationDuration={900}
                    animationEasing="ease-out"
                  >
                    <Cell fill={CHART_COLORS.primary} />
                    <Cell fill={CHART_COLORS.grid} />
                  </Pie>
                  <Tooltip {...chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-xs text-white/50">Calorias hoje</p>
            <p className="text-sm font-bold">
              {totalCalories} <span className="font-normal text-white/40">/ {goalCalories}</span>
            </p>
            <p className="text-[10px] text-white/30">{progressPct}% da meta</p>
          </div>

          <div className="flex flex-1 flex-col gap-3">
            {hasDiet ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-border bg-background p-3">
                <p className="text-xs text-white/50">Aderência à dieta</p>
                <p className="mt-1 text-2xl font-bold text-primary">{adherencePct}%</p>
                <p className="text-[10px] text-white/30">{todayMeals.length} refeições hoje</p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-border bg-background p-3">
                <p className="text-xs text-white/50">Restante hoje</p>
                <p className="mt-1 text-2xl font-bold">{remaining}</p>
                <p className="text-[10px] text-white/30">kcal</p>
              </div>
            )}
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-border bg-background p-3">
              <p className="text-xs text-white/50">Refeições</p>
              <p className="mt-1 text-2xl font-bold">{todayMeals.length}</p>
              <p className="text-[10px] text-white/30">hoje</p>
            </div>
          </div>
        </div>

        {/* 2×2 shortcut grid */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <ShortcutCard href="/meal/new" emoji="🍽️" label="Nova refeição" />
          <ShortcutCard href="/progress" emoji="📈" label="Evolução" />
          <ShortcutCard href="/bioimpedance" emoji="⚖️" label="Bioimpedância" />
          <ShortcutCard href="/recommendations" emoji="💡" label="Recomendações" />
        </div>

        {/* Weekly calories bar chart */}
        {weekMeals.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-white/70">Calorias esta semana</h2>
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: CHART_COLORS.neutral }} />
                  <YAxis hide />
                  <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgb(var(--color-border))', opacity: 0.4 }} />
                  <Bar dataKey="calories" name="kcal" fill={CHART_COLORS.series1} radius={[8, 8, 8, 8]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Latest recommendation from nutritionist */}
        {latestRec && (
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/70">Do seu nutricionista</h2>
              <Link href="/recommendations" className="text-xs text-primary">
                Ver todas
              </Link>
            </div>
            <RecommendationCard recommendation={latestRec} />
          </div>
        )}

        {/* Kai message */}
        {lastMessage && (
          <Link href="/coach" className="mt-8 block">
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <KaiAvatar state="idle" size={60} />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-primary">Kai</div>
                <p className="line-clamp-2 text-sm text-white/70">{lastMessage.message}</p>
              </div>
            </div>
          </Link>
        )}

        {/* Today's meals */}
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-white/70">Refeições de hoje</h2>
          {todayMeals.length === 0 ? (
            <p className="text-sm text-white/40">Nenhuma refeição registrada ainda.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {todayMeals.map((meal) => {
                const badge = statusBadge(meal.diet_comparison?.status)
                return (
                  <div key={meal.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-border">
                      {meal.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={meal.photo_url} alt={meal.food_name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg">🍽️</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{meal.food_name}</div>
                      <div className="text-xs text-white/50">
                        {mealTypeLabel(meal.meal_type)} · {formatTime(meal.eaten_at)} · {meal.calories} kcal
                      </div>
                    </div>
                    <span title={badge.label} className="text-lg">
                      {badge.emoji}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

function ShortcutCard({ href, emoji, label }: { href: string; emoji: string; label: string }) {
  return (
    <Link href={href}>
      <div
        className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-border py-6 text-center shadow-md shadow-black/5 transition hover:border-primary/40 hover:shadow-lg"
        style={{ background: 'linear-gradient(160deg, rgb(var(--color-card)) 0%, rgb(var(--color-background)) 100%)' }}
      >
        <span className="text-3xl">{emoji}</span>
        <span className="text-xs font-semibold text-white/70">{label}</span>
      </div>
    </Link>
  )
}
