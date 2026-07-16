import { NextResponse } from 'next/server'
import { getOpenAIClient, extractJson } from '@/lib/openai'
import type { AnalyzeMealResult } from '@/types'

export const runtime = 'nodejs'

interface AnalyzeMealRequest {
  image: string
  mediaType?: string
}

export async function POST(request: Request) {
  let body: AnalyzeMealRequest
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
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analise esta foto de alimento. Para alimentos brasileiros típicos, use como referência os valores da TACO (Tabela Brasileira de Composição de Alimentos, UNICAMP, 4ª edição). Quando identificar arroz, feijão, frango, farofa, tapioca, açaí, cuscuz e outros alimentos típicos brasileiros, use os valores da TACO como base para estimar calorias e macros. Retorne APENAS JSON válido sem markdown:
{ "food_name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "portion": string, "confidence": "high"|"medium"|"low" }`,
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

    const result = extractJson<AnalyzeMealResult>(raw)
    return NextResponse.json(result)
  } catch (err) {
    console.error('analyze-meal error', err)
    return NextResponse.json({ error: 'Falha ao analisar a refeição' }, { status: 500 })
  }
}
