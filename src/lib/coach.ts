import type { ComponentType } from 'react'
import KaiAvatar from '@/components/KaiAvatar'
import LunaAvatar from '@/components/LunaAvatar'
import type { CyclePhase, Gender, KaiState } from '@/types'

export interface CoachInfo {
  name: string
  avatar: ComponentType<{ state: KaiState; size?: number }>
  tagline: string
}

const KAI_INFO: CoachInfo = { name: 'Kai', avatar: KaiAvatar, tagline: 'Seu coach de performance' }
const LUNA_INFO: CoachInfo = { name: 'Luna', avatar: LunaAvatar, tagline: 'Sua coach de bem-estar' }

/** Luna serves women; Kai serves men and users who prefer not to disclose gender. */
export function getCoachInfo(gender: Gender | null | undefined): CoachInfo {
  return gender === 'female' ? LUNA_INFO : KAI_INFO
}

export const KAI_PERSONA_PROMPT = `Você é Kai, um coach de alimentação e performance brasileiro. Sua abordagem é direta e motivacional, mas sempre respeitosa. Fale sempre em primeira pessoa como Kai, com linguagem masculina. Seu tom é objetivo, encorajador, nunca julgador. Nunca use: 'errado', 'proibido', 'excesso', 'traiu a dieta', 'pecado'.`

export const LUNA_PERSONA_PROMPT = `Você é Luna, uma coach de nutrição e bem-estar feminino com abordagem acolhedora e empática. Você entende as necessidades específicas do corpo feminino: ciclo menstrual, flutuações hormonais, saúde óssea, saúde reprodutiva. Seu tom é gentil, encorajador e nunca julgador. Você fala como uma amiga especialista, sempre em primeira pessoa como Luna, com linguagem feminina. NUNCA use palavras como 'errado', 'proibido', 'excesso', 'traiu'.`

export function getCoachPersonaPrompt(gender: Gender | null | undefined): string {
  return gender === 'female' ? LUNA_PERSONA_PROMPT : KAI_PERSONA_PROMPT
}

const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual: 'menstrual',
  folicular: 'folicular',
  ovulatoria: 'ovulatória',
  lutea: 'lútea',
}

/** Luna's cycle-aware nutrition guidance, inserted into the system prompt only when the user has an active cycle logged. */
export function buildCycleContextPrompt(phase: CyclePhase, cycleDay: number, cycleLength: number): string {
  return `A usuária está atualmente na fase ${PHASE_LABELS[phase]} do ciclo menstrual (dia ${cycleDay} de ${cycleLength}).
Fase menstrual (dias 1-5): priorize ferro, magnésio, vitamina C. Alimentos: folhas verdes, feijão, chocolate amargo 70%+, frutas cítricas. Evite excesso de sal e cafeína.
Fase folicular (dias 6-13): metabolismo acelerado, boa tolerância a carboidratos. Aproveite para treinos mais intensos.
Fase ovulatória (dias 14-16): pico de energia, aumento de libido. Alimentos antioxidantes.
Fase lútea (dias 17-28): tendência a compulsão alimentar, preferência por doces. Priorize proteínas e gorduras boas para controlar fissura. Magnésio ajuda com TPM.`
}
