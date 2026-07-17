'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import ThemeToggle from '@/components/ThemeToggle'
import NewDietModal from '@/components/diet/NewDietModal'
import DietCard from '@/components/diet/DietCard'
import CompareDiets from '@/components/diet/CompareDiets'
import type { DietPlan } from '@/types'

export default function DietPage() {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [diets, setDiets] = useState<DietPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewDietModal, setShowNewDietModal] = useState(false)
  const [pendingLabel, setPendingLabel] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFile, setLastFile] = useState<File | null>(null)
  const [showCompare, setShowCompare] = useState(false)

  async function loadDiets() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('diet_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .returns<DietPlan[]>()
    setDiets(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadDiets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function uploadFile(file: File, label: string) {
    setError(null)
    const reader = new FileReader()
    reader.onload = async () => {
      setUploading(true)
      try {
        const res = await fetch('/api/read-diet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: reader.result, mediaType: file.type, label }),
        })
        if (!res.ok) {
          const resBody = await res.json().catch(() => null)
          console.error('read-diet request failed', res.status, resBody)
          if (resBody?.error === 'not_a_diet') {
            setError(
              resBody?.message ??
                'Não conseguimos identificar uma dieta neste arquivo. Tente enviar uma foto mais nítida ou um PDF diferente.'
            )
          } else {
            setError(resBody?.error ?? 'Não foi possível ler a dieta agora. Tente novamente.')
          }
          return
        }
        await res.json()
        setLastFile(null)
        await loadDiets()
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
    uploadFile(file, pendingLabel)
  }

  function retry() {
    if (lastFile) uploadFile(lastFile, pendingLabel)
  }

  function confirmNewDietLabel(label: string) {
    setPendingLabel(label)
    setShowNewDietModal(false)
    fileInputRef.current?.click()
  }

  return (
    <div className="min-h-screen px-4 pb-28 pt-16">
      <ThemeToggle className="fixed right-4 top-4 z-50" />

      <div className="mb-1 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold">Minhas Dietas</h1>
        <button
          onClick={() => setShowNewDietModal(true)}
          disabled={uploading}
          className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {uploading ? (
            'Lendo dieta...'
          ) : (
            <>
              <span className="sm:hidden">+ Nova</span>
              <span className="hidden sm:inline">+ Nova Dieta</span>
            </>
          )}
        </button>
      </div>
      <p className="mb-3 text-sm text-white/70">
        Sua dieta prescrita é usada pelo Kai para comparar suas refeições, sugerir substituições e acompanhar sua
        aderência ao plano alimentar.
      </p>
      <p className="mb-5 text-xs text-white/50">
        Sua dieta é usada como referência. O app não substitui acompanhamento profissional.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 p-3">
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
      ) : diets.length === 0 ? (
        <p className="mt-8 text-center text-sm text-white/50">Você ainda não tem uma dieta cadastrada.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {diets.map((diet) => (
            <DietCard key={diet.id} diet={diet} onChanged={loadDiets} />
          ))}
        </div>
      )}

      {diets.length >= 2 && (
        <div className="mt-6">
          <button
            onClick={() => setShowCompare((v) => !v)}
            className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold text-white/80"
          >
            {showCompare ? 'Ocultar comparação' : 'Comparar dietas'}
          </button>
          {showCompare && (
            <div className="mt-3">
              <CompareDiets diets={diets} />
            </div>
          )}
        </div>
      )}

      {showNewDietModal && (
        <NewDietModal onConfirm={confirmNewDietLabel} onClose={() => setShowNewDietModal(false)} />
      )}

      <BottomNav />
    </div>
  )
}
