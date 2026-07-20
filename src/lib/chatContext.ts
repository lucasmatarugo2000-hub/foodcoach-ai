import { getCoachPersonaPrompt, buildCycleContextPrompt } from '@/lib/coach'
import { computeCycleStatus, PHASE_LABELS } from '@/lib/cycle'
import { mealTypeLabel } from '@/lib/format'
import type { Bioimpedance, DietMealsJson, HealthLog, Meal, MenstrualCycle, UserProfile } from '@/types'

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'emagrecer',
  gain_muscle: 'ganhar massa',
  maintenance: 'manutenção do peso',
  reeducation: 'reeducação alimentar',
}

const TACO_PROMPT_SECTION = `Para todas as informações nutricionais, use como referência principal a TACO — Tabela Brasileira de Composição de Alimentos (UNICAMP, 4ª edição).

Quando mencionar calorias, macronutrientes ou composição de alimentos, baseie-se nos valores da TACO. Priorize sempre alimentos típicos da dieta brasileira e seus valores reais conforme a tabela TACO.

Exemplos de referência TACO que você deve conhecer:
- Arroz branco cozido (100g): 128 kcal, 2,3g proteína, 28,1g carbo, 0,2g gordura
- Feijão carioca cozido (100g): 76 kcal, 4,8g proteína, 13,6g carbo, 0,5g gordura
- Frango grelhado peito s/ pele (100g): 159 kcal, 32,8g proteína, 0g carbo, 2,7g gordura
- Ovo inteiro cozido (100g): 146 kcal, 13,3g proteína, 0,6g carbo, 9,5g gordura
- Banana nanica (100g): 92 kcal, 1,3g proteína, 23,8g carbo, 0,1g gordura
- Batata doce cozida (100g): 77 kcal, 0,6g proteína, 18,4g carbo, 0,1g gordura
- Aveia em flocos (100g): 394 kcal, 13,9g proteína, 66,6g carbo, 8,5g gordura
- Leite integral (100ml): 61 kcal, 3,2g proteína, 4,7g carbo, 3,3g gordura
- Pão de forma integral (100g): 253 kcal, 8,9g proteína, 46,5g carbo, 3,3g gordura
- Mamão papaia (100g): 40 kcal, 0,5g proteína, 10,4g carbo, 0,1g gordura

Quando sugerir substituições ou comentar refeições, prefira sempre valores compatíveis com a TACO. Mencione explicitamente que seus valores são baseados na TACO quando relevante.`

const HEALTH_CORRELATION_PROMPT = `Você tem acesso aos registros de saúde do usuário (sono, água, peso, humor, energia, treinos, passos) e ao consumo alimentar do dia. Use esses dados para fazer correlações e insights personalizados. Exemplos:
- Se o usuário dorme menos de 6h e o humor cai, mencione isso
- Se a hidratação está baixa e o usuário reclama de cansaço, relacione
- Se o peso subiu após um fim de semana, contextualize com os dados de alimentação
- Celebre conquistas: 7 dias seguidos acima de 8.000 passos, meta de água atingida, etc.
- Compare o consumo calórico do dia com a meta e com a dieta prescrita, sem julgar.`

function buildProfileSection(profile: UserProfile, displayName: string): string {
  const lines = [
    `- Nome: ${displayName || 'não informado'}`,
    `- Objetivo: ${profile.goal ? (GOAL_LABELS[profile.goal] ?? profile.goal) : 'não definido'}`,
    `- Meta calórica: ${profile.daily_calories_goal ?? 'não definida'} kcal/dia`,
    `- Peso atual: ${profile.current_weight ?? 'não informado'}${profile.current_weight ? 'kg' : ''}`,
    `- Peso meta: ${profile.target_weight ?? 'não informado'}${profile.target_weight ? 'kg' : ''}`,
    `- Estilo de coaching preferido: ${profile.coaching_style === 'direct' ? 'direto' : 'acolhedor'}`,
  ]
  return lines.join('\n')
}

function buildDietSection(mealsJson: DietMealsJson | null): string {
  if (!mealsJson) return 'Nenhuma dieta prescrita cadastrada.'
  const lines = mealsJson.meals.map(
    (m) => `- ${mealTypeLabel(m.meal_type)} (${m.time_reference}): ${m.foods.map((f) => `${f.name} ${f.quantity}`).join(', ')} — ${m.total_calories} kcal`
  )
  return `Meta diária prescrita: ${mealsJson.daily_total_calories} kcal.\n${lines.join('\n')}`
}

