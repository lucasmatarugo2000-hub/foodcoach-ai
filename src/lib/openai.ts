import OpenAI from 'openai'

let client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

export function extractJson<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  try {
    return JSON.parse(cleaned) as T
  } catch {
    // The model sometimes wraps the JSON in prose ("Aqui está o JSON:\n{...}\nEspero que ajude!").
    // Fall back to pulling out the first {...} block found anywhere in the text.
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Nenhum JSON válido encontrado na resposta do modelo')
    return JSON.parse(match[0]) as T
  }
}
