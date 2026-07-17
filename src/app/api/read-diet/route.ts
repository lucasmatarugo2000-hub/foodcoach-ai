import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getOpenAIClient, extractJson } from '@/lib/openai'
import { createClient } from '@/lib/supabase/server'
import type { ReadDietResult } from '@/types'

export const runtime = 'nodejs'

interface ReadDietRequest {
  image: string
  mediaType?: string
}

const BILLING_ERROR_MESSAGE = 'Serviço de leitura de dieta temporariamente indisponível. Entre em contato com o suporte.'
const NOT_A_DIET_MESSAGE =
  'Não conseguimos identificar uma dieta neste arquivo. Tente enviar uma foto mais nítida ou um PDF diferente.'
const GENERIC_ERROR_MESSAGE = 'Não foi possível ler a dieta agora. Tente novamente em instantes.'

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: ReadDietRequest
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

  try {
    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Você é especialista em leitura de dietas nutricionais. Analise este documento e extraia as refeições prescritas. Retorne APENAS JSON válido sem markdown:
{ "meals": [ { "meal_type": string, "time_reference": string, "foods": [ { "name": string, "quantity": string, "calories": number, "protein": number, "carbs": number, "fat": number } ], "total_calories": number } ], "daily_total_calories": number, "observations": string }
Use para meal_type: cafe_da_manha, lanche_manha, almoco, lanche_tarde, jantar, ceia.
Se calorias não estiverem explícitas, estime. Se não for uma dieta, retorne { "error": "not_a_diet" }.`,
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw) {
      console.error('read-diet: empty response from OpenAI', completion)
      return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 502 })
    }

    let result: ReadDietResult
    try {
      result = extractJson<ReadDietResult>(raw)
    } catch (parseErr) {
      console.error('read-diet: failed to parse model output as JSON —', parseErr, '\nraw output:', raw)
      return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 502 })
    }

    if (result.error === 'not_a_diet') {
      return NextResponse.json({ error: 'not_a_diet', message: NOT_A_DIET_MESSAGE }, { status: 422 })
    }

    await supabase.from('diet_plans').update({ is_active: false }).eq('user_id', user.id).eq('is_active', true)

    const { error: insertError } = await supabase.from('diet_plans').insert({
      user_id: user.id,
      raw_text: null,
      meals_json: result,
      is_active: true,
    })

    if (insertError) {
      console.error('read-diet: diet_plans insert error', insertError)
      return NextResponse.json({ error: 'Falha ao salvar a dieta' }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (err) {
    // Billing/quota issues surface as 429 (RateLimitError, e.g. "insufficient_quota")
    // or occasionally 403 (PermissionDeniedError) depending on the account restriction.
    if (err instanceof OpenAI.RateLimitError || err instanceof OpenAI.PermissionDeniedError) {
      console.error('read-diet: OpenAI billing/quota error —', err.status, err.code, err.message)
      return NextResponse.json({ error: BILLING_ERROR_MESSAGE }, { status: 500 })
    }
    if (err instanceof OpenAI.AuthenticationError) {
      console.error('read-diet: OpenAI authentication failed — check OPENAI_API_KEY', err.status, err.message)
      return NextResponse.json({ error: BILLING_ERROR_MESSAGE }, { status: 500 })
    }
    if (err instanceof OpenAI.APIError) {
      console.error('read-diet: OpenAI API error —', err.status, err.code, err.type, err.message)
      return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 })
    }
    console.error('read-diet: unexpected error', err)
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 })
  }
}
