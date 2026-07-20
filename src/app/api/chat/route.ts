import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { getOpenAIClient, extractJson } from '@/lib/openai'
import { getAnthropicClient, CLAUDE_MODEL } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import { buildChatSystemPrompt } from '@/lib/chatContext'
import { runHealthExtraction } from '@/lib/healthExtraction'
import { currentMealType } from '@/lib/dietComparison'
import { displayNameFromEmail } from '@/lib/format'
import type { AnalyzeMealResult, Bioimpedance, DietMealsJson, HealthLog, Meal, MenstrualCycle, UserProfile } from '@/types'

export const runtime = 'nodejs'

interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  message?: string
  imageBase64?: string
  mediaType?: string
  // Accepted for API-contract compatibility — the authenticated session
  // (via cookies) is always the actual source of truth for the user id.
  userId?: string
}

function base64Payload(dataUrl: string): string {
  const commaIdx = dataUrl.indexOf(',')
  return commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: ChatRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.message && !body.imageBase64) {
    return NextResponse.json({ error: 'Mensagem ou imagem obrigatória' }, { status: 400 })
  }

  // 1. Fetch every relevant slice of the user's data in parallel.
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const since7 = new Date()
  since7.setDate(since7.getDate() - 6)

  const [
    { data: profile },
    { data: activeDietRow },
    { data: todayMeals },
    { data: todayHealthLog },
    { data: weeklyHealthLogs },
    { data: latestBio },
    { data: todaysMessages },
  ] = await Promise.all([
    supabase.from('users_profile').select('*').eq('id', user.id).maybeSingle<UserProfile>(),
    supabase
      .from('diet_plans')
      .select('meals_json')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle<{ meals_json: DietMealsJson }>(),
    supabase
      .from('meals')
      .select('*')
      .eq('user_id', user.id)
      .gte('eaten_at', startOfDay.toISOString())
      .order('eaten_at', { ascending: true })
      .returns<Meal[]>(),
    supabase
      .from('health_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', startOfDay.toISOString().slice(0, 10))
      .maybeSingle<HealthLog>(),
    supabase
      .from('health_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', since7.toISOString().slice(0, 10))
      .order('date', { ascending: true })
      .returns<HealthLog[]>(),
    supabase.from('bioimpedance').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(1).maybeSingle<Bioimpedance>(),
    // 2. Today's conversation history (used both for context and to reconstruct messages[]).
    supabase
      .from('coach_messages')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (!profile) {
    return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
  }

  let latestCycle: MenstrualCycle | null = null
  if (profile.gender === 'female') {
    const { data } = await supabase
      .from('menstrual_cycles')
      .select('*')
      .eq('user_id', user.id)
      .order('cycle_start', { ascending: false })
      .limit(1)
      .maybeSingle<MenstrualCycle>()
    latestCycle = data ?? null
  }

  // 3. Montar system prompt completo e rico.
  const systemPrompt = buildChatSystemPrompt({
    profile,
    displayName: displayNameFromEmail(user.email),
    activeDiet: activeDietRow?.meals_json ?? null,
    todayMeals: todayMeals ?? [],
    todayHealthLog: todayHealthLog ?? null,
    weeklyHealthLogs: weeklyHealthLogs ?? [],
    latestBio: latestBio ?? null,
    latestCycle,
  })

  // Ascending chronological order — Anthropic requires strictly alternating
  // user/assistant roles, so consecutive same-role rows are merged.
  const history: ConversationTurn[] = []
  for (const m of (todaysMessages ?? []).slice().reverse()) {
    const role: 'user' | 'assistant' = m.role === 'user' ? 'user' : 'assistant'
    const last = history[history.length - 1]
    if (last && last.role === role) {
      last.content += `\n${m.message}`
    } else {
      history.push({ role, content: m.message })
    }
  }

  // 4. Se tem imagem: analisa com GPT-4o Vision primeiro e já salva a refeição.
  let imageAnalysis: AnalyzeMealResult | null = null
  let savedMealFromImage: Meal | null = null
  let turnText = body.message ?? ''

  if (body.imageBase64) {
    const mediaType = body.mediaType ?? 'image/jpeg'
    const dataUrl = body.imageBase64.startsWith('data:') ? body.imageBase64 : `data:${mediaType};base64,${body.imageBase64}`

    try {
      const openai = getOpenAIClient()
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analise esta foto de alimento. Para alimentos brasileiros típicos, use como referência os valores da TACO (Tabela Brasileira de Composição de Alimentos, UNICAMP, 4ª edição). Retorne APENAS JSON válido sem markdown:
{ "food_name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "portion": string, "confidence": "high"|"medium"|"low" }`,
              },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      })
      const raw = completion.choices[0]?.message?.content
      if (raw) imageAnalysis = extractJson<AnalyzeMealResult>(raw)
    } catch (err) {
      if (err instanceof OpenAI.RateLimitError || err instanceof OpenAI.PermissionDeniedError || err instanceof OpenAI.AuthenticationError) {
        console.error('chat: OpenAI billing/auth error —', err.status, err.code, err.message)
      } else {
        console.error('chat: image analysis failed', err)
      }
    }

    if (imageAnalysis) {
      let photoUrl: string | null = null
      try {
        const buffer = Buffer.from(base64Payload(dataUrl), 'base64')
        const path = `${user.id}/${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('meal-photos')
          .upload(path, buffer, { contentType: mediaType })
        if (uploadError) {
          console.error('chat: photo upload error', uploadError)
        } else {
          const { data: pub } = supabase.storage.from('meal-photos').getPublicUrl(path)
          photoUrl = pub.publicUrl
        }
      } catch (err) {
        console.error('chat: photo upload exception', err)
      }

      const { data: savedMeal, error: mealInsertError } = await supabase
        .from('meals')
        .insert({
          user_id: user.id,
          photo_url: photoUrl,
          food_name: imageAnalysis.food_name,
          calories: imageAnalysis.calories,
          protein: imageAnalysis.protein,
          carbs: imageAnalysis.carbs,
          fat: imageAnalysis.fat,
          meal_type: currentMealType(),
          confirmed: true,
        })
        .select()
        .single<Meal>()

      if (mealInsertError) {
        console.error('chat: meals insert error (image path)', mealInsertError)
      } else {
        savedMealFromImage = savedMeal
      }

      const imageSummary = `[Foto de refeição] ${imageAnalysis.food_name}, aproximadamente ${imageAnalysis.calories} kcal (proteína ${imageAnalysis.protein}g, carboidratos ${imageAnalysis.carbs}g, gordura ${imageAnalysis.fat}g).`
      turnText = turnText ? `${turnText}\n${imageSummary}` : imageSummary
    } else if (!turnText) {
      turnText = '[Foto de refeição] Não consegui identificar o alimento automaticamente — pode descrever o que é?'
    }
  }

  // Persist the user's turn immediately — before calling Anthropic — so it
  // survives even when the downstream AI call subsequently fails.
  const userMessageText = body.message || turnText
  const { error: userInsertError } = await supabase.from('coach_messages').insert({
    user_id: user.id,
    message: userMessageText,
    type: 'comment',
    sender: 'user',
    role: 'user',
  })
  if (userInsertError) console.error('coach_messages user insert error', userInsertError)

  if (history[history.length - 1]?.role === 'user') {
    history[history.length - 1]!.content += `\n${turnText}`
  } else {
    history.push({ role: 'user', content: turnText })
  }

  // 6-7. Extração e salvamento automático dos dados mencionados no texto —
  // roda em paralelo com a chamada principal ao Claude. O caminho de imagem
  // já salvou a refeição diretamente acima, então só extraímos do texto.
  const extractionPromise = body.message ? runHealthExtraction(supabase, user.id, body.message) : Promise.resolve(null)

  try {
    const anthropic = getAnthropicClient()
    const [response, extraction] = await Promise.all([
      anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        system: systemPrompt,
        messages: history,
      }),
      extractionPromise,
    ])

    const textBlock = response.content.find((b) => b.type === 'text')
    const kaiMessage = textBlock && textBlock.type === 'text' ? textBlock.text : ''

    // 8. Salva a resposta do coach em coach_messages.
    const { error: kaiInsertError } = await supabase.from('coach_messages').insert({
      user_id: user.id,
      message: kaiMessage,
      type: 'comment',
      sender: 'kai',
      role: 'assistant',
    })
    if (kaiInsertError) console.error('coach_messages kai insert error', kaiInsertError)

    const savedFields = [...(extraction?.savedFields ?? [])]
    if (savedMealFromImage) {
      savedFields.unshift(`Refeição: ${savedMealFromImage.food_name} (${savedMealFromImage.calories} kcal)`)
    }

    // 9. Retorna resposta + dados salvos.
    return NextResponse.json({
      message: kaiMessage,
      healthDataSaved: (extraction?.extracted ?? false) || Boolean(savedMealFromImage),
      savedFields,
      meal: savedMealFromImage,
    })
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('chat: Anthropic authentication failed — check ANTHROPIC_API_KEY', err.message)
      return NextResponse.json({ error: 'Chave da Anthropic inválida ou ausente.' }, { status: 500 })
    }
    if (err instanceof Anthropic.PermissionDeniedError) {
      console.error('chat: Anthropic permission denied', err.message)
      return NextResponse.json({ error: 'Sem permissão para usar este modelo.' }, { status: 500 })
    }
    if (err instanceof Anthropic.RateLimitError) {
      console.error('chat: Anthropic rate limited', err.message)
      return NextResponse.json({ error: 'Muitas requisições agora. Tente novamente em instantes.' }, { status: 500 })
    }
    if (err instanceof Anthropic.BadRequestError) {
      // Covers e.g. "credit balance too low" — surfaces as invalid_request_error from Anthropic.
      console.error('chat: Anthropic bad request —', err.status, err.message)
      return NextResponse.json(
        { error: 'A Anthropic recusou a requisição (verifique créditos/billing da conta).' },
        { status: 500 }
      )
    }
    if (err instanceof Anthropic.APIError) {
      console.error('chat: Anthropic API error —', err.status, err.message)
      return NextResponse.json({ error: 'Falha ao gerar resposta do coach.' }, { status: 500 })
    }
    console.error('chat: unexpected error', err)
    return NextResponse.json({ error: 'Falha ao gerar resposta do coach.' }, { status: 500 })
  }
}
