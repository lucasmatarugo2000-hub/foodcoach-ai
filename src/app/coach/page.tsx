'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, CheckCircle2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { currentMealType } from '@/lib/dietComparison'
import { greetingPrefix, displayNameFromEmail } from '@/lib/format'
import { getCoachInfo } from '@/lib/coach'
import { requireSession } from '@/lib/requireSession'
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
  | { kind: 'photo'; id: string; photoUrl: string; caption: string }

interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

function isSubstitutionRequest(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes('substituir') || lower.includes('no lugar de')
}

/** Builds the Claude-facing history from local chat state — text messages and
 * photo turns count, substitution cards / confirmation pills don't. */
function itemsToHistory(items: ChatItem[]): ConversationTurn[] {
  const turns: ConversationTurn[] = []
  for (const item of items) {
    if (item.kind === 'message') {
      turns.push({ role: item.sender === 'user' ? 'user' : 'assistant', content: item.message })
    } else if (item.kind === 'photo') {
      turns.push({ role: 'user', content: item.caption })
    }
  }
  return turns
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
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null)
  const [sendingPhoto, setSendingPhoto] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
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

    const session = await requireSession(supabase)
    if (!session) {
      router.push('/login')
      return
    }
    const user = session.user

    setInput('')
    setSending(true)

    const conversationHistory = itemsToHistory(items)

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

        // Persist the user's message before calling the API so it survives
        // even if suggest-substitution subsequently fails.
        const { error: userInsertError } = await supabase.from('coach_messages').insert({
          user_id: user.id,
          message: text,
          type: 'substitution',
          sender: 'user',
          role: 'user',
        })
        if (userInsertError) console.error('coach_messages user insert error', userInsertError)

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

        const res = await fetch('/api/suggest-substitution', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prescribed_meal: prescribedMeal, eaten_food: text }),
        })
        const data = await res.json()
        const substitutions: Substitution[] = data.substitutions ?? []

        const summary = substitutions
          .map((s) => `${s.name} (${s.quantity}) — ${s.calories} kcal: ${s.reason}`)
          .join('\n')
        const { error: kaiInsertError } = await supabase.from('coach_messages').insert({
          user_id: user.id,
          message: summary || 'Não encontrei boas substituições agora — pode tentar detalhar mais?',
          type: 'substitution',
          sender: 'kai',
          role: 'assistant',
        })
        if (kaiInsertError) console.error('coach_messages kai insert error', kaiInsertError)

        setItems((prev) => [...prev, { kind: 'substitutions', id: `sub-${Date.now()}`, items: substitutions }])
        talkThenIdle()

        const extraction = await extractionPromise
        if ((extraction?.extracted || extraction?.success) && extraction.message) {
          setItems((prev) => [
            ...prev,
            { kind: 'health_confirmation', id: `health-${Date.now()}`, message: extraction.message as string },
          ])
          router.refresh()
        }
      } else {
        // Persist the user's message before calling the API so it survives
        // even if the downstream Claude call subsequently fails.
        const { data: userRow, error: userInsertError } = await supabase
          .from('coach_messages')
          .insert({
            user_id: user.id,
            message: text,
            type: 'comment',
            sender: 'user',
            role: 'user',
          })
          .select()
          .single()
        if (userInsertError) {
          console.error('coach_messages user insert error', userInsertError)
        } else if (userRow) {
          setItems((prev) => prev.map((item) => (item.id === userItem.id ? { ...item, id: userRow.id } : item)))
        }

        const res = await fetch('/api/coach-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_message: text, conversationHistory }),
        })
        const data = await res.json()
        if (!res.ok) {
          console.error('coach-message request failed', res.status, data)
          throw new Error(data?.error ?? 'coach-message request failed')
        }

        const { data: kaiRow, error: kaiInsertError } = await supabase
          .from('coach_messages')
          .insert({
            user_id: user.id,
            message: data.message,
            type: 'comment',
            sender: 'kai',
            role: 'assistant',
          })
          .select()
          .single()
        if (kaiInsertError) console.error('coach_messages kai insert error', kaiInsertError)

        setItems((prev) => [
          ...prev,
          {
            kind: 'message',
            id: kaiRow?.id ?? `kai-${Date.now()}`,
            sender: 'kai',
            message: data.message,
            createdAt: new Date().toISOString(),
          },
        ])
        talkThenIdle()

        if (data.healthDataSaved && Array.isArray(data.savedFields) && data.savedFields.length > 0) {
          setItems((prev) => [
            ...prev,
            {
              kind: 'health_confirmation',
              id: `health-${Date.now()}`,
              message: `Dados salvos: ${data.savedFields.join(', ')}`,
            },
          ])
        }
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

  function handlePhotoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPendingPhoto(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function sendPhoto() {
    if (!pendingPhoto || sendingPhoto) return

    const session = await requireSession(supabase)
    if (!session) {
      router.push('/login')
      return
    }

    const photoDataUrl = pendingPhoto
    setPendingPhoto(null)
    setSendingPhoto(true)
    setSending(true)
    setKaiState('thinking')

    const conversationHistory = itemsToHistory(items)
    const photoItemId = `photo-${Date.now()}`
    setItems((prev) => [
      ...prev,
      { kind: 'photo', id: photoItemId, photoUrl: photoDataUrl, caption: '[Foto de refeição enviada]' },
    ])

    try {
      const res = await fetch('/api/analyze-meal-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photoDataUrl, conversationHistory }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('analyze-meal-chat request failed', res.status, data)
        throw new Error(data?.error ?? 'analyze-meal-chat request failed')
      }

      await supabase.from('coach_messages').insert({
        user_id: session.user.id,
        message: '[Foto de refeição enviada]',
        type: 'comment',
        sender: 'user',
        role: 'user',
      })
      const { data: kaiRow } = await supabase
        .from('coach_messages')
        .insert({
          user_id: session.user.id,
          message: data.message,
          type: 'comment',
          sender: 'kai',
          role: 'assistant',
        })
        .select()
        .single()

      setItems((prev) => [
        ...prev,
        {
          kind: 'message',
          id: kaiRow?.id ?? `kai-${Date.now()}`,
          sender: 'kai',
          message: data.message,
          createdAt: new Date().toISOString(),
        },
      ])
      talkThenIdle()
      router.refresh()
    } catch (err) {
      console.error('sendPhoto error', err)
      setItems((prev) => [
        ...prev,
        {
          kind: 'message',
          id: `err-${Date.now()}`,
          sender: 'kai',
          message: 'Não consegui analisar essa foto agora. Pode tentar de novo?',
          createdAt: new Date().toISOString(),
        },
      ])
      setKaiState('idle')
    } finally {
      setSendingPhoto(false)
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
          items.map((item) => {
            if (item.kind === 'message') {
              return <ChatBubble key={item.id} sender={item.sender} message={item.message} timestamp={item.createdAt} />
            }
            if (item.kind === 'substitutions') {
              return (
                <div key={item.id} className="flex justify-start">
                  <div className="w-[85%]">
                    <SubstitutionCard substitutions={item.items} />
                  </div>
                </div>
              )
            }
            if (item.kind === 'photo') {
              return (
                <div key={item.id} className="flex justify-end">
                  <div className="h-24 w-24 overflow-hidden rounded-2xl border border-border shadow-md shadow-black/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.photoUrl} alt="Foto da refeição enviada" className="h-full w-full object-cover" />
                  </div>
                </div>
              )
            }
            return (
              <div key={item.id} className="flex justify-start">
                <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>{item.message}</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="shrink-0 border-t border-border bg-[#f8fafc] px-4 py-3 dark:bg-background">
        {pendingPhoto && (
          <div className="mx-auto mb-3 flex max-w-md items-center gap-3 rounded-xl border border-border bg-card p-2">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingPhoto} alt="Prévia da foto" className="h-full w-full object-cover" />
            </div>
            <p className="flex-1 text-xs text-white/60">Foto pronta para envio</p>
            <button
              type="button"
              onClick={() => setPendingPhoto(null)}
              aria-label="Cancelar foto"
              className="rounded-lg p-1.5 text-white/50 hover:text-danger"
            >
              <X size={16} />
            </button>
            <button
              type="button"
              onClick={sendPhoto}
              disabled={sendingPhoto}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
            >
              {sendingPhoto ? 'Enviando...' : 'Enviar foto'}
            </button>
          </div>
        )}
        <div className="mx-auto flex max-w-md gap-2">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoChosen}
          />
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={sending}
            aria-label="Tirar foto da refeição"
            className="shrink-0 rounded-xl border border-border px-3 text-white/70 disabled:opacity-40"
          >
            <Camera size={20} />
          </button>
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
