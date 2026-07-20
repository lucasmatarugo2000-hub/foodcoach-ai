import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAnthropicClient, CLAUDE_MODEL } from '@/lib/anthropic'
import { extractJson } from '@/lib/openai'
import { formatSleepHours, formatWaterMl, workoutTypeLabel } from '@/lib/health'
import { currentMealType } from '@/lib/dietComparison'
import type { ExtractedHealthData, HealthLog, MenstrualCycle } from '@/types'

export interface HealthExtractionResult {
  extracted: boolean
  success?: boolean
  data?: HealthLog
  saved?: HealthLog
  message?: string
  savedFields?: string[]
  error?: { message: string; code?: string; details?: string | null; hint?: string | null }
}

const EXTRACTION_SYSTEM_PROMPT = `Você extrai dados de saúde e alimentação de mensagens em português do Brasil. Analise a mensagem do usuário e extraia QUALQUER dado relevante mencionado. Retorne APENAS JSON válido sem markdown, no formato exato:
{ "sleep_start": string|null, "sleep_end": string|null, "sleep_hours": number|null, "sleep_quality": number|null, "water_ml": number|null, "weight": number|null, "mood": number|null, "energy": number|null, "workout_type": string|null, "workout_duration": number|null, "workout_calories": number|null, "steps": number|null, "symptoms": string[]|null, "period_started": boolean|null, "meal": { "food_name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "portion": string }|null, "bioimpedance": { "body_fat_pct": number|null, "muscle_mass": number|null }|null }

Regras:
- Campos não mencionados na mensagem devem ser null.
- sleep_start e sleep_end no formato "HH:MM" (24h).
- Se mencionar horário de dormir e acordar mas não as horas totais, calcule sleep_hours automaticamente (considere que passar da meia-noite é normal — ex: dormiu 23:00, acordou 07:00 = 8 horas).
- sleep_quality vai de 1 a 5: "qualidade péssima/muito ruim" ≈ 1, "ruim" ≈ 2, "média/ok/regular" ≈ 3, "boa" ≈ 4, "ótima/excelente" ≈ 5.
- weight em kg.
- Litros de água: converta para ml (1,5 litro = 1500). "um copo" ≈ 250ml.
- workout_type deve ser um destes: cardio, musculacao, yoga, caminhada, outro.
- mood e energy vão de 1 a 5 quando mencionados explicitamente ou de forma clara ("me sinto péssimo" ≈ 1-2, "ótimo, cheio de energia" ≈ 4-5).
- period_started deve ser true apenas se a usuária disser claramente que o período/menstruação começou hoje ou está no primeiro dia do ciclo (ex: "estou no primeiro dia do meu ciclo", "comecei a menstruar hoje", "minha menstruação desceu hoje"). Caso contrário, null.
- meal: se o usuário descrever um alimento ou refeição que comeu/está comendo/vai comer (ex: "comi arroz com bife", "almocei frango com salada", "tomei um café com pão"), estime os valores nutricionais usando como referência a TACO (Tabela Brasileira de Composição de Alimentos, UNICAMP). Preencha food_name com um resumo curto do que foi comido e portion com a quantidade estimada/mencionada. Se nenhum alimento foi mencionado como consumido, meal deve ser null.
- bioimpedance: se o usuário mencionar um resultado de bioimpedância/balança inteligente com percentual de gordura corporal e/ou massa muscular (ex: "minha balança marcou 18% de gordura e 35kg de músculo"), preencha bioimpedance. Caso contrário, null.
- Se a mensagem não contém NENHUM dado identificável, retorne todos os campos como null.`

function hasAnyExtractedValue(data: ExtractedHealthData): boolean {
  const scalarFields: (keyof ExtractedHealthData)[] = [
    'sleep_start',
    'sleep_end',
    'sleep_hours',
    'sleep_quality',
    'water_ml',
    'weight',
    'mood',
    'energy',
    'workout_type',
    'workout_duration',
    'workout_calories',
    'steps',
  ]
  const hasScalar = scalarFields.some((key) => data[key] !== null && data[key] !== undefined)
  const hasSymptoms = Array.isArray(data.symptoms) && data.symptoms.length > 0
  return hasScalar || hasSymptoms
}

