'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Dumbbell, Scale, Leaf, User, Stethoscope, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import KaiAvatar from '@/components/KaiAvatar'
import ThemeToggle from '@/components/ThemeToggle'
import type { CoachingStyle, Goal, UserRole } from '@/types'

const GOALS: { value: Goal; label: string; Icon: LucideIcon }[] = [
  { value: 'lose_weight', label: 'Emagrecer', Icon: Zap },
  { value: 'gain_muscle', label: 'Ganhar massa', Icon: Dumbbell },
  { value: 'maintenance', label: 'Manutenção', Icon: Scale },
  { value: 'reeducation', label: 'Reeducação alimentar', Icon: Leaf },
]

const STYLES: { value: CoachingStyle; label: string; description: string }[] = [
  { value: 'direct', label: 'Direto', description: 'Feedback objetivo, sem rodeios.' },
  { value: 'gentle', label: 'Acolhedor', description: 'Tom gentil, encorajador e paciente.' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [welcomeState, setWelcomeState] = useState<'talking' | 'idle'>('talking')
  const [wantsDietUpload, setWantsDietUpload] = useState<boolean | null>(null)

  const [role, setRole] = useState<UserRole | null>(null)
  const [nutriNome, setNutriNome] = useState('')
  const [nutriCrn, setNutriCrn] = useState('')
  const [nutriClinic, setNutriClinic] = useState('')

  const [goal, setGoal] = useState<Goal | null>(null)
  const [currentWeight, setCurrentWeight] = useState('')
  const [targetWeight, setTargetWeight] = useState('')
  const [dailyCalories, setDailyCalories] = useState('')
  const [coachingStyle, setCoachingStyle] = useState<CoachingStyle | null>(null)

  useEffect(() => {
    if (step === 6) {
      setWelcomeState('talking')
      const t = setTimeout(() => setWelcomeState('idle'), 3000)
      return () => clearTimeout(t)
    }
  }, [step])

  const totalSteps = 7

  async function finishClient() {
    setSaving(true)
    setError(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { error: upsertError } = await supabase.from('users_profile').upsert({
      id: user.id,
      role: 'client',
      goal,
      current_weight: currentWeight ? Number(currentWeight) : null,
      target_weight: targetWeight ? Number(targetWeight) : null,
      daily_calories_goal: dailyCalories ? Number(dailyCalories) : null,
      coaching_style: coachingStyle,
      onboarding_completed: true,
    })

    setSaving(false)

    if (upsertError) {
      setError('Não foi possível salvar seu perfil. Tente novamente.')
      return
    }

    router.push(wantsDietUpload ? '/diet' : '/home')
    router.refresh()
  }

  async function finishNutritionist() {
    if (!nutriNome.trim()) return
    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { error: nutriError } = await supabase.from('nutritionists').upsert(
      {
        user_id: user.id,
        nome: nutriNome.trim(),
        crn: nutriCrn.trim() || null,
        clinic_name: nutriClinic.trim() || null,
      },
      { onConflict: 'user_id' }
    )

    if (nutriError) {
      setSaving(false)
      setError('Não foi possível salvar seus dados. Tente novamente.')
      return
    }

    const { error: profileError } = await supabase.from('users_profile').upsert({
      id: user.id,
      role: 'nutritionist',
      goal: null,
      coaching_style: 'gentle',
      onboarding_completed: true,
    })

    setSaving(false)

    if (profileError) {
      setError('Não foi possível salvar seu perfil. Tente novamente.')
      return
    }

    router.push('/nutri/dashboard')
    router.refresh()
  }

  function canAdvance() {
    if (step === 0) return role === 'client'
    if (step === 1) return goal !== null
    if (step === 2) return currentWeight !== '' && targetWeight !== ''
    if (step === 3) return dailyCalories !== ''
    if (step === 4) return coachingStyle !== null
    if (step === 5) return wantsDietUpload !== null
    return true
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      <ThemeToggle className="fixed right-4 top-4 z-50" />

      <div className="mb-8 flex gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-primary' : 'bg-border'}`}
          />
        ))}
      </div>

      <div className="flex-1">
        {step === 0 && (
          <div>
            <h2 className="mb-1 text-2xl font-bold">Você é nutricionista ou cliente?</h2>
            <p className="mb-6 text-sm text-white/60">Vamos personalizar sua experiência no FoodCoach AI.</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setRole('client')}
                className={`rounded-2xl border p-4 text-left transition ${
                  role === 'client' ? 'border-primary bg-primary/10' : 'border-border bg-card'
                }`}
              >
                <User size={26} className="mb-1 text-primary" />
                <div className="text-sm font-semibold">Sou cliente</div>
                <div className="text-xs text-white/60">Quero registrar refeições e acompanhar minha evolução.</div>
              </button>
              <button
                onClick={() => setRole('nutritionist')}
                className={`rounded-2xl border p-4 text-left transition ${
                  role === 'nutritionist' ? 'border-primary bg-primary/10' : 'border-border bg-card'
                }`}
              >
                <Stethoscope size={26} className="mb-1 text-primary" />
                <div className="text-sm font-semibold">Sou nutricionista</div>
                <div className="text-xs text-white/60">Quero acompanhar meus clientes e enviar recomendações.</div>
              </button>
            </div>

            {role === 'nutritionist' && (
              <div className="mt-6 flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-sm text-white/70">Nome completo</label>
                  <input
                    value={nutriNome}
                    onChange={(e) => setNutriNome(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 outline-none focus:border-primary"
                    placeholder="Seu nome"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-white/70">CRN</label>
                  <input
                    value={nutriCrn}
                    onChange={(e) => setNutriCrn(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 outline-none focus:border-primary"
                    placeholder="Ex: CRN-3 12345"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-white/70">Nome da clínica</label>
                  <input
                    value={nutriClinic}
                    onChange={(e) => setNutriClinic(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 outline-none focus:border-primary"
                    placeholder="Opcional"
                  />
                </div>
                {error && <p className="text-sm text-danger">{error}</p>}
                <button
                  onClick={finishNutritionist}
                  disabled={saving || !nutriNome.trim()}
                  className="mt-2 rounded-xl bg-primary py-3 font-semibold text-black disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Concluir cadastro'}
                </button>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="mb-1 text-2xl font-bold">Qual é o seu objetivo?</h2>
            <p className="mb-6 text-sm text-white/60">Vamos personalizar sua jornada.</p>
            <div className="grid grid-cols-2 gap-3">
              {GOALS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGoal(g.value)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    goal === g.value ? 'border-primary bg-primary/10' : 'border-border bg-card'
                  }`}
                >
                  <g.Icon size={26} className="mb-2 text-primary" />
                  <div className="text-sm font-medium">{g.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="mb-1 text-2xl font-bold">Peso atual e meta</h2>
            <p className="mb-6 text-sm text-white/60">Isso ajuda o Kai a acompanhar seu progresso.</p>
            <label className="mb-1 block text-sm text-white/70">Peso atual (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              value={currentWeight}
              onChange={(e) => setCurrentWeight(e.target.value)}
              className="mb-4 w-full rounded-xl px-4 py-3 outline-none focus:border-primary"
              placeholder="Ex: 78"
            />
            <label className="mb-1 block text-sm text-white/70">Peso meta (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              className="w-full rounded-xl px-4 py-3 outline-none focus:border-primary"
              placeholder="Ex: 72"
            />
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="mb-1 text-2xl font-bold">Meta calórica diária</h2>
            <p className="mb-6 text-sm text-white/60">
              Se não souber ao certo, uma estimativa está ótima — podemos ajustar depois.
            </p>
            <input
              type="number"
              inputMode="numeric"
              value={dailyCalories}
              onChange={(e) => setDailyCalories(e.target.value)}
              className="w-full rounded-xl px-4 py-3 outline-none focus:border-primary"
              placeholder="Ex: 2000"
            />
            <span className="mt-2 block text-xs text-white/40">kcal / dia</span>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="mb-1 text-2xl font-bold">Estilo de coaching</h2>
            <p className="mb-6 text-sm text-white/60">Como você prefere que o Kai converse com você?</p>
            <div className="flex flex-col gap-3">
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setCoachingStyle(s.value)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    coachingStyle === s.value ? 'border-primary bg-primary/10' : 'border-border bg-card'
                  }`}
                >
                  <div className="text-sm font-semibold">{s.label}</div>
                  <div className="text-xs text-white/60">{s.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h2 className="mb-1 text-2xl font-bold">Você tem uma dieta prescrita?</h2>
            <p className="mb-6 text-sm text-white/60">
              Se tiver, podemos usá-la como referência nas suas refeições.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setWantsDietUpload(true)}
                className={`rounded-2xl border p-4 text-left transition ${
                  wantsDietUpload === true ? 'border-primary bg-primary/10' : 'border-border bg-card'
                }`}
              >
                <div className="text-sm font-semibold">Enviar agora</div>
                <div className="text-xs text-white/60">Upload de PDF ou foto da dieta.</div>
              </button>
              <button
                onClick={() => setWantsDietUpload(false)}
                className={`rounded-2xl border p-4 text-left transition ${
                  wantsDietUpload === false ? 'border-primary bg-primary/10' : 'border-border bg-card'
                }`}
              >
                <div className="text-sm font-semibold">Pular por agora</div>
                <div className="text-xs text-white/60">Você pode adicionar depois em Dieta.</div>
              </button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="flex flex-col items-center pt-6 text-center">
            <KaiAvatar state={welcomeState} size={100} />
            <h2 className="mt-4 text-xl font-bold">Kai</h2>
            <p className="mx-auto mt-3 max-w-xs text-sm text-white/70">
              Olá! Sou o Kai, seu coach de alimentação. Estou aqui pra te acompanhar nessa jornada.
              Vamos começar?
            </p>
            {error && <p className="mt-4 text-sm text-danger">{error}</p>}
          </div>
        )}
      </div>

      {!(step === 0 && role === 'nutritionist') && (
        <div className="mt-8 flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 rounded-xl border border-border py-3 font-semibold text-white/80"
            >
              Voltar
            </button>
          )}
          {step < totalSteps - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance()}
              className="flex-1 rounded-xl bg-primary py-3 font-semibold text-black disabled:opacity-40"
            >
              Continuar
            </button>
          ) : (
            <button
              onClick={finishClient}
              disabled={saving}
              className="flex-1 rounded-xl bg-primary py-3 font-semibold text-black disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Vamos começar!'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
