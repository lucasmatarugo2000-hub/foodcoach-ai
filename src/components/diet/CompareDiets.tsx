'use client'

import { useMemo, useState } from 'react'
import { mealTypeLabel } from '@/lib/format'
import type { DietPlan, MealType } from '@/types'

const MEAL_TYPES: MealType[] = ['cafe_da_manha', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar', 'ceia']

interface Macros {
  protein: number
  carbs: number
  fat: number
}

function sumMacros(diet: DietPlan): Macros {
  return diet.meals_json.meals.reduce<Macros>(
    (acc, m) => {
      for (const f of m.foods) {
        acc.protein += f.protein
        acc.carbs += f.carbs
        acc.fat += f.fat
      }
      return acc
    },
    { protein: 0, carbs: 0, fat: 0 }
  )
}

function mealCalories(diet: DietPlan, type: MealType): number | null {
  const meal = diet.meals_json.meals.find((m) => m.meal_type === type)
  return meal ? meal.total_calories : null
}

export default function CompareDiets({ diets }: { diets: DietPlan[] }) {
  const [aId, setAId] = useState(diets[0]?.id ?? '')
  const [bId, setBId] = useState(diets[1]?.id ?? '')

  const dietA = diets.find((d) => d.id === aId) ?? null
  const dietB = diets.find((d) => d.id === bId) ?? null

  const macrosA = useMemo(() => (dietA ? sumMacros(dietA) : null), [dietA])
  const macrosB = useMemo(() => (dietB ? sumMacros(dietB) : null), [dietB])

  const macroRows: { label: string; a: number; b: number }[] = []
  if (macrosA && macrosB) {
    macroRows.push(
      { label: 'Proteína', a: macrosA.protein, b: macrosB.protein },
      { label: 'Carboidrato', a: macrosA.carbs, b: macrosB.carbs },
      { label: 'Gordura', a: macrosA.fat, b: macrosB.fat }
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-bold tracking-tight">Comparar dietas</h2>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <select value={aId} onChange={(e) => setAId(e.target.value)} className="w-full rounded-lg px-2 py-2 text-xs">
          {diets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label ?? 'Dieta sem nome'}
            </option>
          ))}
        </select>
        <select value={bId} onChange={(e) => setBId(e.target.value)} className="w-full rounded-lg px-2 py-2 text-xs">
          {diets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label ?? 'Dieta sem nome'}
            </option>
          ))}
        </select>
      </div>

      {dietA && dietB && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-background p-3 text-center">
              <p className="truncate text-xs text-white/50">{dietA.label ?? 'Dieta A'}</p>
              <p className="mt-1 text-lg font-bold text-primary">{dietA.meals_json.daily_total_calories} kcal</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-3 text-center">
              <p className="truncate text-xs text-white/50">{dietB.label ?? 'Dieta B'}</p>
              <p className="mt-1 text-lg font-bold text-primary">{dietB.meals_json.daily_total_calories} kcal</p>
            </div>
          </div>

          <h3 className="mb-2 text-xs font-semibold text-white/70">Diferença de macros</h3>
          <div className="mb-4 flex flex-col gap-1.5">
            {macroRows.map((row) => {
              const delta = Math.round(row.b - row.a)
              return (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs"
                >
                  <span className="text-white/60">{row.label}</span>
                  <span>
                    {Math.round(row.a)}g <span className="text-white/30">→</span> {Math.round(row.b)}g
                    <span
                      className={`ml-2 font-semibold ${
                        delta === 0 ? 'text-white/40' : delta > 0 ? 'text-warning' : 'text-primary'
                      }`}
                    >
                      ({delta > 0 ? '+' : ''}
                      {delta}g)
                    </span>
                  </span>
                </div>
              )
            })}
          </div>

          <h3 className="mb-2 text-xs font-semibold text-white/70">Por refeição</h3>
          <div className="flex flex-col gap-1.5">
            {MEAL_TYPES.map((type) => {
              const a = mealCalories(dietA, type)
              const b = mealCalories(dietB, type)
              if (a === null && b === null) return null
              return (
                <div
                  key={type}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs"
                >
                  <span className="text-white/60">{mealTypeLabel(type)}</span>
                  <span>
                    {a ?? '—'} kcal <span className="text-white/30">vs</span> {b ?? '—'} kcal
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
