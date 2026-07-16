import { NextResponse } from 'next/server'
import { getOpenAIClient, extractJson } from '@/lib/openai'
import { createClient } from '@/lib/supabase/server'
import type { ReadBioimpedanceResult } from '@/types'

export const runtime = 'nodejs'

interface ReadBioimpedanceRequest {
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

  let body: ReadBioimpedanceRequest
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
      max_tokens: 1200,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Você é especialista em leitura de laudos de bioimpedância. Extraia os dados do laudo. Retorne APENAS JSON válido sem markdown:
{ "date": string (YYYY-MM-DD), "weight": number, "body_fat_pct": number, "muscle_mass": number, "bone_mass": number, "water_pct": number, "visceral_fat": number, "bmr": number, "bmi": number, "raw_text": string }
Se algum campo não estiver no laudo, retorne null para aquele campo.
Se não for um laudo de bioimpedância, retorne { "error": "not_bioimpedance" }.`,
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

    const result = extractJson<ReadBioimpedanceResult>(raw)

    if (result.error === 'not_bioimpedance') {
      return NextResponse.json(result, { status: 422 })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('read-bioimpedance error', err)
    return NextResponse.json({ error: 'Falha ao ler o laudo' }, { status: 500 })
  }
}
