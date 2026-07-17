'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { currentMealType } from '@/lib/dietComparison'
import { greetingPrefix, displayNameFromEmail } from '@/lib/format'
import { getCoachInfo } from '@/lib/coach'
import ChatBubble from '@/components/ChatBubble'
import SubstitutionCard from '@/components/SubstitutionCard'
import BottomNav from '@/components/BottomNav'
import ThemeToggle from '@/components/ThemeToggle'
import type {
  CoachMessage,
  CoachSender,
  DietMealsJson,
  ExtractHealthDataResult,
  Gender,
  KaiState,
  Substitution,
} from '@/types'

type ChatItem =
  | { kind: 'message'; id: string; sender: CoachSender; message: string; createdAt: string }
  | { kind: 'substitutions'; id: string; items: Substitution[] }
  | { kind: 'health_confirmation'; id: string; message: string }

function isSubstitutionRequest(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes('substituir') || lower.includes('no lugar de')
}

export default function CoachPage() {
  const router = useRouter()
  const supabase = createClient()
  const [items, setItems] = useState<ChatItem[]>([])
  const [input, setInput] = useState('')
  const [kaiState, setKaiState] = useState<KaiState>('idle')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [dietPlan, setDietPlan] = useState<DietMealsJson | null>(null)
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const coach = getCoachInfo(gender)
  const CoachAvatar = coach.avatar

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

      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)

      const [{ data: messages }, { data: diet }, { data: profile }] = await Promise.all([
        supabase
          .from('coach_messages')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', startOfDay.toISOString())
          .order('created_at', { ascending: true }),
        supabase
          .from('diet_plans')
          .select('meals_json')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle<{ meals_json: DietMealsJson }>(),
        supabase.from('users_profile').select('gender').eq('id', user.id).maybeSingle<{ gender: Gender | null }>(),
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
      setGender(profile?.gender ?? null)
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

    const extractionPromise = fetch('/api/extract-health-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    })
      .then((res) => (res.ok ? (res.json() as Promise<ExtractHealthDataResult>) : null))
      .catch((err) => {
        console.error('extract-health-data request failed', err)
        return null
      })

    try {
      if (isSubstitutionRequest(text)) {
        const mealType = currentMealType()
        const prescribed = dietPlan?.meals.find((m) => m.meal_type === mealType)
        const prescribedMeal = prescribed
          ? prescribed.foods.map((f) => `${f.name} ${f.quantity}`).join(', ')
          : 'sua refeição atual'

        const {
          data: { user },
        } = await supabase.auth.getUser()

        // Persist the user's message before calling the API so it survives
        // even if suggest-substitution subsequently fails.
        if (user) {
          await supabase.from('coach_messages').insert({
            user_id: user.id,
            message: text,
            type: 'substitution',
            sender: 'user',
            role: 'user',
          })
        }

        const res = await fetch('/api/suggest-substitution', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prescribed_meal: prescribedMeal, eaten_food: text }),
        })
        const data = await res.json()
        const substitutions: Substitution[] = data.substitutions ?? []

        if (user) {
          const summary = substitutions
            .map((s) => `${s.name} (${s.quantity}) — ${s.calories} kcal: ${s.reason}`)
            .join('\n')
          await supabase.from('coach_messages').insert({
            user_id: user.id,
            message: summary || 'Não encontrei boas substituições agora — pode tentar detalhar mais?',
            type: 'substitution',
            sender: 'kai',
            role: 'assistant',
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
        router.refresh()
      }

      const extraction = await extractionPromise
      if ((extraction?.extracted || extraction?.success) && extraction.message) {
        setItems((prev) => [
          ...prev,
          { kind: 'health_confirmation', id: `health-${Date.now()}`, message: extraction.message as string },
        ])
        router.refresh()
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
    <div className="flex h-screen flex-col overflow-hidden bg-[#f8fafc] pb-16 dark:bg-background">
      <ThemeToggle className="fixed right-4 top-4 z-50" />
      <div
        className="shrink-0 flex flex-col items-center rounded-b-3xl px-4 pb-6 pt-10"
        style={{ background: 'linear-gradient(90deg, rgb(var(--color-primary)) 0%, rgb(var(--color-secondary)) 100%)' }}
      >
        <div className="relative h-[154px] w-[154px]">
          <div className="absolute inset-0 animate-spin-slow rounded-full gradient-ring" />
          <div className="absolute inset-[3px] rounded-full bg-card" />
          <div className="absolute inset-0 flex items-center justify-center">
            <CoachAvatar state={kaiState} size={138} />
          </div>
        </div>
        <h2 className="mt-4 text-lg font-extrabold tracking-tight text-[#ffffff]">
          {greetingPrefix()}
          {name ? `, ${name}` : ''}!
        </h2>
        <p className="text-sm text-[#ffffff]/80">Como posso te ajudar hoje?</p>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-center text-sm text-white/40">Carregando conversa...</p>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-white/40">
            Diga oi para {coach.name === 'Luna' ? 'a Luna' : 'o Kai'} e comece a conversar sobre sua alimentação.
          </p>
        ) : (
          items.map((item) =>
            item.kind === 'message' ? (
              <ChatBubble key={item.id} sender={item.sender} message={item.message} timestamp={item.createdAt} />
            ) : item.kind === 'substitutions' ? (
              <div key={item.id} className="flex justify-start">
                <div className="w-[85%]">
                  <SubstitutionCard substitutions={item.items} />
                </div>
              </div>
            ) : (
              <div key={item.id} className="flex justify-start">
                <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>{item.message}</span>
                </div>
              </div>
            )
          )
        )}
      </div>

      <div className="shrink-0 border-t border-border bg-[#f8fafc] px-4 py-3 dark:bg-background">
        <div className="mx-auto flex max-w-md gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Fale com ${coach.name === 'Luna' ? 'a' : 'o'} ${coach.name}...`}
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
