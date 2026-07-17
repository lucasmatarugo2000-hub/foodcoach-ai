import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicClient, CLAUDE_MODEL } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import { buildCycleContextPrompt, getCoachPersonaPrompt } from '@/lib/coach'
import { computeCycleStatus } from '@/lib/cycle'
import type { DietMealsJson, HealthLog, Meal, MenstrualCycle, UserProfile } from '@/types'

export const runtime = 'nodejs'

interface CoachMessageRequest {
  meal_id?: string | null
  meal_data?: {
    food_name: string
    calories: number
    protein: number
    carbs: number
    fat: number
    meal_type?: string | null
  } | null
  user_message?: string | null
}

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'emagrecer',
  gain_muscle: 'ganhar massa',
  maintenance: 'manutenção do peso',
  reeducation: 'reeducação alimentar',
}

function buildDietSummary(mealsJson: DietMealsJson | null): string {
  if (!mealsJson) return 'Nenhuma dieta prescrita cadastrada.'
  const lines = mealsJson.meals.map(
    (m) => `${m.meal_type} (${m.time_reference}): ${m.foods.map((f) => `${f.name} ${f.quantity}`).join(', ')}`
  )
  return `Meta diária: ${mealsJson.daily_total_calories} kcal.\n${lines.join('\n')}`
}

function buildHealthSummary(logs: HealthLog[]): string {
  if (logs.length === 0) return 'Nenhum registro de saúde nos últimos 7 dias.'
  const lines = logs.map((l) => {
    const parts: string[] = []
    if (l.sleep_hours != null) parts.push(`sono ${l.sleep_hours}h${l.sleep_quality ? ` (qualidade ${l.sleep_quality}/5)` : ''}`)
    if (l.water_ml) parts.push(`água ${l.water_ml}ml`)
    if (l.weight != null) parts.push(`peso ${l.weight}kg`)
    if (l.mood != null) parts.push(`humor ${l.mood}/5`)
    if (l.energy != null) parts.push(`energia ${l.energy}/5`)
    if (l.steps != null) parts.push(`${l.steps} passos`)
    if (l.workout_type) parts.push(`treino ${l.workout_type}${l.workout_duration ? ` (${l.workout_duration}min)` : ''}`)
    if (l.symptoms && l.symptoms.length > 0) parts.push(`sintomas: ${l.symptoms.join(', ')}`)
    return `${l.date}: ${parts.length > 0 ? parts.join(', ') : 'sem dados'}`
  })
  return lines.join('\n')
}

const HEALTH_CORRELATION_PROMPT = `Você tem acesso aos registros de saúde do usuário (sono, água, peso, humor, energia, treinos, passos). Use esses dados para fazer correlações e insights personalizados. Exemplos:
- Se o usuário dorme menos de 6h e o humor cai, mencione isso
- Se a hidratação está baixa e o usuário reclama de cansaço, relacione
- Se o peso subiu após um fim de semana, contextualize com os dados de alimentação
- Celebre conquistas: 7 dias seguidos acima de 8.000 passos, meta de água atingida, etc.`

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

Quando sugerir substituições, prefira sempre opções presentes na TACO com perfil nutricional similar. Mencione explicitamente que seus valores são baseados na TACO quando relevante.`

function buildSystemPrompt(
  profile: UserProfile,
  dietSummary: string,
  healthSummary: string,
  cycleContext: string | null
) {
  return `${TACO_PROMPT_SECTION}

${getCoachPersonaPrompt(profile.gender)}

Quando o usuário tem dieta ativa, use-a como referência neutra, nunca como régua de julgamento. Se divergir da dieta, mencione de forma neutra e ofereça substituição apenas se perguntado ou se a divergência for grande.

Faça perguntas abertas apenas após identificar padrão em 3+ refeições. Sempre termine com algo encorajador.

${HEALTH_CORRELATION_PROMPT}

