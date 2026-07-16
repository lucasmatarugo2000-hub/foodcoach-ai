'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ClientSummary, Meal, UserProfile } from '@/types'

interface ClientLink {
  client_id: string
  created_at: string
}

interface LinkedClientEmail {
  client_id: string
  email: string
}

export function useLinkedClients() {
  const supabase = createClient()
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [nutritionistId, setNutritionistId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setClients([])
      setLoading(false)
      return
    }
    setNutritionistId(user.id)

    const { data: links } = await supabase
      .from('client_nutritionist')
      .select('client_id, created_at')
      .eq('nutritionist_id', user.id)
      .eq('status', 'active')
      .returns<ClientLink[]>()

    const clientIds = (links ?? []).map((l) => l.client_id)
    if (clientIds.length === 0) {
      setClients([])
      setLoading(false)
      return
    }

    const since = new Date()
    since.setDate(since.getDate() - 7)

    const [rpcResult, { data: profiles }, { data: recentMeals }] = await Promise.all([
      supabase.rpc('get_linked_clients_emails'),
      supabase.from('users_profile').select('*').in('id', clientIds).returns<UserProfile[]>(),
      supabase
        .from('meals')
        .select('*')
        .in('user_id', clientIds)
        .gte('eaten_at', since.toISOString())
        .order('eaten_at', { ascending: false })
        .returns<Meal[]>(),
    ])
    const emails = rpcResult.data as LinkedClientEmail[] | null

    const emailMap = new Map((emails ?? []).map((e) => [e.client_id, e.email]))
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
    const mealsByClient = new Map<string, Meal[]>()
    for (const m of recentMeals ?? []) {
      const bucket = mealsByClient.get(m.user_id)
      if (bucket) bucket.push(m)
      else mealsByClient.set(m.user_id, [m])
    }

    const summaries: ClientSummary[] = (links ?? []).map((l) => {
      const clientMeals = mealsByClient.get(l.client_id) ?? []
      const withComparison = clientMeals.filter((m) => m.diet_comparison !== null)
      const onTrack = withComparison.filter((m) => m.diet_comparison?.status === 'on_track').length
      return {
        client_id: l.client_id,
        email: emailMap.get(l.client_id) ?? 'Cliente',
        profile: profileMap.get(l.client_id) ?? null,
        last_meal_at: clientMeals[0]?.eaten_at ?? null,
        adherence_pct: withComparison.length > 0 ? Math.round((onTrack / withComparison.length) * 100) : null,
        linked_at: l.created_at,
      }
    })

    setClients(summaries)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { clients, loading, nutritionistId, refresh }
}

export function clientDisplayName(email: string): string {
  return email.split('@')[0] ?? email
}

export function isStale(lastMealAt: string | null, thresholdDays = 3): boolean {
  if (!lastMealAt) return true
  const diffMs = Date.now() - new Date(lastMealAt).getTime()
  return diffMs > thresholdDays * 24 * 60 * 60 * 1000
}