function buildSavedFields(data: ExtractedHealthData): string[] {
  const parts: string[] = []
  if (data.meal !== null) parts.push(`Refeição: ${data.meal.food_name} (${Math.round(data.meal.calories)} kcal)`)
  if (data.sleep_hours !== null) parts.push(`Sono ${formatSleepHours(data.sleep_hours)}`)
  if (data.water_ml !== null) parts.push(`Água ${formatWaterMl(data.water_ml)}`)
  if (data.weight !== null) parts.push(`Peso ${data.weight}kg`)
  if (data.mood !== null) parts.push(`Humor ${data.mood}/5`)
  if (data.energy !== null) parts.push(`Energia ${data.energy}/5`)
  if (data.steps !== null) parts.push(`${data.steps} passos`)
  if (data.workout_type !== null) {
    parts.push(`Treino: ${workoutTypeLabel(data.workout_type)}${data.workout_duration ? ` ${data.workout_duration}min` : ''}`)
  }
  if (data.symptoms !== null && data.symptoms.length > 0) parts.push(`Sintomas: ${data.symptoms.join(', ')}`)
  if (data.period_started) parts.push('Início do período registrado')
  if (data.bioimpedance !== null) {
    const bioParts: string[] = []
    if (data.bioimpedance.body_fat_pct !== null) bioParts.push(`${data.bioimpedance.body_fat_pct}% gordura`)
    if (data.bioimpedance.muscle_mass !== null) bioParts.push(`${data.bioimpedance.muscle_mass}kg músculo`)
    if (bioParts.length > 0) parts.push(`Bioimpedância: ${bioParts.join(', ')}`)
  }
  return parts
}

/**
 * Core extraction + persistence logic — the single pipeline that reads any
 * chat message and distributes what it finds across meals, health_logs,
 * users_profile, bioimpedance and menstrual_cycles. Shared by
 * /api/extract-health-data (standalone HTTP call) and /api/chat (internal,
 * in-process call — avoids a redundant second Claude call).
 */
