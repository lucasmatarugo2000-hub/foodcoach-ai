'use client'

import { mealTypeLabel } from '@/lib/format'
import type { DietMealsJson } from '@/types'

interface DietFoodsEditorProps {
  diet: DietMealsJson
  onChange: (next: DietMealsJson) => void
}

export default function DietFoodsEditor({ diet, onChange }: DietFoodsEditorProps) {
  function updateFoodField(mealIdx: number, foodIdx: number, field: 'name' | 'quantity' | 'calories', value: string) {
    const next: DietMealsJson = structuredClone(diet)
    const meal = next.meals[mealIdx]
    const food = meal?.foods[foodIdx]
    if (!meal || !food) return
    if (field === 'calories') food.calories = Number(value) || 0
    else food[field] = value
    meal.total_calories = meal.foods.reduce((s, f) => s + f.calories, 0)
    next.daily_total_calories = next.meals.reduce((s, m) => s + m.total_calories, 0)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-4">
      {diet.meals.map((meal, mIdx) => (
        <div key={mIdx} className="rounded-2xl border border-border bg-background p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">{mealTypeLabel(meal.meal_type)}</h3>
            <span className="text-xs text-white/50">{meal.time_reference}</span>
          </div>
          <div className="flex flex-col gap-2 overflow-x-hidden">
            {meal.foods.map((food, fIdx) => (
              <div key={fIdx} className="flex items-center gap-1.5">
                <input
                  value={food.name}
                  onChange={(e) => updateFoodField(mIdx, fIdx, 'name', e.target.value)}
                  className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-sm"
                />
                <input
                  value={food.quantity}
                  onChange={(e) => updateFoodField(mIdx, fIdx, 'quantity', e.target.value)}
                  className="max-w-[100px] shrink-0 whitespace-nowrap rounded-lg px-1.5 py-1.5 text-right text-xs"
                />
                <input
                  type="number"
                  value={food.calories}
                  onChange={(e) => updateFoodField(mIdx, fIdx, 'calories', e.target.value)}
                  className="w-[50px] shrink-0 whitespace-nowrap rounded-lg px-1 py-1.5 text-right text-xs font-bold"
                />
              </div>
            ))}
          </div>
          <div className="mt-2 text-right text-xs text-white/50">Total: {meal.total_calories} kcal</div>
        </div>
      ))}
    </div>
  )
}
