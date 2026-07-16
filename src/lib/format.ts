import type { DietStatus, MealType } from '@/types'

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  cafe_da_manha: 'Café da manhã',
  lanche_manha: 'Lanche da manhã',
  almoco: 'Almoço',
  lanche_tarde: 'Lanche da tarde',
  jantar: 'Jantar',
  ceia: 'Ceia',
}

export function mealTypeLabel(type: MealType | string | null | undefined): string {
  if (!type) return 'Refeição'
  return MEAL_TYPE_LABELS[type as MealType] ?? type
}

export function statusBadge(status: DietStatus | null | undefined): { emoji: string; color: string; label: string } {
  switch (status) {
    case 'on_track':
      return { emoji: '✅', color: '#22c55e', label: 'Na linha' }
    case 'close':
      return { emoji: '🟡', color: '#eab308', label: 'Próximo' }
    case 'diverged':
      return { emoji: '🔴', color: '#ef4444', label: 'Divergiu' }
    default:
      return { emoji: '⚪', color: '#94a3b8', label: 'Sem dieta' }
  }
}

export function formatDate(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function formatTime(dateIso: string): string {
  return new Date(dateIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function formatDateFull(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** "Bom dia" (5h–12h) / "Boa tarde" (12h–18h) / "Boa noite" (18h–5h) */
export function greetingPrefix(date: Date = new Date()): string {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'Bom dia'
  if (hour >= 12 && hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** ☀️ (5h–12h) / 🌤️ (12h–18h) / 🌙 (18h–5h) */
export function greetingEmoji(date: Date = new Date()): string {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return '☀️'
  if (hour >= 12 && hour < 18) return '🌤️'
  return '🌙'
}

/** No display-name field exists for clients — derive a friendly one from the email. */
export function displayNameFromEmail(email: string | null | undefined): string {
  if (!email) return ''
  const local = email.split('@')[0] ?? email
  return local
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => (w[0] ?? '').toUpperCase() + w.slice(1))
    .join(' ')
}
