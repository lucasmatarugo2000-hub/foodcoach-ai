import type { SupabaseClient } from '@supabase/supabase-js'

/** Quick client-side session check for write-critical flows — logs and returns null on failure/absence so callers can redirect to /login instead of silently failing a save. */
export async function requireSession(supabase: SupabaseClient) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  if (error) {
    console.error('requireSession: auth.getSession error', error)
    return null
  }
  if (!session) {
    console.error('requireSession: no active session')
    return null
  }
  return session
}
