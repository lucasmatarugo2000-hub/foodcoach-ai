'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from '@/components/ThemeToggle'

export default function SignupPage() {
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
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    router.push('/onboarding')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen flex-col justify-center px-6">
      <ThemeToggle className="fixed right-4 top-4 z-50" />
      <h1 className="mb-1 text-3xl font-bold text-primary">FoodCoach AI</h1>
      <p className="mb-8 text-sm text-white/60">Crie sua conta para começar.</p>

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
          minLength={6}
          placeholder="Senha (mín. 6 caracteres)"
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
          {loading ? 'Criando...' : 'Criar conta'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/60">
        Já tem conta?{' '}
        <Link href="/login" className="text-primary">
          Entrar
        </Link>
      </p>
    </div>
  )
}
