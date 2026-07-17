import OpenAI from 'openai'

let client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

export function extractJson<T>(raw: string): T {
  // Strip markdown fences anywhere in the text (not just at the very start/end —
  // the model sometimes wraps the fenced block in prose on both sides).
  const cleaned = raw
    .trim()
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  try {
    return JSON.parse(cleaned) as T
  } catch {
    // fall through to brace-extraction below
  }

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as T
    } catch {
      // fall through
    }
  }

  console.error('extractJson: failed to parse model output —', cleaned.slice(0, 500))
  throw new Error('Nenhum JSON válido encontrado na resposta do modelo')
}
