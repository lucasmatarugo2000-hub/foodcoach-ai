'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { computeDietComparison, currentMealType } from '@/lib/dietComparison'
import { statusBadge } from '@/lib/format'
import ThemeToggle from '@/components/ThemeToggle'
import type { AnalyzeMealResult, DietMealsJson } from '@/types'

export default function NewMealPage() {
  const router = useRouter()
  const supabase = createClient()

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalyzeMealResult | null>(null)
  const [portionPct, setPortionPct] = useState(100)
  const [dietPlan, setDietPlan] = useState<DietMealsJson | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDiet() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('diet_plans')
        .select('meals_json')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle<{ meals_json: DietMealsJson }>()
      setDietPlan(data?.meals_json ?? null)
    }
    loadDiet()
  }, [supabase])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraReady(true)
    } catch {
      setCameraError('Não foi possível acessar a câmera. Use o upload de arquivo abaixo.')
      setCameraReady(false)
    }
  }, [])

  useEffect(() => {
    startCamera()
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [startCamera])

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    setPhoto(canvas.toDataURL('image/jpeg', 0.85))
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(reader.result as string)
    reader.readAsDataURL(file)
  }

  function retake() {
    setPhoto(null)
    setResult(null)
    setPortionPct(100)
    startCamera()
  }

  async function analyze() {
    if (!photo) return
    setAnalyzing(true)
    setError(null)
    try {
      const res = await fetch('/api/analyze-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photo }),
      })
      if (!res.ok) throw new Error()
      const data: AnalyzeMealResult = await res.json()
      setResult(data)
      setPortionPct(100)
    } catch {
      setError('Não foi possível analisar a foto. Tente novamente.')
    } finally {
      setAnalyzing(false)
    }
  }

  const adjusted: AnalyzeMealResult | null = result
    ? {
        ...result,
        calories: Math.round((result.calories * portionPct) / 100),
        protein: Math.round((result.protein * portionPct) / 100),
        carbs: Math.round((result.carbs * portionPct) / 100),
        fat: Math.round((result.fat * portionPct) / 100),
      }
    : null

  const mealType = currentMealType()
  const comparison = adjusted ? computeDietComparison(adjusted, mealType, dietPlan) : null

  async function confirm() {
    if (!adjusted) return
    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    let photoUrl: string | null = null
    if (photo) {
      try {
        const blob = await (await fetch(photo)).blob()
        const path = `${user.id}/${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('meal-photos')
          .upload(path, blob, { contentType: 'image/jpeg' })
        if (!uploadError) {
          const { data: pub } = supabase.storage.from('meal-photos').getPublicUrl(path)
          photoUrl = pub.publicUrl
        }
      } catch {
        photoUrl = null
      }
    }

    const { data: savedMeal, error: insertError } = await supabase
      .from('meals')
      .insert({
        user_id: user.id,
        photo_url: photoUrl,
        food_name: adjusted.food_name,
        calories: adjusted.calories,
        protein: adjusted.protein,
        carbs: adjusted.carbs,
        fat: adjusted.fat,
        meal_type: mealType,
        confirmed: true,
        diet_comparison: comparison,
      })
      .select()
      .single()

    if (insertError || !savedMeal) {
      setError('Não foi possível salvar a refeição.')
      setSaving(false)
      return
    }

    fetch('/api/coach-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meal_id: savedMeal.id,
        meal_data: {
          food_name: adjusted.food_name,
          calories: adjusted.calories,
          protein: adjusted.protein,
          carbs: adjusted.carbs,
          fat: adjusted.fat,
          meal_type: mealType,
        },
      }),
    }).catch((err) => console.error('coach-message (post-meal) failed', err))

    router.push('/home')
    router.refresh()
  }

  return (
    <div className="min-h-screen px-4 pb-10 pt-6">
      <ThemeToggle className="fixed right-4 top-4 z-50" />
      <h1 className="mb-4 text-xl font-bold">Registrar refeição</h1>

      {!photo && (
        <div>
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-card">
            {cameraReady ? (
              <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/50">
                {cameraError ?? 'Iniciando câmera...'}
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          <div className="mt-4 flex gap-3">
            <button
              onClick={capturePhoto}
              disabled={!cameraReady}
              className="flex-1 rounded-xl bg-primary py-3 font-semibold text-black disabled:opacity-40"
            >
              Capturar foto
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 rounded-xl border border-border py-3 font-semibold text-white/80"
            >
              Enviar arquivo
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {photo && (
        <div>
          <div className="aspect-square w-full overflow-hidden rounded-2xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="Foto da refeição" className="h-full w-full object-cover" />
          </div>

          {!result && (
            <div className="mt-4 flex gap-3">
              <button
                onClick={retake}
                className="flex-1 rounded-xl border border-border py-3 font-semibold text-white/80"
              >
                Tirar outra
              </button>
              <button
                onClick={analyze}
                disabled={analyzing}
                className="flex-1 rounded-xl bg-primary py-3 font-semibold text-black disabled:opacity-50"
              >
                {analyzing ? 'Analisando...' : 'Analisar'}
              </button>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-danger">{error}</p>}

          {adjusted && (
            <div className="mt-5 rounded-2xl border border-border bg-card p-4">
              <h2 className="text-lg font-semibold">{adjusted.food_name}</h2>
              <p className="mb-3 text-xs text-white/40">
                Confiança: {result?.confidence === 'high' ? 'alta' : result?.confidence === 'medium' ? 'média' : 'baixa'}
              </p>

              <div className="mb-4 grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold text-primary">{adjusted.calories}</div>
                  <div className="text-[10px] text-white/50">kcal</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{adjusted.protein}g</div>
                  <div className="text-[10px] text-white/50">proteína</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{adjusted.carbs}g</div>
                  <div className="text-[10px] text-white/50">carbo</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{adjusted.fat}g</div>
                  <div className="text-[10px] text-white/50">gordura</div>
                </div>
              </div>

              <label className="mb-1 block text-xs text-white/60">
                Ajustar porção: {portionPct}%
              </label>
              <input
                type="range"
                min={25}
                max={200}
                step={5}
                value={portionPct}
                onChange={(e) => setPortionPct(Number(e.target.value))}
                className="w-full accent-primary"
              />

              {comparison && comparison.status !== 'no_diet' && (
                <div className="mt-4 rounded-xl border border-border p-3">
                  <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                    {(() => {
                      const badge = statusBadge(comparison.status)
                      const BadgeIcon = badge.Icon
                      return <BadgeIcon size={18} style={{ color: badge.color }} />
                    })()}
                    <span>{statusBadge(comparison.status).label}</span>
                  </div>
                  <p className="text-xs text-white/60">Prescrito: {comparison.prescribed_meal}</p>
                  <p className="text-xs text-white/60">{comparison.notes}</p>
                </div>
              )}

              <div className="mt-5 flex gap-3">
                <button
                  onClick={retake}
                  className="flex-1 rounded-xl border border-border py-3 font-semibold text-white/80"
                >
                  Descartar
                </button>
                <button
                  onClick={confirm}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-primary py-3 font-semibold text-black disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