export async function runHealthExtraction(
  supabase: SupabaseClient,
  userId: string,
  message: string
): Promise<HealthExtractionResult> {
  console.log('1. Recebendo mensagem:', message)
  console.log('2. user_id recebido:', userId)

  if (!message || !message.trim()) {
    return { extracted: false }
  }

  try {
    const anthropic = getAnthropicClient()
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const raw = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    if (!raw) return { extracted: false }

    let data: ExtractedHealthData
    try {
      data = extractJson<ExtractedHealthData>(raw)
    } catch (parseErr) {
      console.error('extract-health-data: failed to parse model output —', parseErr, '\nraw:', raw)
      return { extracted: false }
    }

    console.log('3. Dados extraídos pelo Claude:', data)

    const hasLogData = hasAnyExtractedValue(data)
    const hasPeriodStart = data.period_started === true
    const hasMeal = data.meal !== null
    const hasBio = data.bioimpedance !== null

    if (!hasLogData && !hasPeriodStart && !hasMeal && !hasBio) {
      return { extracted: false }
    }

    const today = new Date().toISOString().slice(0, 10)
    let saved: HealthLog | undefined
    let anySaved = false
    let upsertErrorResult: HealthExtractionResult['error']

    if (hasLogData) {
      // Water is additive across chat messages ("I just drank a glass") — every
      // other field is a plain override when the model actually extracted it.
      const { data: existing } = await supabase
        .from('health_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle<HealthLog>()

      const payload: Record<string, unknown> = {
        user_id: userId,
        date: today,
        data_source: 'chat',
      }

      if (data.sleep_start !== null) payload.sleep_start = data.sleep_start
      if (data.sleep_end !== null) payload.sleep_end = data.sleep_end
      if (data.sleep_hours !== null) payload.sleep_hours = data.sleep_hours
      if (data.sleep_quality !== null) payload.sleep_quality = data.sleep_quality
      if (data.weight !== null) payload.weight = data.weight
      if (data.mood !== null) payload.mood = data.mood
      if (data.energy !== null) payload.energy = data.energy
      if (data.workout_type !== null) payload.workout_type = data.workout_type
      if (data.workout_duration !== null) payload.workout_duration = data.workout_duration
      if (data.workout_calories !== null) payload.workout_calories = data.workout_calories
      if (data.steps !== null) payload.steps = data.steps
      if (data.symptoms !== null && data.symptoms.length > 0) {
        const merged = new Set([...(existing?.symptoms ?? []), ...data.symptoms])
        payload.symptoms = Array.from(merged)
      }
      if (data.water_ml !== null) {
        payload.water_ml = (existing?.water_ml ?? 0) + data.water_ml
      }

      console.log('4. Tentando upsert no Supabase...', payload)

      const { data: savedLog, error: upsertError } = await supabase
        .from('health_logs')
        .upsert(payload, { onConflict: 'user_id,date' })
        .select()
        .single<HealthLog>()

      console.log('5. Resultado do upsert:', savedLog)
      console.log('6. Erro do upsert (se houver):', upsertError)

      if (upsertError || !savedLog) {
        upsertErrorResult = {
          message: upsertError?.message ?? 'upsert sem retorno de dados',
          code: upsertError?.code,
          details: upsertError?.details,
          hint: upsertError?.hint,
        }
      } else {
        saved = savedLog
        anySaved = true
      }
    }

    // Weight is tracked both as a daily log point (health_logs.weight, above)
    // and as the user's current reference weight used across the app.
    if (data.weight !== null) {
      const { error: profileError } = await supabase
        .from('users_profile')
        .update({ current_weight: data.weight })
        .eq('id', userId)
      if (profileError) {
        console.error('extract-health-data: users_profile weight sync error', profileError)
      } else {
        anySaved = true
      }
    }

    if (hasPeriodStart) {
      const cyclePayload = {
        user_id: userId,
        cycle_start: today,
        cycle_length: 28,
        period_length: 5,
        symptoms: data.symptoms,
      }
      console.log('4. Tentando upsert no Supabase... (menstrual_cycles)', cyclePayload)

      const { error: cycleError } = await supabase
        .from('menstrual_cycles')
        .insert(cyclePayload)
        .select()
        .single<MenstrualCycle>()

      console.log('6. Erro do upsert (se houver):', cycleError)

      if (cycleError) {
        console.error('extract-health-data: menstrual_cycles insert error', cycleError)
      } else {
        anySaved = true
      }
    }

    if (hasMeal && data.meal) {
      const mealPayload = {
        user_id: userId,
        food_name: data.meal.food_name,
        calories: Math.round(data.meal.calories),
        protein: data.meal.protein,
        carbs: data.meal.carbs,
        fat: data.meal.fat,
        meal_type: currentMealType(),
        confirmed: true,
      }
      console.log('4. Tentando upsert no Supabase... (meals)', mealPayload)

      const { error: mealError } = await supabase.from('meals').insert(mealPayload).select().single()

      console.log('6. Erro do upsert (se houver):', mealError)

      if (mealError) {
        console.error('extract-health-data: meals insert error', mealError)
      } else {
        anySaved = true
      }
    }

    if (hasBio && data.bioimpedance) {
      const bioPayload = {
        user_id: userId,
        date: today,
        weight: data.weight ?? null,
        body_fat_pct: data.bioimpedance.body_fat_pct,
        muscle_mass: data.bioimpedance.muscle_mass,
      }
      console.log('4. Tentando upsert no Supabase... (bioimpedance)', bioPayload)

      const { error: bioError } = await supabase.from('bioimpedance').insert(bioPayload).select().single()

      console.log('6. Erro do upsert (se houver):', bioError)

      if (bioError) {
        console.error('extract-health-data: bioimpedance insert error', bioError)
      } else {
        anySaved = true
      }
    }

    if (!anySaved) {
      return { extracted: false, error: upsertErrorResult }
    }

    const savedFields = buildSavedFields(data)
    return {
      extracted: true,
      success: true,
      data: saved,
      saved,
      savedFields,
      message: `Registrei: ${savedFields.join(' • ')}`,
      error: upsertErrorResult,
    }
  } catch (err) {
    if (
      err instanceof Anthropic.RateLimitError ||
      err instanceof Anthropic.PermissionDeniedError ||
      err instanceof Anthropic.AuthenticationError ||
      err instanceof Anthropic.BadRequestError
    ) {
      console.error('extract-health-data: Anthropic billing/auth error —', err.status, 'body:', JSON.stringify(err.error ?? err.message))
    } else if (err instanceof Anthropic.APIError) {
      console.error('extract-health-data: Anthropic API error —', err.status, 'body:', JSON.stringify(err.error ?? err.message))
    } else {
      console.error('extract-health-data: unexpected error', err)
    }
    // Extraction is a background enhancement to the chat, not the main flow —
    // fail soft so a Claude hiccup never surfaces as a visible chat error.
    return { extracted: false }
  }
}
