'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'

const ITEMS = [
  { href: '/nutri/dashboard', label: 'Dashboard' },
  { href: '/nutri/clientes', label: 'Clientes' },
  { href: '/nutri/recomendacoes', label: 'Recomendações' },
  { href: '/nutri/perfil', label: 'Perfil' },
] as const

export default function NutriSidebar({ nutriName }: { nutriName: string | null }) {
  const pathname = usePathname()

  return (
    <aside className="fixed bottom-0 left-0 top-0 z-30 hidden w-60 flex-col border-r border-border bg-card px-4 py-6 md:flex">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold text-primary">FoodCoach AI</div>
          <div className="mt-0.5 truncate text-xs text-white/50">{nutriName ?? 'Nutricionista'}</div>
        </div>
        <ThemeToggle />
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {ITEMS.map((item) => {
          const active = pathname.startsWith(item.href) || (item.href === '/nutri/clientes' && pathname.startsWith('/nutri/cliente/'))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                active ? 'bg-primary/10 text-primary' : 'text-white/70 hover:bg-border/50'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
