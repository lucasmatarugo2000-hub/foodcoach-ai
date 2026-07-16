'use client'

import { useEffect, useRef, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { bioimpedanceSeries } from '@/lib/charts'
import { CHART_COLORS, chartTooltipStyle } from '@/lib/chartTheme'
import { formatDateFull } from '@/lib/format'
import BioimpedanceForm, { type BioimpedanceFormValues } from '@/components/BioimpedanceForm'
import BottomNav from '@/components/BottomNav'
import ThemeToggle from '@/components/ThemeToggle'
import type { Bioimpedance, ReadBioimpedanceResult } from '@/types'

export default function BioimpedancePage() {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [records, setRecords] = useState<Bioimpedance[]>([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [modalTab, setModalTab] = useState<'upload' | 'manual'>('upload')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<ReadBioimpedanceResult | null>(null)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    setUserId(user.id)
    const { data } = await supabase
      .from('bioimpedance')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .returns<Bioimpedance[]>()
    setRecords(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function closeModal() {
    setShowModal(false)
    setModalTab('upload')
    setExtracted(null)
    setPhotoDataUrl(null)
    setUploadError(null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setExtracted(null)
    const reader = new FileReader()
    reader.onload = async () => {
      setUploading(true)
      setPhotoDataUrl(reader.result as string)
      try {
        const res = await fetch('/api/read-bioimpedance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: reader.result, mediaType: file.type }),
        })
        if (!res.ok) {
          const errBody = await res.json().catch(() => null)
          setUploadError(
            errBody?.error === 'not_bioimpedance'
              ? 'Não conseguimos identificar um laudo de bioimpedância nesse arquivo.'
              : 'Falha ao ler o laudo. Tente novamente.'
          )
          return
        }
        const result: ReadBioimpedanceResult = await res.json()
        setExtracted(result)
      } catch {
        setUploadError('Falha ao ler o laudo. Tente novamente.')
      } finally {
        setUploading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const series = bioimpedanceSeries(records)
  const latest = records.length > 0 ? records[records.length - 1] : undefined

  const extractedInitial: Partial<BioimpedanceFormValues> | undefined = extracted
    ? {
        date: extracted.date ?? new Date().toISOString().slice(0, 10),
        weight: extracted.weight?.toString() ?? '',
        body_fat_pct: extracted.body_fat_pct?.toString() ?? '',
        muscle_mass: extracted.muscle_mass?.toString() ?? '',
        bone_mass: extracted.bone_mass?.toString() ?? '',
        water_pct: extracted.water_pct?.toString() ?? '',
        visceral_fat: extracted.visceral_fat?.toString() ?? '',
        bmr: extracted.bmr?.toString() ?? '',
        bmi: extracted.bmi?.toString() ?? '',
      }
    : undefined

  return (
    <div className="min-h-screen px-4 pb-28 pt-6">
      <ThemeToggle className="fixed right-4 top-4 z-50" />
      <h1 className="mb-1 text-xl font-bold">Bioimpedância</h1>
      <p className="mb-5 text-xs text-white/50">Acompanhe sua composição corporal ao longo do tempo.</p>

      <button
        onClick={() => setShowModal(true)}
        className="w-full rounded-xl bg-primary py-3 font-semibold text-black"
      >
        + Lançar nova bioimpedância
      </button>

      {records.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-white/70">Comparativo</h2>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART_COLORS.neutral }} />
                <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.neutral }} width={36} />
                <Tooltip {...chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="weight" name="Peso (kg)" stroke={CHART_COLORS.series1} strokeWidth={2} dot={{ r: 3 }} />
                <Line
                  type="monotone"
                  dataKey="body_fat_pct"
                  name="% Gordura"
                  stroke={CHART_COLORS.series4}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="muscle_mass"
                  name="Massa muscular (kg)"
                  stroke={CHART_COLORS.series2}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-white/70">Histórico</h2>
        {loading ? (
          <p className="text-sm text-white/50">Carregando...</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-white/40">Nenhum registro ainda. Lance sua primeira bioimpedância.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {records
              .slice()
              .reverse()
              .map((r) => (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-3">
                  <div className="mb-1 text-xs font-semibold text-white/70">{formatDateFull(`${r.date}T00:00:00`)}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
                    {r.weight !== null && <span>Peso: {r.weight}kg</span>}
                    {r.body_fat_pct !== null && <span>Gordura: {r.body_fat_pct}%</span>}
                    {r.muscle_mass !== null && <span>Massa muscular: {r.muscle_mass}kg</span>}
                    {r.bmi !== null && <span>IMC: {r.bmi}</span>}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {latest && (
        <p className="mt-4 text-center text-xs text-white/30">
          Último registro em {formatDateFull(`${latest.date}T00:00:00`)}
        </p>
      )}

      {showModal && userId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-6 py-10">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5">
            <h3 className="mb-4 text-base font-semibold">Lançar bioimpedância</h3>

            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setModalTab('upload')}
                className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${
                  modalTab === 'upload' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-white/60'
                }`}
              >
                Enviar laudo
              </button>
              <button
                onClick={() => setModalTab('manual')}
                className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${
                  modalTab === 'manual' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-white/60'
                }`}
              >
                Digitar manualmente
              </button>
            </div>

            {modalTab === 'upload' ? (
              <div>
                {!extracted && (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full rounded-xl border border-border py-3 text-sm font-semibold text-white/80 disabled:opacity-50"
                    >
                      {uploading ? 'Lendo laudo...' : 'Selecionar imagem ou PDF'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    {uploadError && <p className="mt-3 text-xs text-danger">{uploadError}</p>}
                  </>
                )}

                {extracted && extracted.error !== 'not_bioimpedance' && (
                  <div>
                    <p className="mb-3 text-xs text-white/50">
                      Confira os dados extraídos do laudo e corrija se necessário.
                    </p>
                    <BioimpedanceForm
                      userId={userId}
                      initial={extractedInitial}
                      rawText={extracted.raw_text}
                      photoDataUrl={photoDataUrl}
                      submitLabel="Confirmar e salvar"
                      onCancel={closeModal}
                      onSaved={() => {
                        closeModal()
                        load()
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <BioimpedanceForm
                userId={userId}
                onCancel={closeModal}
                onSaved={() => {
                  closeModal()
                  load()
                }}
              />
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
