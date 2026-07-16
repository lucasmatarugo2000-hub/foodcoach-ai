'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from '@/components/ThemeToggle'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError('E-mail ou senha inválidos.')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen flex-col justify-center px-6">
      <ThemeToggle className="fixed right-4 top-4 z-50" />
      <h1 className="mb-1 text-3xl font-bold text-primary">FoodCoach AI</h1>
      <p className="mb-8 text-sm text-white/60">Entre para continuar sua jornada.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl px-4 py-3 outline-none focus:border-primary"
        />
        <input
          type="password"
          required
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl px-4 py-3 outline-none focus:border-primary"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-primary py-3 font-semibold text-black disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/60">
        Não tem conta?{' '}
        <Link href="/signup" className="text-primary">
          Criar conta
        </Link>
      </p>
    </div>
  )
}