Registros de saúde dos últimos 7 dias (mais recente por último):
${healthSummary}
${cycleContext ? `\n${cycleContext}\n` : ''}
Objetivo: ${profile.goal ? (GOAL_LABELS[profile.goal] ?? profile.goal) : 'não definido'}. Meta calórica: ${profile.daily_calories_goal ?? 'não definida'} kcal. Dieta ativa: ${dietSummary}. Estilo: ${profile.coaching_style === 'direct' ? 'direto' : 'acolhedor'}.`
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: CoachMessageRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('users_profile')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<UserProfile>()

  if (!profile) {
    return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
  }

  const { data: activeDiet } = await supabase
    .from('diet_plans')
    .select('meals_json')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle<{ meals_json: DietMealsJson }>()

  const { data: recentMeals } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', user.id)
    .order('eaten_at', { ascending: false })
    .limit(10)

  const { data: recentMessages } = await supabase
    .from('coach_messages')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const since = new Date()
  since.setDate(since.getDate() - 6)
  const { data: healthLogs } = await supabase
    .from('health_logs')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: true })
    .returns<HealthLog[]>()

  let cycleContext: string | null = null
  if (profile.gender === 'female') {
    const { data: latestCycle } = await supabase
      .from('menstrual_cycles')
      .select('*')
      .eq('user_id', user.id)
      .order('cycle_start', { ascending: false })
      .limit(1)
      .maybeSingle<MenstrualCycle>()
    if (latestCycle) {
      const status = computeCycleStatus(latestCycle)
      cycleContext = buildCycleContextPrompt(status.phase, status.cycleDay, status.cycleLength)
    }
  }

  const dietSummary = buildDietSummary(activeDiet?.meals_json ?? null)
  const healthSummary = buildHealthSummary(healthLogs ?? [])
  const systemPrompt = buildSystemPrompt(profile, dietSummary, healthSummary, cycleContext)

  const history = (recentMessages ?? [])
    .slice()
    .reverse()
    .map((m) => ({
      role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.message,
    }))

  let turnText: string
  if (body.meal_data) {
    const m = body.meal_data
    turnText = `Acabei de registrar uma refeição: ${m.food_name}, aproximadamente ${m.calories} kcal (proteína ${m.protein}g, carboidratos ${m.carbs}g, gordura ${m.fat}g).`
  } else if (body.user_message) {
    turnText = body.user_message
  } else {
    const summary = (recentMeals ?? [])
      .slice(0, 5)
      .map((m: Meal) => `${m.food_name} (${m.calories} kcal)`)
      .join(', ')
    turnText = `Aqui estão minhas últimas refeições: ${summary || 'nenhuma refeição registrada ainda'}. O que você acha?`
  }

  // Persist the user's message immediately — before calling Anthropic — so it
  // survives even when the downstream AI call fails (billing/rate-limit/etc).
  if (body.user_message) {
    const { error: userInsertError } = await supabase.from('coach_messages').insert({
      user_id: user.id,
      meal_id: body.meal_id ?? null,
      message: body.user_message,
      type: 'comment',
      sender: 'user',
      role: 'user',
    })
    if (userInsertError) {
      console.error('coach_messages user insert error', userInsertError)
    }
  }

  try {
    const anthropic = getAnthropicClient()
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [...history, { role: 'user', content: turnText }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const kaiMessage = textBlock && textBlock.type === 'text' ? textBlock.text : ''

    const { data: saved, error: saveError } = await supabase
      .from('coach_messages')
      .insert({
        user_id: user.id,
        meal_id: body.meal_id ?? null,
        message: kaiMessage,
        type: 'comment',
        sender: 'kai',
        role: 'assistant',
      })
      .select()
      .single()

    if (saveError) {
      console.error('coach_messages insert error', saveError)
    }

    return NextResponse.json({ message: kaiMessage, id: saved?.id ?? null })
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('coach-message: Anthropic authentication failed — check ANTHROPIC_API_KEY', err.message)
      return NextResponse.json({ error: 'Chave da Anthropic inválida ou ausente.' }, { status: 500 })
    }
    if (err instanceof Anthropic.PermissionDeniedError) {
      console.error('coach-message: Anthropic permission denied', err.message)
      return NextResponse.json({ error: 'Sem permissão para usar este modelo.' }, { status: 500 })
    }
    if (err instanceof Anthropic.RateLimitError) {
      console.error('coach-message: Anthropic rate limited', err.message)
      return NextResponse.json({ error: 'Muitas requisições agora. Tente novamente em instantes.' }, { status: 500 })
    }
    if (err instanceof Anthropic.BadRequestError) {
      // Covers e.g. "credit balance too low" — surfaces as invalid_request_error from Anthropic.
      console.error('coach-message: Anthropic bad request —', err.status, err.message)
      return NextResponse.json(
        { error: 'A Anthropic recusou a requisição (verifique créditos/billing da conta).' },
        { status: 500 }
      )
    }
    if (err instanceof Anthropic.APIError) {
      console.error('coach-message: Anthropic API error —', err.status, err.message)
      return NextResponse.json({ error: 'Falha ao gerar mensagem do coach.' }, { status: 500 })
    }
    console.error('coach-message: unexpected error', err)
    return NextResponse.json({ error: 'Falha ao gerar mensagem do coach' }, { status: 500 })
  }
}
