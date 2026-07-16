'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/home', label: 'Home', icon: HomeIcon },
  { href: '/diet', label: 'Dieta', icon: DietIcon },
  { href: '/coach', label: 'Coach', icon: CoachIcon },
  { href: '/progress', label: 'Evolução', icon: ProgressIcon },
  { href: '/profile', label: 'Perfil', icon: ProfileIcon },
] as const

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card">
      <div className="mx-auto flex max-w-md items-center justify-between px-2 py-2">
        {ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} className="flex flex-1 items-center justify-center text-[11px]">
              <span
                className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1 transition-colors ${
                  active ? 'bg-primary/15' : ''
                }`}
              >
                <Icon active={active} />
                <span className={active ? 'text-primary' : 'text-white/50'}>{item.label}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function iconColor(active: boolean) {
  return active ? '#22c55e' : 'rgba(255,255,255,0.5)'
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 11.5L12 4l8 7.5M6 10v9a1 1 0 001 1h4v-5h2v5h4a1 1 0 001-1v-9"
        stroke={iconColor(active)}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DietIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 3v6a2 2 0 002 2h0a2 2 0 002-2V3M8 3v18M12 11v10M17 3c-2 2-2 5-2 8 0 2 1 3 2 3s2-1 2-3c0-3 0-6-2-8zM17 22v-8"
        stroke={iconColor(active)}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CoachIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={iconColor(active)} strokeWidth="2" />
      <circle cx="9" cy="11" r="1.3" fill={iconColor(active)} />
      <circle cx="15" cy="11" r="1.3" fill={iconColor(active)} />
      <path d="M9 15q3 2 6 0" stroke={iconColor(active)} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function ProgressIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 20V10M10 20V4M16 20v-7M20 20V8"
        stroke={iconColor(active)}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={iconColor(active)} strokeWidth="2" />
      <path
        d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"
        stroke={iconColor(active)}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
