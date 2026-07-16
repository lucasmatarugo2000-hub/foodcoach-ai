'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = mounted ? resolvedTheme === 'dark' : true

  return (
    <button
      type="button"
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-white ${className}`}
    >
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M20 14.5A8.5 8.5 0 1110.5 4a6.5 6.5 0 009.5 10.5z"
            fill="currentColor"
            className="text-primary"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4.5" fill="currentColor" className="text-primary" />
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary">
            <path d="M12 2.5v2.5M12 19v2.5M4.5 12H2M22 12h-2.5M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
          </g>
        </svg>
      )}
    </button>
  )
}
