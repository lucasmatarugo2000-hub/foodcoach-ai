'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, UtensilsCrossed, HeartPulse, Moon, TrendingUp, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { computeCycleStatus } from '@/lib/cycle'
import type { Gender, MenstrualCycle } from '@/types'

const OTHER_ITEMS = [{ href: '/diet', label: 'Dieta', icon: UtensilsCrossed }] as const

const TAIL_ITEMS = [
  { href: '/progress', label: 'Evolução', icon: TrendingUp },
  { href: '/profile', label: 'Perfil', icon: User },
] as const

export default function BottomNav() {
  const pathname = usePathname()
  const supabase = createClient()
  const [gender, setGender] = useState<Gender | null>(null)
  const [onPeriod, setOnPeriod] = useState(false)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('users_profile')
        .select('gender')
        .eq('id', user.id)
        .maybeSingle<{ gender: Gender | null }>()
      setGender(profile?.gender ?? null)

      if (profile?.gender === 'female') {
        const { data: cycle } = await supabase
          .from('menstrual_cycles')
          .select('*')
          .eq('user_id', user.id)
          .order('cycle_start', { ascending: false })
          .limit(1)
          .maybeSingle<MenstrualCycle>()
        if (cycle) {
          setOnPeriod(computeCycleStatus(cycle).phase === 'menstrual')
        }
      }
    }
    load()
  }, [supabase])

  const HealthIcon = gender === 'female' ? Moon : HeartPulse

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/80 backdrop-blur-lg">
      <div
        className="h-[2px] w-full"
        style={{ background: 'linear-gradient(90deg, rgb(var(--color-primary)), rgb(var(--color-secondary)))' }}
      />
      <div className="mx-auto flex max-w-md items-center justify-between px-1 py-2">
        <Link href="/home" className="flex flex-1 items-center justify-center text-[10px]">
          <span
            className={`flex flex-col items-center gap-1 rounded-xl px-1.5 py-1 transition-colors ${
              pathname.startsWith('/home') ? 'bg-primary/15' : ''
            }`}
          >
            <Home size={20} strokeWidth={2} className="text-primary" />
            <span className="text-primary">Coach</span>
          </span>
        </Link>

        {OTHER_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} className="flex flex-1 items-center justify-center text-[10px]">
              <span
                className={`flex flex-col items-center gap-1 rounded-xl px-1.5 py-1 transition-colors ${
                  active ? 'bg-primary/15' : ''
                }`}
              >
                <Icon size={20} strokeWidth={2} className={active ? 'text-primary' : 'text-muted'} />
                <span className={active ? 'text-primary' : 'text-muted'}>{item.label}</span>
              </span>
            </Link>
          )
        })}

        <Link href="/health" className="flex flex-1 items-center justify-center text-[10px]">
          <span
            className={`relative flex flex-col items-center gap-1 rounded-xl px-1.5 py-1 transition-colors ${
              pathname.startsWith('/health') ? 'bg-primary/15' : ''
            }`}
          >
            <span className="relative">
              <HealthIcon
                size={20}
                strokeWidth={2}
                className={pathname.startsWith('/health') ? 'text-primary' : 'text-muted'}
              />
              {onPeriod && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-danger" aria-label="Em período" />
              )}
            </span>
            <span className={pathname.startsWith('/health') ? 'text-primary' : 'text-muted'}>Saúde</span>
          </span>
        </Link>

        {TAIL_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} className="flex flex-1 items-center justify-center text-[10px]">
              <span
                className={`flex flex-col items-center gap-1 rounded-xl px-1.5 py-1 transition-colors ${
                  active ? 'bg-primary/15' : ''
                }`}
              >
                <Icon size={20} strokeWidth={2} className={active ? 'text-primary' : 'text-muted'} />
                <span className={active ? 'text-primary' : 'text-muted'}>{item.label}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
