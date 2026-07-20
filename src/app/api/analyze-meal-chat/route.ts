import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { getOpenAIClient, extractJson } from '@/lib/openai'
import { getAnthropicClient, CLAUDE_MODEL } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import { getCoachPersonaPrompt } from '@/lib/coach'
import { currentMealType } from '@/lib/dietComparison'
import type { AnalyzeMealResult, UserProfile } from '@/types'

export const runtime = 'nodejs'

interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

interface AnalyzeMealChatRequest {
  image: string
  mediaType?: string
  conversationHistory?: ConversationTurn[]
}

const BILLING_ERROR_MESSAGE = 'Serviço de análise de refeição temporariamente indisponível. Entre em contato com o suporte.'
const GENERIC_ERROR_MESSAGE = 'Não foi possível analisar a foto agora. Tente novamente.'

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

  let body: AnalyzeMealChatRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.image) {
    return NextResponse.json({ error: 'Imagem obrigatória' }, { status: 400 })
  }

  const mediaType = body.mediaType ?? 'image/jpeg'
  const dataUrl = body.image.startsWith('data:') ? body.image : `data:${mediaType};base64,${body.image}`

  let analysis: AnalyzeMealResult
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
    if (!raw) return NextResponse.json({ error: 'Sem resposta do modelo' }, { status: 502 })
    analysis = extractJson<AnalyzeMealResult>(raw)
  } catch (err) {
    if (err instanceof OpenAI.RateLimitError || err instanceof OpenAI.PermissionDeniedError || err instanceof OpenAI.AuthenticationError) {
      console.error('analyze-meal-chat: OpenAI billing/auth error —', err.status, err.code, err.message)
      return NextResponse.json({ error: BILLING_ERROR_MESSAGE }, { status: 500 })
    }
    console.error('analyze-meal-chat: OpenAI/parse error', err)
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 })
  }

  let photoUrl: string | null = null
  try {
    const buffer = Buffer.from(base64Payload(dataUrl), 'base64')
    const path = `${user.id}/${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('meal-photos')
      .upload(path, buffer, { contentType: mediaType })
    if (uploadError) {
      console.error('analyze-meal-chat: photo upload error', uploadError)
    } else {
      const { data: pub } = supabase.storage.from('meal-photos').getPublicUrl(path)
      photoUrl = pub.publicUrl
    }
  } catch (err) {
    console.error('analyze-meal-chat: photo upload exception', err)
  }

  const mealType = currentMealType()
  const { data: savedMeal, error: insertError } = await supabase
    .from('meals')
    .insert({
      user_id: user.id,
      photo_url: photoUrl,
      food_name: analysis.food_name,
      calories: analysis.calories,
      protein: analysis.protein,
      carbs: analysis.carbs,
      fat: analysis.fat,
      meal_type: mealType,
      confirmed: true,
    })
    .select()
    .single()

  if (insertError || !savedMeal) {
    console.error('analyze-meal-chat: meals insert error', insertError)
    return NextResponse.json({ error: 'Falha ao salvar a refeição' }, { status: 500 })
  }

  const mealSummary = `Acabei de registrar uma refeição via foto: ${analysis.food_name}, aproximadamente ${analysis.calories} kcal (proteína ${analysis.protein}g, carboidratos ${analysis.carbs}g, gordura ${analysis.fat}g).`
  let kaiMessage = `Vi que você comeu ${analysis.food_name}! São aproximadamente ${analysis.calories} kcal (proteína ${analysis.protein}g, carboidratos ${analysis.carbs}g, gordura ${analysis.fat}g).`

  try {
    const { data: profile } = await supabase
      .from('users_profile')
      .select('*')
      .eq('id', user.id)
      .maybeSingle<UserProfile>()

    const history: ConversationTurn[] = []
    for (const turn of (body.conversationHistory ?? []).slice(-30)) {
      const role: 'user' | 'assistant' = turn.role === 'user' ? 'user' : 'assistant'
      const last = history[history.length - 1]
      if (last && last.role === role) {
        last.content += `\n${turn.content}`
      } else {
        history.push({ role, content: turn.content })
      }
    }
    if (history[history.length - 1]?.role === 'user') {
      history[history.length - 1]!.content += `\n${mealSummary}`
    } else {
      history.push({ role: 'user', content: mealSummary })
    }

    const systemPrompt = `${getCoachPersonaPrompt(profile?.gender ?? null)}

O usuário acabou de registrar uma refeição por meio de uma foto no chat. Comente de forma breve, natural e encorajadora sobre a refeição identificada — sem julgar, apenas contextualizando os números.`

    const anthropic = getAnthropicClient()
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: history,
    })
    const textBlock = response.content.find((b) => b.type === 'text')
    if (textBlock && textBlock.type === 'text' && textBlock.text) {
      kaiMessage = textBlock.text
    }
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error('analyze-meal-chat: Anthropic error, using fallback comment —', err.status, err.message)
    } else {
      console.error('analyze-meal-chat: unexpected error building Kai comment, using fallback', err)
    }
  }

  return NextResponse.json({ analysis, meal: savedMeal, message: kaiMessage })
}
