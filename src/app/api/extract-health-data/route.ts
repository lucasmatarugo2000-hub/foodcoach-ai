import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicClient, CLAUDE_MODEL } from '@/lib/anthropic'
import { extractJson } from '@/lib/openai'
import { createClient } from '@/lib/supabase/server'
import { formatSleepHours, formatWaterMl, workoutTypeLabel } from '@/lib/health'
import type { ExtractedHealthData, HealthLog, MenstrualCycle } from '@/types'

export const runtime = 'nodejs'

interface ExtractHealthDataRequest {
  message: string
}

const EXTRACTION_SYSTEM_PROMPT = `Você extrai dados de saúde de mensagens em português do Brasil. Analise a mensagem do usuário e extraia QUALQUER dado de saúde mencionado. Retorne APENAS JSON válido sem markdown, no formato exato:
{ "sleep_start": string|null, "sleep_end": string|null, "sleep_hours": number|null, "sleep_quality": number|null, "water_ml": number|null, "weight": number|null, "mood": number|null, "energy": number|null, "workout_type": string|null, "workout_duration": number|null, "workout_calories": number|null, "steps": number|null, "symptoms": string[]|null, "period_started": boolean|null }

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
- Se a mensagem não contém NENHUM dado de saúde identificável, retorne todos os campos como null.`

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

function buildConfirmationMessage(data: ExtractedHealthData): string {
  const parts: string[] = []
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
  return `Registrei: ${parts.join(' • ')}`
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: ExtractHealthDataRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ extracted: false })
  }

  if (!body.message || !body.message.trim()) {
    return NextResponse.json({ extracted: false })
  }

  try {
    const anthropic = getAnthropicClient()
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: body.message }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const raw = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    if (!raw) return NextResponse.json({ extracted: false })

    let data: ExtractedHealthData
    try {
      data = extractJson<ExtractedHealthData>(raw)
    } catch (parseErr) {
      console.error('extract-health-data: failed to parse model output —', parseErr, '\nraw:', raw)
      return NextResponse.json({ extracted: false })
    }

    const hasLogData = hasAnyExtractedValue(data)
    const hasPeriodStart = data.period_started === true

    if (!hasLogData && !hasPeriodStart) {
      return NextResponse.json({ extracted: false })
    }

    const today = new Date().toISOString().slice(0, 10)
    let saved: HealthLog | undefined

    if (hasLogData) {
      // Water is additive across chat messages ("I just drank a glass") — every
      // other field is a plain override when the model actually extracted it.
      const { data: existing } = await supabase
        .from('health_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle<HealthLog>()

      const payload: Record<string, unknown> = {
        user_id: user.id,
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

      console.log('Salvando health_log:', payload)

      const { data: savedLog, error: upsertError } = await supabase
        .from('health_logs')
        .upsert(payload, { onConflict: 'user_id,date' })
        .select()
        .single<HealthLog>()

      if (upsertError || !savedLog) {
        console.error('extract-health-data: health_logs upsert error', upsertError)
      } else {
        saved = savedLog
      }
    }

    if (hasPeriodStart) {
      const cyclePayload = {
        user_id: user.id,
        cycle_start: today,
        cycle_length: 28,
        period_length: 5,
        symptoms: data.symptoms,
      }
      console.log('Salvando menstrual_cycle:', cyclePayload)

      const { error: cycleError } = await supabase
        .from('menstrual_cycles')
        .insert(cyclePayload)
        .select()
        .single<MenstrualCycle>()

      if (cycleError) {
        console.error('extract-health-data: menstrual_cycles insert error', cycleError)
      }
    }

    if (!saved && !hasPeriodStart) {
      return NextResponse.json({ extracted: false })
    }

    return NextResponse.json({
      extracted: true,
      success: true,
      data: saved,
      saved,
      message: buildConfirmationMessage(data),
    })
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
    return NextResponse.json({ extracted: false })
  }
}
