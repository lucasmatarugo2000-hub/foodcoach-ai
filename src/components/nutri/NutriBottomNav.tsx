'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/nutri/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { href: '/nutri/clientes', label: 'Clientes', icon: ClientsIcon },
  { href: '/nutri/recomendacoes', label: 'Recomendações', icon: RecommendationsIcon },
  { href: '/nutri/perfil', label: 'Perfil', icon: ProfileIcon },
] as const

export default function NutriBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between px-2 py-2">
        {ITEMS.map((item) => {
          const active = pathname.startsWith(item.href) || (item.href === '/nutri/clientes' && pathname.startsWith('/nutri/cliente/'))
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} className="flex flex-1 items-center justify-center text-[10px]">
              <span
                className={`flex flex-col items-center gap-1 rounded-xl px-2.5 py-1 transition-colors ${
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

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="8" height="8" rx="2" stroke={iconColor(active)} strokeWidth="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" stroke={iconColor(active)} strokeWidth="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" stroke={iconColor(active)} strokeWidth="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" stroke={iconColor(active)} strokeWidth="2" />
    </svg>
  )
}

function ClientsIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3.2" stroke={iconColor(active)} strokeWidth="2" />
      <path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6" stroke={iconColor(active)} strokeWidth="2" strokeLinecap="round" />
      <circle cx="17" cy="8" r="2.6" stroke={iconColor(active)} strokeWidth="1.6" />
      <path d="M15.5 13.2c2.6 0.3 4.5 2.3 4.5 5.3" stroke={iconColor(active)} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function RecommendationsIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3l2.2 4.9 5.4.6-4 3.7 1.1 5.3L12 14.9l-4.7 2.6 1.1-5.3-4-3.7 5.4-.6L12 3z"
        stroke={iconColor(active)}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={iconColor(active)} strokeWidth="2" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" stroke={iconColor(active)} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
