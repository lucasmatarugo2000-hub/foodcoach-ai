'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mealTypeLabel } from '@/lib/format'
import BottomNav from '@/components/BottomNav'
import ThemeToggle from '@/components/ThemeToggle'
import type { DietMealsJson } from '@/types'

export default function DietPage() {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dietId, setDietId] = useState<string | null>(null)
  const [diet, setDiet] = useState<DietMealsJson | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFile, setLastFile] = useState<File | null>(null)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('diet_plans')
        .select('id, meals_json')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle<{ id: string; meals_json: DietMealsJson }>()
      if (data) {
        setDietId(data.id)
        setDiet(data.meals_json)
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  function uploadFile(file: File) {
    setError(null)
    setSaved(false)
    const reader = new FileReader()
    reader.onload = async () => {
      setUploading(true)
      try {
        const res = await fetch('/api/read-diet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: reader.result, mediaType: file.type }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          console.error('read-diet request failed', res.status, body)
          if (body?.error === 'not_a_diet') {
            setError(
              body?.message ??
                'Não conseguimos identificar uma dieta neste arquivo. Tente enviar uma foto mais nítida ou um PDF diferente.'
            )
          } else {
            setError(body?.error ?? 'Não foi possível ler a dieta agora. Tente novamente.')
          }
          return
        }
        const result: DietMealsJson = await res.json()
        setDiet(result)
        setLastFile(null)

        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          const { data } = await supabase
            .from('diet_plans')
            .select('id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle<{ id: string }>()
          setDietId(data?.id ?? null)
        }
      } catch (err) {
        console.error('read-diet network error', err)
        setError('Não foi possível ler a dieta agora. Tente novamente.')
      } finally {
        setUploading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLastFile(file)
    uploadFile(file)
  }

  function retry() {
    if (lastFile) uploadFile(lastFile)
  }

  function updateFoodField(
    mealIdx: number,
    foodIdx: number,
    field: 'name' | 'quantity' | 'calories',
    value: string
  ) {
    if (!diet) return
    const next: DietMealsJson = structuredClone(diet)
    const meal = next.meals[mealIdx]
    const food = meal?.foods[foodIdx]
    if (!meal || !food) return
    if (field === 'calories') food.calories = Number(value) || 0
    else food[field] = value
    meal.total_calories = meal.foods.reduce((s, f) => s + f.calories, 0)
    next.daily_total_calories = next.meals.reduce((s, m) => s + m.total_calories, 0)
    setDiet(next)
    setSaved(false)
  }

  async function saveActiveDiet() {
    if (!diet || !dietId) return
    setSaving(true)
    const { error: updateError } = await supabase
      .from('diet_plans')
      .update({ meals_json: diet })
      .eq('id', dietId)
    setSaving(false)
    if (!updateError) setSaved(true)
  }

  return (
    <div className="min-h-screen px-4 pb-28 pt-6">
      <ThemeToggle className="fixed right-4 top-4 z-50" />
      <h1 className="mb-1 text-xl font-bold">Sua dieta</h1>
      <p className="mb-3 text-sm text-white/70">
        Sua dieta prescrita é usada pelo Kai para comparar suas refeições, sugerir substituições e acompanhar sua
        aderência ao plano alimentar.
      </p>
      <p className="mb-5 text-xs text-white/50">
        Sua dieta é usada como referência. O app não substitui acompanhamento profissional.
      </p>

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full rounded-xl bg-primary py-3 font-semibold text-black disabled:opacity-50"
      >
        {uploading ? 'Lendo dieta...' : 'Enviar PDF ou foto da dieta'}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && (
        <div className="mt-3 rounded-xl border border-danger/30 bg-danger/10 p-3">
          <p className="text-sm text-danger">{error}</p>
          {lastFile && (
            <button
              onClick={retry}
              disabled={uploading}
              className="mt-2 rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-50"
            >
              {uploading ? 'Tentando novamente...' : 'Tentar novamente'}
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-white/50">Carregando...</p>
      ) : diet ? (
        <div className="mt-6">
          <div className="mb-4 rounded-xl border border-border bg-card p-3 text-sm">
            <span className="text-white/60">Meta diária: </span>
            <span className="font-semibold text-primary">{diet.daily_total_calories} kcal</span>
            {diet.observations && <p className="mt-1 text-xs text-white/50">{diet.observations}</p>}
          </div>

          <div className="flex flex-col gap-4">
            {diet.meals.map((meal, mIdx) => (
              <div key={mIdx} className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold">{mealTypeLabel(meal.meal_type)}</h3>
                  <span className="text-xs text-white/50">{meal.time_reference}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {meal.foods.map((food, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-1.5">
                      <input
                        value={food.name}
                        onChange={(e) => updateFoodField(mIdx, fIdx, 'name', e.target.value)}
                        className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-sm"
                      />
                      <input
                        value={food.quantity}
                        onChange={(e) => updateFoodField(mIdx, fIdx, 'quantity', e.target.value)}
                        className="w-20 shrink-0 rounded-lg px-1.5 py-1.5 text-xs"
                      />
                      <input
                        type="number"
                        value={food.calories}
                        onChange={(e) => updateFoodField(mIdx, fIdx, 'calories', e.target.value)}
                        className="w-[60px] shrink-0 rounded-lg bg-primary/15 px-1 py-1.5 text-center text-xs font-semibold text-primary"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-right text-xs text-white/50">
                  Total: {meal.total_calories} kcal
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={saveActiveDiet}
            disabled={saving || !dietId}
            className="mt-6 w-full rounded-xl bg-primary py-3 font-semibold text-black disabled:opacity-50"
          >
            {saving ? 'Salvando...' : saved ? 'Dieta salva ✓' : 'Salvar dieta ativa'}
          </button>
        </div>
      ) : (
        <p className="mt-8 text-center text-sm text-white/50">
          Você ainda não tem uma dieta cadastrada.
        </p>
      )}

      <BottomNav />
    </div>
  )
}
