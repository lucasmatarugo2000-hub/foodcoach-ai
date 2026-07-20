import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runHealthExtraction } from '@/lib/healthExtraction'

export const runtime = 'nodejs'

interface ExtractHealthDataRequest {
  message: string
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

  const result = await runHealthExtraction(supabase, user.id, body.message)
  return NextResponse.json(result)
}
