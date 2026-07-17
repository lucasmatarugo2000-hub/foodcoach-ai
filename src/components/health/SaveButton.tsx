'use client'

interface SaveButtonProps {
  onClick: () => void
  saving: boolean
  saved: boolean
  disabled?: boolean
}

export default function SaveButton({ onClick, saving, saved, disabled }: SaveButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving || disabled}
      className={`mt-3 w-full rounded-lg py-2 text-xs font-semibold transition disabled:opacity-40 ${
        saved ? 'bg-primary/15 text-primary' : 'bg-primary text-black'
      }`}
    >
      {saving ? 'Salvando...' : saved ? 'Salvo ✓' : 'Salvar'}
    </button>
  )
}
