import { NextResponse } from 'next/server'
import { getOpenAIClient, extractJson } from '@/lib/openai'
import { createClient } from '@/lib/supabase/server'
import type { ReadDietResult } from '@/types'

export const runtime = 'nodejs'

interface ReadDietRequest {
  image: string
  mediaType?: string
}

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
      return NextResponse.json({ error: 'Sem resposta do modelo' }, { status: 502 })
    }

    const result = extractJson<ReadDietResult>(raw)

    if (result.error === 'not_a_diet') {
      return NextResponse.json(result, { status: 422 })
    }

    await supabase.from('diet_plans').update({ is_active: false }).eq('user_id', user.id).eq('is_active', true)

    const { error: insertError } = await supabase.from('diet_plans').insert({
      user_id: user.id,
      raw_text: null,
      meals_json: result,
      is_active: true,
    })

    if (insertError) {
      console.error('diet_plans insert error', insertError)
      return NextResponse.json({ error: 'Falha ao salvar a dieta' }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('read-diet error', err)
    return NextResponse.json({ error: 'Falha ao ler a dieta' }, { status: 500 })
  }
}
