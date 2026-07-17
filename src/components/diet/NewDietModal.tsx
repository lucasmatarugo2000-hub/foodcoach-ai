'use client'

import { useState } from 'react'

interface NewDietModalProps {
  onConfirm: (label: string) => void
  onClose: () => void
}

export default function NewDietModal({ onConfirm, onClose }: NewDietModalProps) {
  const [label, setLabel] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-1 text-base font-semibold">Nova dieta</h3>
        <p className="mb-4 text-sm text-white/60">
          Dê um nome para essa dieta (opcional — se deixar em branco, usamos a data de hoje).
        </p>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex: Dieta Janeiro 2025"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
          autoFocus
        />
        <div className="mt-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-white/80"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(label.trim())}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-black"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  )
}
