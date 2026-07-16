'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { adherencePct, bioimpedanceSeries, caloriesByDay, macroAverages } from '@/lib/charts'
import { CHART_COLORS, chartTooltipStyle } from '@/lib/chartTheme'
import { clientDisplayName } from '@/lib/nutri'
import { formatDateFull, formatTime, mealTypeLabel, statusBadge } from '@/lib/format'
import RecommendationCard from '@/components/RecommendationCard'
import RecommendationModal from '@/components/nutri/RecommendationModal'
import BioimpedanceForm from '@/components/BioimpedanceForm'
import type { Bioimpedance, DietMealsJson, Meal, Recommendation, UserProfile } from '@/types'

type Tab = 'overview' | 'meals' | 'bioimpedance' | 'recommendations' | 'diet'

const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Visão Geral' },
  { value: 'meals', label: 'Refeições' },
  { value: 'bioimpedance', label: 'Bioimpedância' },
  { value: 'recommendations', label: 'Recomendações' },
  { value: 'diet', label: 'Dieta' },
]

export default function NutriClientPage({ params }: { params: { id: string } }) {
  const clientId = params.id
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [meals, setMeals] = useState<Meal[]>([])
  const [dietId, setDietId] = useState<string | null>(null)
  const [diet, setDiet] = useState<DietMealsJson | null>(null)
  const [bioRecords, setBioRecords] = useState<Bioimpedance[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])

  const [mealsDateFilter, setMealsDateFilter] = useState('')
  const [showRecModal, setShowRecModal] = useState(false)
  const [showBioModal, setShowBioModal] = useState(false)
  const [dietSaving, setDietSaving] = useState(false)
  const [dietSaved, setDietSaved] = useState(false)

  async function loadAll() {
    setLoading(true)
    const [
      rpcResult,
      { data: profileData },
      { data: mealsData },
      { data: dietData },
      { data: bioData },
      { data: recData },
    ] = await Promise.all([
      supabase.rpc('get_linked_clients_emails'),
      supabase.from('users_profile').select('*').eq('id', clientId).maybeSingle<UserProfile>(),
      supabase
        .from('meals')
        .select('*')
        .eq('user_id', clientId)
        .order('eaten_at', { ascending: false })
        .limit(200)
        .returns<Meal[]>(),
      supabase
        .from('diet_plans')
        .select('id, meals_json')
        .eq('user_id', clientId)
        .eq('is_active', true)
        .maybeSingle<{ id: string; meals_json: DietMealsJson }>(),
      supabase.from('bioimpedance').select('*').eq('user_id', clientId).order('date', { ascending: true }).returns<Bioimpedance[]>(),
      supabase
        .from('recommendations')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .returns<Recommendation[]>(),
    ])

    const emails = rpcResult.data as { client_id: string; email: string }[] | null
    setEmail(emails?.find((e) => e.client_id === clientId)?.email ?? null)
    setProfile(profileData ?? null)
    setMeals(mealsData ?? [])
    setDietId(dietData?.id ?? null)
    setDiet(dietData?.meals_json ?? null)
    setBioRecords(bioData ?? [])
    setRecommendations(recData ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  const dailyCalories = useMemo(
    () => caloriesByDay(meals, 30).map((d) => ({ ...d, meta: profile?.daily_calories_goal ?? null })),
    [meals, profile]
  )

  const weekMacros = useMemo(() => {
    const since = new Date()
    since.setDate(since.getDate() - 7)
    const recent = meals.filter((m) => new Date(m.eaten_at) >= since)
    const avg = macroAverages(recent)
    return [
      { name: 'Proteína', value: avg.protein },
      { name: 'Carboidrato', value: avg.carbs },
      { name: 'Gordura', value: avg.fat },
    ]
  }, [meals])

  const adherence = useMemo(() => adherencePct(meals), [meals])
  const bioChartData = useMemo(() => bioimpedanceSeries(bioRecords), [bioRecords])
  const latestWeight = bioRecords.length > 0 ? (bioRecords[bioRecords.length - 1]?.weight ?? null) : null

  const filteredMeals = useMemo(
    () => (mealsDateFilter ? meals.filter((m) => m.eaten_at.slice(0, 10) === mealsDateFilter) : meals),
    [meals, mealsDateFilter]
  )

  function updateFoodField(mealIdx: number, foodIdx: number, field: 'name' | 'quantity' | 'calories', value: string) {
    if (!diet) return
    const next: DietMealsJson = structuredClone(diet)
    const meal = next.meals[mealIdx]
    const food = meal?.foods[foodIdx]
    if (!meal || !food) return
    if (field === 'calories') food.calories = Number(value) || 0
    else food[field] = value
    meal.total_calories = meal.foods.reduce((s, f) => s + f.calories, 0)
    next.daily_total_calories = next.meals.reduce((s, m) => s + m.total_calories, 0)
    setDiet(next)
    setDietSaved(false)
  }

  async function saveDiet() {
    if (!diet || !dietId) return
    setDietSaving(true)
    const { error } = await supabase.from('diet_plans').update({ meals_json: diet }).eq('id', dietId)
    setDietSaving(false)
    if (!error) setDietSaved(true)
  }

  const name = email ? clientDisplayName(email) : 'Cliente'

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-white/50">Carregando...</div>
  }

  return (
    <div className="min-h-screen px-4 pb-10 pt-6 md:px-8">
      <Link href="/nutri/clientes" className="mb-3 inline-block text-xs text-white/50">
        ← Voltar para clientes
      </Link>
      <h1 className="mb-1 text-xl font-bold">{name}</h1>
      <p className="mb-5 text-sm text-white/50">{email}</p>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition ${
              tab === t.value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-white/60'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-white/50">Peso atual</div>
              <div className="mt-1 text-2xl font-bold">{latestWeight !== null ? `${latestWeight} kg` : '—'}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-white/50">Aderência à dieta</div>
              <div className="mt-1 text-2xl font-bold text-primary">{adherence !== null ? `${adherence}%` : '—'}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-white/70">Calorias por dia (30 dias)</h2>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyCalories} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART_COLORS.neutral }} interval={4} />
                  <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.neutral }} width={40} />
                  <Tooltip {...chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="calories" name="Consumido" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
                  <Line
                    type="monotone"
                    dataKey="meta"
                    name="Meta"
                    stroke={CHART_COLORS.neutral}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-white/70">Macros médios da semana</h2>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekMacros} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_COLORS.neutral }} />
                  <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.neutral }} width={32} unit="g" />
                  <Tooltip {...chartTooltipStyle} />
                  <Bar dataKey="value" name="gramas" radius={[6, 6, 0, 0]}>
                    {weekMacros.map((entry, i) => (
                      <Cell
                        key={entry.name}
                        fill={[CHART_COLORS.series1, CHART_COLORS.series2, CHART_COLORS.series4][i] ?? CHART_COLORS.series1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-white/70">Últimas refeições</h2>
            {meals.length === 0 ? (
              <p className="text-sm text-white/40">Nenhuma refeição registrada ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {meals.slice(0, 5).map((meal) => (
                  <MealRow key={meal.id} meal={meal} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'meals' && (
        <div>
          <input
            type="date"
            value={mealsDateFilter}
            onChange={(e) => setMealsDateFilter(e.target.value)}
            className="mb-4 w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
          />
          {filteredMeals.length === 0 ? (
            <p className="text-sm text-white/40">Nenhuma refeição encontrada.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredMeals.map((meal) => (
                <MealRow key={meal.id} meal={meal} showMacros />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'bioimpedance' && (
        <div className="flex flex-col gap-5">
          <button
            onClick={() => setShowBioModal(true)}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-black"
          >
            + Lançar bioimpedância manualmente
          </button>

          {bioRecords.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold text-white/70">Comparativo</h2>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bioChartData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART_COLORS.neutral }} />
                    <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.neutral }} width={36} />
                    <Tooltip {...chartTooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="weight" name="Peso (kg)" stroke={CHART_COLORS.series1} strokeWidth={2} dot={{ r: 3 }} />
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
                      name="Massa muscular (kg)"
                      stroke={CHART_COLORS.series2}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-3 text-sm font-semibold text-white/70">Histórico</h2>
            {bioRecords.length === 0 ? (
              <p className="text-sm text-white/40">Nenhum registro de bioimpedância ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {bioRecords
                  .slice()
                  .reverse()
                  .map((r) => (
                    <BioRow key={r.id} record={r} />
                  ))}
              </div>
            )}
          </div>

          {showBioModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 py-10 overflow-y-auto">
              <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5">
                <h3 className="mb-4 text-base font-semibold">Lançar bioimpedância</h3>
                <BioimpedanceForm
                  userId={clientId}
                  onCancel={() => setShowBioModal(false)}
                  onSaved={() => {
                    setShowBioModal(false)
                    loadAll()
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'recommendations' && (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => setShowRecModal(true)}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-black"
          >
            + Nova recomendação
          </button>
          {recommendations.length === 0 ? (
            <p className="text-sm text-white/40">Nenhuma recomendação enviada ainda.</p>
          ) : (
            recommendations.map((rec) => <RecommendationCard key={rec.id} recommendation={rec} />)
          )}

          {showRecModal && (
            <RecommendationModal clientId={clientId} onClose={() => setShowRecModal(false)} onSaved={loadAll} />
          )}
        </div>
      )}

      {tab === 'diet' && (
        <div>
          {!diet ? (
            <p className="text-sm text-white/40">Este cliente ainda não tem uma dieta cadastrada.</p>
          ) : (
            <div>
              <div className="mb-4 rounded-xl border border-border bg-card p-3 text-sm">
                <span className="text-white/60">Meta diária: </span>
                <span className="font-semibold text-primary">{diet.daily_total_calories} kcal</span>
                {diet.observations && <p className="mt-1 text-xs text-white/50">{diet.observations}</p>}
              </div>

              <div className="flex flex-col gap-4">
                {diet.meals.map((meal, mIdx) => (
                  <div key={mIdx} className="rounded-2xl border border-border bg-card p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="font-semibold">{mealTypeLabel(meal.meal_type)}</h3>
                      <span className="text-xs text-white/50">{meal.time_reference}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {meal.foods.map((food, fIdx) => (
                        <div key={fIdx} className="flex items-center gap-2 text-sm">
                          <input
                            value={food.name}
                            onChange={(e) => updateFoodField(mIdx, fIdx, 'name', e.target.value)}
                            className="flex-1 rounded-lg px-2 py-1.5 text-sm"
                          />
                          <input
                            value={food.quantity}
                            onChange={(e) => updateFoodField(mIdx, fIdx, 'quantity', e.target.value)}
                            className="w-20 rounded-lg px-2 py-1.5 text-sm"
                          />
                          <input
                            type="number"
                            value={food.calories}
                            onChange={(e) => updateFoodField(mIdx, fIdx, 'calories', e.target.value)}
                            className="w-16 rounded-lg px-2 py-1.5 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-right text-xs text-white/50">Total: {meal.total_calories} kcal</div>
                  </div>
                ))}
              </div>

              <button
                onClick={saveDiet}
                disabled={dietSaving}
                className="mt-6 w-full rounded-xl bg-primary py-3 font-semibold text-black disabled:opacity-50"
              >
                {dietSaving ? 'Salvando...' : dietSaved ? 'Dieta atualizada ✓' : 'Atualizar dieta do cliente'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MealRow({ meal, showMacros = false }: { meal: Meal; showMacros?: boolean }) {
  const badge = statusBadge(meal.diet_comparison?.status)
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-border">
        {meal.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={meal.photo_url} alt={meal.food_name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">🍽️</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{meal.food_name}</div>
        <div className="text-xs text-white/50">
          {mealTypeLabel(meal.meal_type)} · {formatTime(meal.eaten_at)} · {meal.calories} kcal
          {showMacros && ` · P${meal.protein}g C${meal.carbs}g G${meal.fat}g`}
        </div>
      </div>
      <span title={badge.label} className="text-lg">
        {badge.emoji}
      </span>
    </div>
  )
}

function BioRow({ record }: { record: Bioimpedance }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="mb-1 text-xs font-semibold text-white/70">{formatDateFull(`${record.date}T00:00:00`)}</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
        {record.weight !== null && <span>Peso: {record.weight}kg</span>}
        {record.body_fat_pct !== null && <span>Gordura: {record.body_fat_pct}%</span>}
        {record.muscle_mass !== null && <span>Massa muscular: {record.muscle_mass}kg</span>}
        {record.bmi !== null && <span>IMC: {record.bmi}</span>}
      </div>
    </div>
  )
}