function buildTodaySection(todayMeals: Meal[], todayLog: HealthLog | null, goalCalories: number | null): string {
  const totalCalories = todayMeals.reduce((s, m) => s + m.calories, 0)
  const mealsLine =
    todayMeals.length > 0
      ? `Refeições registradas: ${todayMeals.map((m) => `${mealTypeLabel(m.meal_type)} (${m.calories} kcal)`).join(', ')}`
      : 'Nenhuma refeição registrada ainda hoje.'

  const parts = [mealsLine, `Total consumido: ${totalCalories} kcal${goalCalories ? ` de ${goalCalories} kcal meta` : ''}.`]

  if (todayLog) {
    if (todayLog.sleep_hours != null) {
      parts.push(
        `Sono: ${todayLog.sleep_hours}h${todayLog.sleep_start && todayLog.sleep_end ? ` (${todayLog.sleep_start.slice(0, 5)} às ${todayLog.sleep_end.slice(0, 5)})` : ''}`
      )
    }
    if (todayLog.water_ml) parts.push(`Água: ${(todayLog.water_ml / 1000).toFixed(1)}L`)
    if (todayLog.steps != null) parts.push(`Passos: ${todayLog.steps}`)
    if (todayLog.mood != null || todayLog.energy != null) {
      parts.push(`Humor: ${todayLog.mood ?? '—'}/5, Energia: ${todayLog.energy ?? '—'}/5`)
    }
    if (todayLog.weight != null) parts.push(`Peso registrado hoje: ${todayLog.weight}kg`)
    if (todayLog.workout_type) {
      parts.push(`Treino: ${todayLog.workout_type}${todayLog.workout_duration ? ` (${todayLog.workout_duration}min)` : ''}`)
    }
    if (todayLog.symptoms && todayLog.symptoms.length > 0) parts.push(`Sintomas: ${todayLog.symptoms.join(', ')}`)
  }

  return parts.join('\n')
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
}

function buildWeeklySection(logs: HealthLog[]): string {
  if (logs.length === 0) return 'Nenhum registro de saúde nos últimos 7 dias.'
  const sleepAvg = average(logs.map((l) => l.sleep_hours).filter((v): v is number => v != null))
  const waterAvg = average(logs.map((l) => l.water_ml).filter((v): v is number => !!v))
  const stepsAvg = average(logs.map((l) => l.steps).filter((v): v is number => v != null))
  const weightAvg = average(logs.map((l) => l.weight).filter((v): v is number => v != null))

  const parts: string[] = []
  if (sleepAvg != null) parts.push(`Sono médio: ${sleepAvg}h`)
  if (waterAvg != null) parts.push(`Água média: ${(waterAvg / 1000).toFixed(1)}L`)
  if (stepsAvg != null) parts.push(`Passos médios: ${Math.round(stepsAvg)}`)
  if (weightAvg != null) parts.push(`Peso médio: ${weightAvg}kg`)
  return parts.length > 0 ? parts.join('\n') : 'Poucos dados nos últimos 7 dias para calcular médias.'
}

function buildBioSection(bio: Bioimpedance | null): string | null {
  if (!bio) return null
  const parts = [`Bioimpedância mais recente (${bio.date}):`]
  if (bio.weight != null) parts.push(`peso ${bio.weight}kg`)
  if (bio.body_fat_pct != null) parts.push(`${bio.body_fat_pct}% gordura`)
  if (bio.muscle_mass != null) parts.push(`${bio.muscle_mass}kg músculo`)
  if (bio.bmi != null) parts.push(`IMC ${bio.bmi}`)
  return parts.join(', ')
}

export interface ChatContextData {
  profile: UserProfile
  displayName: string
  activeDiet: DietMealsJson | null
  todayMeals: Meal[]
  todayHealthLog: HealthLog | null
  weeklyHealthLogs: HealthLog[]
  latestBio: Bioimpedance | null
  latestCycle: MenstrualCycle | null
}

/** Builds the full, dynamically-assembled system prompt — profile, active diet,
 * today's intake/health, 7-day averages, bioimpedance and cycle phase — so Kai
 * never has to ask for context that's already known. */
export function buildChatSystemPrompt(ctx: ChatContextData): string {
  const today = new Date().toLocaleDateString('pt-BR')

  let cycleSection: string | null = null
  if (ctx.profile.gender === 'female' && ctx.latestCycle) {
    const status = computeCycleStatus(ctx.latestCycle)
    cycleSection = `A usuária está na fase ${PHASE_LABELS[status.phase].toLowerCase()} do ciclo menstrual (dia ${status.cycleDay} de ${status.cycleLength}).\n${buildCycleContextPrompt(status.phase, status.cycleDay, status.cycleLength)}`
  }

  const bioSection = buildBioSection(ctx.latestBio)

  return `${getCoachPersonaPrompt(ctx.profile.gender)}

${TACO_PROMPT_SECTION}

${HEALTH_CORRELATION_PROMPT}

PERFIL DO USUÁRIO:
${buildProfileSection(ctx.profile, ctx.displayName)}

DIETA PRESCRITA ATIVA:
${buildDietSection(ctx.activeDiet)}

HOJE (${today}):
${buildTodaySection(ctx.todayMeals, ctx.todayHealthLog, ctx.profile.daily_calories_goal)}

ÚLTIMOS 7 DIAS (médias):
${buildWeeklySection(ctx.weeklyHealthLogs)}
${bioSection ? `\n${bioSection}` : ''}
${cycleSection ? `\n${cycleSection}` : ''}

Quando o usuário tem dieta ativa, use-a como referência neutra, nunca como régua de julgamento. Se divergir da dieta, mencione de forma neutra e ofereça substituição apenas se perguntado ou se a divergência for grande. Faça perguntas abertas apenas após identificar padrão em 3+ refeições. Sempre termine com algo encorajador.

Responda sempre com o contexto completo acima. NUNCA peça informações que já estão listadas nele. Se o usuário mencionar algo que complementa o contexto, use naturalmente na resposta.`
}
