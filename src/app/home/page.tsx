'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { UtensilsCrossed, TrendingUp, Scale, MessageCircle, Flame } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isSameDay, mealTypeLabel, statusBadge, formatTime, greetingPrefix, displayNameFromEmail } from '@/lib/format'
import { caloriesByWeekday, deriveMacroTargets, computeStreak } from '@/lib/charts'
import { CHART_COLORS, darkChartTooltipStyle } from '@/lib/chartTheme'
import KaiAvatar from '@/components/KaiAvatar'
import BottomNav from '@/components/BottomNav'
import ThemeToggle from '@/components/ThemeToggle'
import RecommendationCard from '@/components/RecommendationCard'
import type { CoachMessage, Meal, Recommendation, UserProfile } from '@/types'

const MOTIVATIONAL_PHRASES = [
  'Um passo de cada vez já é progresso.',
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
  const [recentMeals, setRecentMeals] = useState<Meal[]>([])
  const [lastMessage, setLastMessage] = useState<CoachMessage | null>(null)
  const [latestRec, setLatestRec] = useState<Recommendation | null>(null)
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

      const since = new Date()
      since.setDate(since.getDate() - 30)

      const [{ data: profileData }, { data: mealsData }, { data: messagesData }, { data: recData }] = await Promise.all([
        supabase.from('users_profile').select('*').eq('id', user.id).maybeSingle<UserProfile>(),
        supabase
          .from('meals')
          .select('*')
          .eq('user_id', user.id)
          .gte('eaten_at', since.toISOString())
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
      setRecentMeals(all)
      setLastMessage(messagesData?.[0] ?? null)
      setLatestRec(recData?.[0] ?? null)
      setLoading(false)
    }
    load()
  }, [supabase])

  const totalCalories = todayMeals.reduce((s, m) => s + m.calories, 0)
  const goalCalories = profile?.daily_calories_goal ?? 2000
  const progressPct = Math.min(100, Math.round((totalCalories / goalCalories) * 100))

  const gaugeColor = progressPct < 70 ? CHART_COLORS.primary : progressPct < 95 ? '#f59e0b' : '#ef4444'

  const macroTargets = useMemo(() => deriveMacroTargets(goalCalories), [goalCalories])
  const macros = [
    {
      label: 'Proteína',
      value: Math.round(todayMeals.reduce((s, m) => s + m.protein, 0)),
      target: macroTargets.protein,
      color: CHART_COLORS.series1,
    },
    {
      label: 'Carbo',
      value: Math.round(todayMeals.reduce((s, m) => s + m.carbs, 0)),
      target: macroTargets.carbs,
      color: CHART_COLORS.series2,
    },
    {
      label: 'Gordura',
      value: Math.round(todayMeals.reduce((s, m) => s + m.fat, 0)),
      target: macroTargets.fat,
      color: CHART_COLORS.accent,
    },
  ]

  const streak = useMemo(() => computeStreak(recentMeals), [recentMeals])

  const weeklyData = useMemo(
    () => caloriesByWeekday(recentMeals).map((d) => ({ ...d, goal: goalCalories })),
    [recentMeals, goalCalories]
  )

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Carregando...</div>
  }

  return (
    <div className="min-h-screen pb-28">
      <ThemeToggle className="fixed right-4 top-4 z-50" />

      <div className="animate-fade-in-up px-4 pb-2 pt-6">
        <span className="gradient-text text-lg font-extrabold tracking-tight">FoodCoach AI</span>
      </div>

      {/* Gradient hero header — primary → secondary */}
      <div
        className="relative px-4 pb-20 pt-4"
        style={{
          background: 'linear-gradient(90deg, rgb(var(--color-primary)) 0%, rgb(var(--color-secondary)) 100%)',
          minHeight: '32vh',
        }}
      >
        <p className="text-sm text-[#ffffff]/80">{greetingPrefix()}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#ffffff]">{name || 'bem-vindo(a)'}</h1>
        <p className="mt-3 max-w-xs text-sm text-[#ffffff]/80">{motivationalPhrase}</p>
      </div>

      <div className="px-4">
        {/* Floating calorie gauge card — overlaps the header */}
        <div className="relative z-10 -mt-14 animate-fade-in-up rounded-2xl border border-border bg-card p-5 shadow-2xl shadow-black/40">
          <div className="relative mx-auto h-40 w-40">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="75%"
                outerRadius="100%"
                data={[{ value: progressPct }]}
                startAngle={225}
                endAngle={-45}
                barSize={14}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar
                  background={{ fill: 'rgb(var(--color-border))' }}
                  dataKey="value"
                  cornerRadius={8}
                  fill={gaugeColor}
                  isAnimationActive
                  animationBegin={150}
                  animationDuration={1100}
                  animationEasing="ease-out"
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold tracking-tight">{progressPct}%</span>
              <span className="text-[11px] text-muted">
                {totalCalories} / {goalCalories} kcal
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {macros.map((m) => {
              const pct = m.target > 0 ? Math.min(100, Math.round((m.value / m.target) * 100)) : 0
              return (
                <div key={m.label} className="rounded-xl border border-border bg-background px-2.5 py-2">
                  <div className="flex items-center justify-between text-[10px] text-muted">
                    <span>{m.label}</span>
                  </div>
                  <div className="mt-0.5 text-sm font-bold">{m.value}g</div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: m.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Streak + quick stat */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex animate-fade-in-up items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-md shadow-black/10">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15">
              <Flame size={20} className="text-accent" />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-extrabold leading-none">{streak}</div>
              <div className="text-[11px] text-muted">{streak === 1 ? 'dia seguido' : 'dias seguidos'}</div>
            </div>
          </div>
          <div className="flex animate-fade-in-up items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-md shadow-black/10">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <UtensilsCrossed size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-extrabold leading-none">{todayMeals.length}</div>
              <div className="text-[11px] text-muted">refeições hoje</div>
            </div>
          </div>
        </div>

        {/* 2×2 shortcut grid */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <ShortcutCard href="/meal/new" Icon={UtensilsCrossed} label="Registrar refeição" from="#00d4aa" to="#00695c" />
          <ShortcutCard href="/progress" Icon={TrendingUp} label="Minha evolução" from="#7c3aed" to="#4c1d95" />
          <ShortcutCard href="/bioimpedance" Icon={Scale} label="Bioimpedância" from="#3b82f6" to="#1d4ed8" />
          <ShortcutCard href="/coach" Icon={MessageCircle} label="Falar com Kai" from="#f59e0b" to="#b45309" />
        </div>

        {/* Weekly calories bar chart */}
        {recentMeals.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-bold tracking-tight text-white/70">Calorias esta semana</h2>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weeklyData} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="weeklyBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={1} />
                      <stop offset="100%" stopColor={CHART_COLORS.secondary} stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: CHART_COLORS.neutral }} />
                  <YAxis hide />
                  <Tooltip {...darkChartTooltipStyle} cursor={{ fill: 'rgb(var(--color-border))', opacity: 0.3 }} />
                  <Bar dataKey="calories" name="Calorias" fill="url(#weeklyBarGradient)" radius={[8, 8, 8, 8]} maxBarSize={26} />
                  <Line
                    type="monotone"
                    dataKey="goal"
                    name="Meta"
                    stroke={CHART_COLORS.accent}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Latest recommendation from nutritionist */}
        {latestRec && (
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-tight text-white/70">Do seu nutricionista</h2>
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
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-md shadow-black/10">
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
          <h2 className="mb-3 text-sm font-bold tracking-tight text-white/70">Refeições de hoje</h2>
          {todayMeals.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma refeição registrada ainda.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {todayMeals.map((meal) => {
                const badge = statusBadge(meal.diet_comparison?.status)
                const BadgeIcon = badge.Icon
                return (
                  <div key={meal.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-border">
                      {meal.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={meal.photo_url} alt={meal.food_name} className="h-full w-full object-cover" />
                      ) : (
                        <UtensilsCrossed size={20} className="text-muted" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{meal.food_name}</div>
                      <div className="text-xs text-muted">
                        {mealTypeLabel(meal.meal_type)} · {formatTime(meal.eaten_at)} · {meal.calories} kcal
                      </div>
                    </div>
                    <BadgeIcon size={20} style={{ color: badge.color }} aria-label={badge.label} />
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

function ShortcutCard({
  href,
  Icon,
  label,
  from,
  to,
}: {
  href: string
  Icon: typeof UtensilsCrossed
  label: string
  from: string
  to: string
}) {
  return (
    <Link href={href}>
      <div
        className="flex animate-fade-in-up flex-col items-center justify-center gap-3 rounded-2xl border border-border p-6 text-center shadow-md shadow-black/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_25px_-8px_var(--glow)]"
        style={
          {
            background: `linear-gradient(160deg, ${from}26 0%, ${to}0d 100%)`,
            '--glow': `${from}55`,
          } as React.CSSProperties
        }
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: `${from}22` }}
        >
          <Icon size={24} strokeWidth={2} style={{ color: from }} />
        </div>
        <span className="text-xs font-semibold text-white/80">{label}</span>
      </div>
    </Link>
  )
}
