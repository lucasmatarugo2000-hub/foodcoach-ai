import type { AnalyzeMealResult, DietComparison, DietMealsJson, MealType } from '@/types'

export function currentMealType(date: Date = new Date()): MealType {
  const h = date.getHours()
  if (h >= 5 && h < 10) return 'cafe_da_manha'
  if (h >= 10 && h < 12) return 'lanche_manha'
  if (h >= 12 && h < 15) return 'almoco'
  if (h >= 15 && h < 18) return 'lanche_tarde'
  if (h >= 18 && h < 21) return 'jantar'
  return 'ceia'
}

export function computeDietComparison(
  analyzed: AnalyzeMealResult,
  mealType: MealType,
  dietPlan: DietMealsJson | null
): DietComparison {
  if (!dietPlan) {
    return {
      prescribed_meal: '',
      status: 'no_diet',
      calories_diff: 0,
      notes: 'Sem dieta ativa cadastrada.',
    }
  }

  const prescribed = dietPlan.meals.find((m) => m.meal_type === mealType)

  if (!prescribed) {
    return {
      prescribed_meal: '',
      status: 'no_diet',
      calories_diff: 0,
      notes: 'Nenhuma refeição prescrita para este horário.',
    }
  }

  const diff = analyzed.calories - prescribed.total_calories
  const pct = prescribed.total_calories > 0 ? Math.abs(diff) / prescribed.total_calories : 0

  const status = pct <= 0.1 ? 'on_track' : pct <= 0.25 ? 'close' : 'diverged'
  const prescribedText = prescribed.foods.map((f) => `${f.name} ${f.quantity}`).join(', ')

  return {
    prescribed_meal: prescribedText,
    status,
    calories_diff: diff,
    notes:
      status === 'on_track'
        ? 'Bem alinhado com o que estava previsto.'
        : status === 'close'
          ? 'Perto do previsto, com uma pequena diferença.'
          : 'Divergiu bastante do previsto para este horário.',
  }
}
