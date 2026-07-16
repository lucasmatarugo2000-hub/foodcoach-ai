'use client'

import { useEffect, useMemo, useState } from 'react'
import { UtensilsCrossed } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDateFull, formatTime, mealTypeLabel, statusBadge } from '@/lib/format'
import BottomNav from '@/components/BottomNav'
import ThemeToggle from '@/components/ThemeToggle'
import type { Meal } from '@/types'

export default function HistoryPage() {
  const supabase = createClient()
  const [meals, setMeals] = useState<Meal[]>([])
  const [hasDiet, setHasDiet] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('')

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const since = new Date()
      since.setDate(since.getDate() - 30)

      const [{ data: mealsData }, { data: dietData }] = await Promise.all([
        supabase
          .from('meals')
          .select('*')
          .eq('user_id', user.id)
          .gte('eaten_at', since.toISOString())
          .order('eaten_at', { ascending: false }),
        supabase.from('diet_plans').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
      ])

      setMeals(mealsData ?? [])
      setHasDiet(!!dietData)
      setLoading(false)
    }
    load()
  }, [supabase])

  const groups = useMemo(() => {
    const map = new Map<string, Meal[]>()
    for (const meal of meals) {
      const key = new Date(meal.eaten_at).toISOString().slice(0, 10)
      if (dateFilter && key !== dateFilter) continue
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(meal)
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [meals, dateFilter])

  return (
    <div className="min-h-screen px-4 pb-28 pt-6">
      <ThemeToggle className="fixed right-4 top-4 z-50" />
      <h1 className="mb-4 text-xl font-bold">Histórico</h1>

      <input
        type="date"
        value={dateFilter}
        onChange={(e) => setDateFilter(e.target.value)}
        className="mb-6 w-full rounded-xl px-4 py-3 outline-none focus:border-primary"
      />

      {loading ? (
        <p className="text-sm text-white/50">Carregando...</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-white/40">Nenhuma refeição encontrada no período.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(([dateKey, dayMeals]) => {
            const onTrack = dayMeals.filter((m) => m.diet_comparison?.status === 'on_track').length
            const adherence = hasDiet && dayMeals.length > 0 ? Math.round((onTrack / dayMeals.length) * 100) : null
            const totalCalories = dayMeals.reduce((s, m) => s + m.calories, 0)

            return (
              <div key={dateKey}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white/70">
                    {formatDateFull(dayMeals[0]?.eaten_at ?? dateKey)}
                  </h2>
                  <span className="text-xs text-white/50">
                    {adherence !== null ? `Aderência: ${adherence}%` : `${totalCalories} kcal`}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {dayMeals.map((meal) => {
                    const badge = statusBadge(meal.diet_comparison?.status)
                    const BadgeIcon = badge.Icon
                    return (
                      <div
                        key={meal.id}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-border">
                          {meal.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={meal.photo_url} alt={meal.food_name} className="h-full w-full object-cover" />
                          ) : (
                            <UtensilsCrossed size={18} className="text-muted" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{meal.food_name}</div>
                          <div className="text-xs text-white/50">
                            {mealTypeLabel(meal.meal_type)} · {formatTime(meal.eaten_at)} · {meal.calories} kcal
                          </div>
                        </div>
                        <BadgeIcon size={20} style={{ color: badge.color }} aria-label={badge.label} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <BottomNav />
    </div>
  )
}
