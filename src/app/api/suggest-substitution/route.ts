import { NextResponse } from 'next/server'
import { getAnthropicClient, CLAUDE_MODEL } from '@/lib/anthropic'
import { extractJson } from '@/lib/openai'
import { createClient } from '@/lib/supabase/server'
import type { SuggestSubstitutionResult } from '@/types'

export const runtime = 'nodejs'

interface SuggestSubstitutionRequest {
  prescribed_meal: string
  eaten_food: string
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: SuggestSubstitutionRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.prescribed_meal || !body.eaten_food) {
    return NextResponse.json({ error: 'prescribed_meal e eaten_food são obrigatórios' }, { status: 400 })
  }

  try {
    const anthropic = getAnthropicClient()
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Use os valores nutricionais da TACO — Tabela Brasileira de Composição de Alimentos (UNICAMP, 4ª edição) — como referência. Sugira substitutos presentes na alimentação brasileira típica com valores registrados na TACO. Mencione os valores calóricos e de macros de cada substituto conforme a TACO.

Refeição prescrita: ${body.prescribed_meal}. Usuário quer substituir: ${body.eaten_food}. Sugira 3 substituições que: 1) tenham calorias similares (±10%), 2) sejam acessíveis no Brasil, 3) se encaixem no mesmo horário. Retorne APENAS JSON: { "substitutions": [ { "name": string, "quantity": string, "calories": number, "reason": string } ] }`,
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const raw = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    const result = extractJson<SuggestSubstitutionResult>(raw)

    return NextResponse.json(result)
  } catch (err) {
    console.error('suggest-substitution error', err)
    return NextResponse.json({ error: 'Falha ao sugerir substituições' }, { status: 500 })
  }
}
