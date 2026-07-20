'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, CheckCircle2, Droplet, Dumbbell, Moon, Scale, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { currentMealType } from '@/lib/dietComparison'
import { greetingPrefix, displayNameFromEmail } from '@/lib/format'
import { formatSleepHours } from '@/lib/health'
import { getCoachInfo } from '@/lib/coach'
import { requireSession } from '@/lib/requireSession'
import ChatBubble from '@/components/ChatBubble'
import SubstitutionCard from '@/components/SubstitutionCard'
import BottomNav from '@/components/BottomNav'
import ThemeToggle from '@/components/ThemeToggle'
import type { CoachMessage, CoachSender, DietMealsJson, Gender, KaiState, Substitution } from '@/types'

type ChatItem =
  | { kind: 'message'; id: string; sender: CoachSender; message: string; createdAt: string }
  | { kind: 'substitutions'; id: string; items: Substitution[] }
  | { kind: 'health_confirmation'; id: string; message: string }
  | { kind: 'photo'; id: string; photoUrl: string }

type QuickPromptKind = 'sono' | 'treino' | 'peso'

const QUICK_PROMPTS: Record<QuickPromptKind, string> = {
  sono: 'Que horas você dormiu e acordou?',
  treino: 'Que tipo de treino você fez e por quanto tempo?',
  peso: 'Qual é o seu peso atual?',
}

const WATER_QUICK_AMOUNTS = [200, 500, 1000] as const

function isSubstitutionRequest(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes('substituir') || lower.includes('no lugar de')
}

function buildWelcomeMessage(params: {
  name: string
  yesterdayCalories: number | null
  yesterdaySleepHours: number | null
  goalCalories: number | null
}): string {
  const parts = [`${greetingPrefix()}${params.name ? `, ${params.name}` : ''}!`]

  const yesterdayBits: string[] = []
  if (params.yesterdayCalories !== null) yesterdayBits.push(`você consumiu ${params.yesterdayCalories} kcal`)
  if (params.yesterdaySleepHours !== null) yesterdayBits.push(`dormiu ${formatSleepHours(params.yesterdaySleepHours)}`)
  if (yesterdayBits.length > 0) parts.push(`Ontem ${yesterdayBits.join(' e ')}.`)

  if (params.goalCalories) parts.push(`Hoje sua meta é ${params.goalCalories} kcal.`)

  const hour = new Date().getHours()
  parts.push(hour < 10 ? 'Como foi seu café da manhã?' : 'Como posso te ajudar hoje?')

  return parts.join(' ')
}

function ChipButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-white/80 transition disabled:opacity-40"
    >
      {icon}
      {label}
    </button>
  )
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
  const [gender, setGender] = useState<Gender | null>(null)
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null)
  const [showWaterQuick, setShowWaterQuick] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
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
      const displayName = displayNameFromEmail(user.email)

      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)

      const [{ data: messages }, { data: diet }, { data: profile }] = await Promise.all([
        supabase
          .from('coach_messages')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', startOfToday.toISOString())
          .order('created_at', { ascending: true }),
        supabase
          .from('diet_plans')
          .select('meals_json')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle<{ meals_json: DietMealsJson }>(),
        supabase
          .from('users_profile')
          .select('gender, daily_calories_goal')
          .eq('id', user.id)
          .maybeSingle<{ gender: Gender | null; daily_calories_goal: number | null }>(),
      ])

      setDietPlan(diet?.meals_json ?? null)
      setGender(profile?.gender ?? null)

      if ((messages ?? []).length === 0) {
        // First message of the day — greet with yesterday's context instead
        // of a blank screen.
        const startOfYesterday = new Date(startOfToday)
        startOfYesterday.setDate(startOfYesterday.getDate() - 1)
        const yesterdayKey = startOfYesterday.toISOString().slice(0, 10)

        const [{ data: yesterdayMeals }, { data: yesterdayLog }] = await Promise.all([
          supabase
            .from('meals')
            .select('calories')
            .eq('user_id', user.id)
            .gte('eaten_at', startOfYesterday.toISOString())
            .lt('eaten_at', startOfToday.toISOString()),
          supabase
            .from('health_logs')
            .select('sleep_hours')
            .eq('user_id', user.id)
            .eq('date', yesterdayKey)
            .maybeSingle<{ sleep_hours: number | null }>(),
        ])

        const yesterdayCalories = (yesterdayMeals ?? []).reduce((s, m) => s + (m.calories ?? 0), 0)

        const welcomeText = buildWelcomeMessage({
          name: displayName,
          yesterdayCalories: yesterdayCalories > 0 ? yesterdayCalories : null,
          yesterdaySleepHours: yesterdayLog?.sleep_hours ?? null,
          goalCalories: profile?.daily_calories_goal ?? null,
        })

        const { data: welcomeRow, error: welcomeError } = await supabase
          .from('coach_messages')
          .insert({ user_id: user.id, message: welcomeText, type: 'comment', sender: 'kai', role: 'assistant' })
          .select()
          .single()
        if (welcomeError) console.error('coach_messages welcome insert error', welcomeError)

        setItems([
          {
            kind: 'message',
            id: welcomeRow?.id ?? `welcome-${Date.now()}`,
            sender: 'kai',
            message: welcomeText,
            createdAt: new Date().toISOString(),
          },
        ])
      } else {
        setItems(
          (messages ?? []).map((m: CoachMessage) => ({
            kind: 'message',
            id: m.id,
            sender: m.sender,
            message: m.message,
            createdAt: m.created_at,
          }))
        )
      }

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

  async function sendMessage(rawText: string) {
    const text = rawText.trim()
    if (!text || sending) return

    const session = await requireSession(supabase)
    if (!session) {
      router.push('/login')
      return
    }
    const user = session.user

    setSending(true)
    setShowWaterQuick(false)
    setItems((prev) => [
      ...prev,
      { kind: 'message', id: `local-${Date.now()}`, sender: 'user', message: text, createdAt: new Date().toISOString() },
    ])
    setKaiState('thinking')

    try {
      if (isSubstitutionRequest(text)) {
        const mealType = currentMealType()
        const prescribed = dietPlan?.meals.find((m) => m.meal_type === mealType)
        const prescribedMeal = prescribed
          ? prescribed.foods.map((f) => `${f.name} ${f.quantity}`).join(', ')
          : 'sua refeição atual'

        // /api/suggest-substitution doesn't persist messages itself, so we
        // save the user's turn before calling it — resilient to failures.
        const { error: userInsertError } = await supabase.from('coach_messages').insert({
          user_id: user.id,
          message: text,
          type: 'substitution',
          sender: 'user',
          role: 'user',
        })
        if (userInsertError) console.error('coach_messages user insert error', userInsertError)

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
      } else {
        // /api/chat handles context, persistence (user + assistant turns) and
        // automatic data extraction/saving on its own — nothing to insert here.
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, userId: user.id }),
        })
        const data = await res.json()
        if (!res.ok) {
          console.error('chat request failed', res.status, data)
          throw new Error(data?.error ?? 'chat request failed')
        }

        setItems((prev) => [
          ...prev,
          { kind: 'message', id: `kai-${Date.now()}`, sender: 'kai', message: data.message, createdAt: new Date().toISOString() },
        ])
        talkThenIdle()

        if (data.healthDataSaved && Array.isArray(data.savedFields) && data.savedFields.length > 0) {
          setItems((prev) => [
            ...prev,
            { kind: 'health_confirmation', id: `health-${Date.now()}`, message: `Registrado: ${data.savedFields.join(', ')}` },
          ])
        }
        router.refresh()
      }
    } catch (err) {
      console.error('chat error', err)
      const isApiError = err instanceof Error && err.message !== 'chat request failed'
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

  function handleSend() {
    const text = input
    setInput('')
    sendMessage(text)
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
    if (!pendingPhoto || sending) return

    const session = await requireSession(supabase)
    if (!session) {
      router.push('/login')
      return
    }

    const photoDataUrl = pendingPhoto
    setPendingPhoto(null)
    setSending(true)
    setKaiState('thinking')
    setItems((prev) => [...prev, { kind: 'photo', id: `photo-${Date.now()}`, photoUrl: photoDataUrl }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: photoDataUrl, userId: session.user.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('chat (photo) request failed', res.status, data)
        throw new Error(data?.error ?? 'chat request failed')
      }

      setItems((prev) => [
        ...prev,
        { kind: 'message', id: `kai-${Date.now()}`, sender: 'kai', message: data.message, createdAt: new Date().toISOString() },
      ])
      talkThenIdle()

      if (data.healthDataSaved && Array.isArray(data.savedFields) && data.savedFields.length > 0) {
        setItems((prev) => [
          ...prev,
          { kind: 'health_confirmation', id: `health-${Date.now()}`, message: `Registrado: ${data.savedFields.join(', ')}` },
        ])
      }
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
      setSending(false)
    }
  }

  async function pushCannedKaiMessage(text: string) {
    talkThenIdle()
    setItems((prev) => [
      ...prev,
      { kind: 'message', id: `kai-${Date.now()}`, sender: 'kai', message: text, createdAt: new Date().toISOString() },
    ])
    const session = await requireSession(supabase)
    if (!session) return
    const { error } = await supabase
      .from('coach_messages')
      .insert({ user_id: session.user.id, message: text, type: 'comment', sender: 'kai', role: 'assistant' })
    if (error) console.error('coach_messages canned insert error', error)
  }

  function handleQuickChip(kind: 'foto' | 'agua' | QuickPromptKind) {
    if (sending) return
    if (kind === 'foto') {
      photoInputRef.current?.click()
      return
    }
    if (kind === 'agua') {
      setShowWaterQuick(true)
      pushCannedKaiMessage('Quantos ml você tomou?')
      return
    }
    pushCannedKaiMessage(QUICK_PROMPTS[kind])
    inputRef.current?.focus()
  }

  const coachLabel = coach.name === 'Luna' ? 'a Luna' : 'o Kai'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f8fafc] pb-16 dark:bg-background">
      <ThemeToggle className="fixed right-4 top-4 z-50" />

      <div className="shrink-0 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <div className="h-10 w-10 shrink-0">
          <CoachAvatar state={kaiState} size={40} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{coach.name}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Online
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-center text-sm text-white/40">Carregando conversa...</p>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-white/40">Diga oi para {coachLabel} e comece a conversar.</p>
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
              disabled={sending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
            >
              {sending ? 'Enviando...' : 'Enviar foto'}
            </button>
          </div>
        )}

        {showWaterQuick ? (
          <div className="mx-auto mb-2 flex max-w-md gap-2">
            {WATER_QUICK_AMOUNTS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => sendMessage(`Tomei ${amount}ml de água agora`)}
                disabled={sending}
                className="flex-1 rounded-lg border border-primary/40 py-2 text-xs font-semibold text-primary disabled:opacity-50"
              >
                {amount >= 1000 ? `${amount / 1000}L` : `${amount}ml`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowWaterQuick(false)}
              aria-label="Fechar opções de água"
              className="rounded-lg border border-border px-3 text-white/60"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="mx-auto mb-2 flex max-w-md gap-2 overflow-x-auto pb-1">
            <ChipButton icon={<Camera size={14} />} label="Foto" onClick={() => handleQuickChip('foto')} disabled={sending} />
            <ChipButton icon={<Droplet size={14} />} label="Água" onClick={() => handleQuickChip('agua')} disabled={sending} />
            <ChipButton icon={<Moon size={14} />} label="Sono" onClick={() => handleQuickChip('sono')} disabled={sending} />
            <ChipButton icon={<Dumbbell size={14} />} label="Treino" onClick={() => handleQuickChip('treino')} disabled={sending} />
            <ChipButton icon={<Scale size={14} />} label="Peso" onClick={() => handleQuickChip('peso')} disabled={sending} />
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
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Fale com ${coachLabel}...`}
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
