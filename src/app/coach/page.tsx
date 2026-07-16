'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { currentMealType } from '@/lib/dietComparison'
import { greetingPrefix, displayNameFromEmail } from '@/lib/format'
import KaiAvatar from '@/components/KaiAvatar'
import ChatBubble from '@/components/ChatBubble'
import SubstitutionCard from '@/components/SubstitutionCard'
import BottomNav from '@/components/BottomNav'
import ThemeToggle from '@/components/ThemeToggle'
import type { CoachMessage, CoachSender, DietMealsJson, KaiState, Substitution } from '@/types'

type ChatItem =
  | { kind: 'message'; id: string; sender: CoachSender; message: string; createdAt: string }
  | { kind: 'substitutions'; id: string; items: Substitution[] }

function isSubstitutionRequest(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes('substituir') || lower.includes('no lugar de')
}

export default function CoachPage() {
  const supabase = createClient()
  const [items, setItems] = useState<ChatItem[]>([])
  const [input, setInput] = useState('')
  const [kaiState, setKaiState] = useState<KaiState>('idle')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [dietPlan, setDietPlan] = useState<DietMealsJson | null>(null)
  const [name, setName] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      setName(displayNameFromEmail(user.email))

      const [{ data: messages }, { data: diet }] = await Promise.all([
        supabase
          .from('coach_messages')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(50),
        supabase
          .from('diet_plans')
          .select('meals_json')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle<{ meals_json: DietMealsJson }>(),
      ])

      setItems(
        (messages ?? []).map((m: CoachMessage) => ({
          kind: 'message',
          id: m.id,
          sender: m.sender,
          message: m.message,
          createdAt: m.created_at,
        }))
      )
      setDietPlan(diet?.meals_json ?? null)
      setLoading(false)
    }
    load()
  }, [supabase])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [items, kaiState])

  function talkThenIdle() {
    setKaiState('talking')
    setTimeout(() => setKaiState('idle'), 3000)
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)

    const userItem: ChatItem = {
      kind: 'message',
      id: `local-${Date.now()}`,
      sender: 'user',
      message: text,
      createdAt: new Date().toISOString(),
    }
    setItems((prev) => [...prev, userItem])
    setKaiState('thinking')

    try {
      if (isSubstitutionRequest(text)) {
        const mealType = currentMealType()
        const prescribed = dietPlan?.meals.find((m) => m.meal_type === mealType)
        const prescribedMeal = prescribed
          ? prescribed.foods.map((f) => `${f.name} ${f.quantity}`).join(', ')
          : 'sua refeição atual'

        const res = await fetch('/api/suggest-substitution', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prescribed_meal: prescribedMeal, eaten_food: text }),
        })
        const data = await res.json()
        const substitutions: Substitution[] = data.substitutions ?? []

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          await supabase.from('coach_messages').insert({
            user_id: user.id,
            message: text,
            type: 'substitution',
            sender: 'user',
          })
          const summary = substitutions
            .map((s) => `${s.name} (${s.quantity}) — ${s.calories} kcal: ${s.reason}`)
            .join('\n')
          await supabase.from('coach_messages').insert({
            user_id: user.id,
            message: summary || 'Não encontrei boas substituições agora — pode tentar detalhar mais?',
            type: 'substitution',
            sender: 'kai',
          })
        }

        setItems((prev) => [
          ...prev,
          { kind: 'substitutions', id: `sub-${Date.now()}`, items: substitutions },
        ])
        talkThenIdle()
      } else {
        const res = await fetch('/api/coach-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_message: text }),
        })
        const data = await res.json()
        if (!res.ok) {
          console.error('coach-message request failed', res.status, data)
          throw new Error(data?.error ?? 'coach-message request failed')
        }
        setItems((prev) => [
          ...prev,
          {
            kind: 'message',
            id: data.id ?? `kai-${Date.now()}`,
            sender: 'kai',
            message: data.message,
            createdAt: new Date().toISOString(),
          },
        ])
        talkThenIdle()
      }
    } catch (err) {
      console.error('coach chat error', err)
      const isApiError = err instanceof Error && err.message !== 'coach-message request failed'
      setItems((prev) => [
        ...prev,
        {
          kind: 'message',
          id: `err-${Date.now()}`,
          sender: 'kai',
          message: isApiError
            ? `Não consegui responder: ${(err as Error).message}`
            : 'Tive um problema para responder agora. Pode tentar de novo?',
          createdAt: new Date().toISOString(),
        },
      ])
      setKaiState('idle')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc] pb-24 dark:bg-background">
      <ThemeToggle className="fixed right-4 top-4 z-50" />
      <div className="flex flex-col items-center px-4 pb-2 pt-8">
        <KaiAvatar state={kaiState} size={148} />
        <h2 className="mt-4 text-lg font-bold">
          {greetingPrefix()}
          {name ? `, ${name}` : ''}!
        </h2>
        <p className="text-sm text-white/50">Como posso te ajudar hoje?</p>
      </div>

      <div ref={scrollRef} className="mt-4 flex-1 space-y-3 overflow-y-auto px-4">
        {loading ? (
          <p className="text-center text-sm text-white/40">Carregando conversa...</p>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-white/40">
            Diga oi para o Kai e comece a conversar sobre sua alimentação.
          </p>
        ) : (
          items.map((item) =>
            item.kind === 'message' ? (
              <ChatBubble key={item.id} sender={item.sender} message={item.message} timestamp={item.createdAt} />
            ) : (
              <div key={item.id} className="flex justify-start">
                <div className="w-[85%]">
                  <SubstitutionCard substitutions={item.items} />
                </div>
              </div>
            )
          )
        )}
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-border bg-[#f8fafc] px-4 py-3 dark:bg-background">
        <div className="mx-auto flex max-w-md gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Fale com o Kai..."
            className="flex-1 rounded-xl px-4 py-3 outline-none focus:border-primary"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="rounded-xl bg-primary px-5 font-semibold text-black disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
