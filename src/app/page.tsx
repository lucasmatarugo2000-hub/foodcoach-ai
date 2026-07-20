import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users_profile')
    .select('onboarding_completed, role')
    .eq('id', user.id)
    .maybeSingle<{ onboarding_completed: boolean; role: 'client' | 'nutritionist' }>()

  if (!profile || !profile.onboarding_completed) {
    redirect('/onboarding')
  }

  redirect(profile.role === 'nutritionist' ? '/nutri/dashboard' : '/coach')
}
