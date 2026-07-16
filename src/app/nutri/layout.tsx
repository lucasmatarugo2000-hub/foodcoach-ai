'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import NutriSidebar from '@/components/nutri/NutriSidebar'
import NutriBottomNav from '@/components/nutri/NutriBottomNav'
import ThemeToggle from '@/components/ThemeToggle'

export default function NutriLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [nutriName, setNutriName] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('nutritionists')
        .select('nome')
        .eq('user_id', user.id)
        .maybeSingle<{ nome: string }>()
      setNutriName(data?.nome ?? null)
    }
    load()
  }, [supabase])

  return (
    <div className="min-h-screen md:pl-60">
      <NutriSidebar nutriName={nutriName} />
      <ThemeToggle className="fixed right-4 top-4 z-50 md:hidden" />
      <div className="pb-24 md:pb-6">{children}</div>
      <NutriBottomNav />
    </div>
  )
}
