import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isAuthPage = path === '/login' || path === '/signup'
  const isPublic = isAuthPage || path.startsWith('/api')

  if (!user && !isPublic) {
    const redirectUrl = new URL('/login', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  if (user && isAuthPage) {
    const redirectUrl = new URL('/home', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  if (user && !isPublic && path !== '/onboarding' && path !== '/') {
    const { data: profile } = await supabase
      .from('users_profile')
      .select('role')
      .eq('id', user.id)
      .maybeSingle<{ role: 'client' | 'nutritionist' }>()

    const isNutritionist = profile?.role === 'nutritionist'
    const isNutriArea = path.startsWith('/nutri')

    if (isNutriArea && !isNutritionist) {
      return NextResponse.redirect(new URL('/home', request.url))
    }
    if (!isNutriArea && isNutritionist) {
      return NextResponse.redirect(new URL('/nutri/dashboard', request.url))
    }
  }

  return response
}
