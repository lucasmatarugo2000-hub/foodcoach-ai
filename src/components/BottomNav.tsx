'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, UtensilsCrossed, MessageCircle, TrendingUp, User } from 'lucide-react'

const ITEMS = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/diet', label: 'Dieta', icon: UtensilsCrossed },
  { href: '/coach', label: 'Coach', icon: MessageCircle },
  { href: '/progress', label: 'Evolução', icon: TrendingUp },
  { href: '/profile', label: 'Perfil', icon: User },
] as const

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/80 backdrop-blur-lg">
      <div
        className="h-[2px] w-full"
        style={{ background: 'linear-gradient(90deg, rgb(var(--color-primary)), rgb(var(--color-secondary)))' }}
      />
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
                <Icon size={22} strokeWidth={2} className={active ? 'text-primary' : 'text-muted'} />
                <span className={active ? 'text-primary' : 'text-muted'}>{item.label}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
