import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import {
  isPlatformAdmin,
  getAdminStatusFromCookie,
  getAdminStatusFromCache,
  setAdminStatusCookie,
} from '@/lib/permissions'

const isDevelopment = process.env.NODE_ENV === 'development'

const STAFF_AUTH_PREFIXES = [
  '/staff/login',
  '/staff/signup',
  '/staff/forgot-password',
  '/staff/reset-password',
] as const

const DINER_AUTH_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
] as const

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function sanitizeDinerReturnTo(returnTo: string | null): string {
  if (!returnTo) return '/account'
  const trimmed = returnTo.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/account'
  if (trimmed.startsWith('/menu/')) return trimmed
  if (trimmed === '/account' || trimmed.startsWith('/account?')) return trimmed
  return '/account'
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } })
  const pathname = request.nextUrl.pathname

  // Skip API routes - they handle their own authentication
  if (pathname.startsWith('/api')) {
    return response
  }

  // Detect prefetch via our custom X-Prefetch header from Link component
  // This is reliable because we control the Link component
  const isPrefetch = request.headers.get('x-prefetch') === '1'

  // Detect direct navigation (user typing URL or clicking bookmark)
  // RSC prefetches don't have 'navigate' mode
  const isDirectNavigation = request.headers.get('sec-fetch-mode') === 'navigate'

  // Create Supabase client for authentication
  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: Record<string, unknown>) {
          response.cookies.delete({ name, ...options })
        },
      },
    },
  )

  // Get authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  const isStaffAuthPage = matchesPrefix(pathname, STAFF_AUTH_PREFIXES)
  const isDinerAuthPage = matchesPrefix(pathname, DINER_AUTH_PREFIXES)
  // Recovery links establish a session before the form submits — don't bounce.
  const isResetPasswordPage =
    pathname === '/reset-password' ||
    pathname.startsWith('/reset-password/') ||
    pathname === '/staff/reset-password' ||
    pathname.startsWith('/staff/reset-password/')

  if (isStaffAuthPage) {
    if (user && !userError && !isResetPasswordPage) {
      if (isPrefetch) {
        return new Response(null, { status: 204 })
      }
      if (isDevelopment) {
        console.info('[proxy] authenticated user on staff auth page → dashboard', {
          userId: user.id,
          path: pathname,
        })
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  if (isDinerAuthPage) {
    if (user && !userError && !isResetPasswordPage) {
      if (isPrefetch) {
        return new Response(null, { status: 204 })
      }
      const returnTo = sanitizeDinerReturnTo(
        request.nextUrl.searchParams.get('returnTo'),
      )
      if (isDevelopment) {
        console.info('[proxy] authenticated user on diner auth page → returnTo/account', {
          userId: user.id,
          path: pathname,
          returnTo,
        })
      }
      return NextResponse.redirect(new URL(returnTo, request.url))
    }
    return response
  }

  // Check if request has any cookies at all
  const hasCookies = request.cookies.getAll().length > 0

  // Handle /dashboard routes - require authentication only
  if (pathname.startsWith('/dashboard')) {
    if (userError || !user) {
      // If it's a prefetch OR (no cookies AND not direct navigation), return 204
      // This handles RSC prefetches gracefully while still redirecting direct URL access
      if (isPrefetch || (!hasCookies && !isDirectNavigation)) {
        return new Response(null, { status: 204 })
      }
      if (isDevelopment) {
        console.info('[proxy] dashboard access denied - not authenticated')
      }
      return NextResponse.redirect(new URL('/staff/login', request.url))
    }

    if (isDevelopment) {
      console.info('[proxy] dashboard access granted', { userId: user.id })
    }
    return response
  }

  // Handle ops orders board - require staff authentication
  if (pathname === '/orders' || pathname.startsWith('/orders/')) {
    if (userError || !user) {
      if (isPrefetch || (!hasCookies && !isDirectNavigation)) {
        return new Response(null, { status: 204 })
      }
      if (isDevelopment) {
        console.info('[proxy] orders access denied - not authenticated')
      }
      const loginUrl = new URL('/staff/login', request.url)
      loginUrl.searchParams.set('returnTo', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return response
  }

  // Handle /admin routes - require platform admin role
  if (pathname.startsWith('/admin')) {
    // First check authentication
    if (userError || !user) {
      // If it's a prefetch OR (no cookies AND not direct navigation), return 204
      // This handles RSC prefetches gracefully while still redirecting direct URL access
      if (isPrefetch || (!hasCookies && !isDirectNavigation)) {
        return new Response(null, { status: 204 })
      }
      if (isDevelopment) {
        console.info('[proxy] admin access denied - not authenticated')
      }
      return NextResponse.redirect(new URL('/staff/login', request.url))
    }

    // Ultra-fast path: Check in-memory cache first (<1ms)
    let isAdmin: boolean | null = getAdminStatusFromCache(user.id)

    if (isAdmin === null) {
      // Fast path: Check cookie second (no DB query needed, ~1ms)
      const cookieAdminStatus = getAdminStatusFromCookie(
        request.cookies.get('bt_admin_status')?.value,
        user.id, // Security: validate cookie belongs to this user
      )

      if (cookieAdminStatus !== null) {
        // Cookie is valid, use it and update in-memory cache
        isAdmin = cookieAdminStatus
        // Update in-memory cache for next request (async, don't await)
        isPlatformAdmin(user.id).catch(() => {}) // Populates cache in background
      } else {
        // Slow path: Cookie missing/expired, check database (~50-300ms)
        // This should rarely happen after first request
        isAdmin = await isPlatformAdmin(user.id)
        // Update cookie for future requests
        setAdminStatusCookie(response, user.id, isAdmin)
      }
    }

    if (!isAdmin) {
      if (isPrefetch || (!hasCookies && !isDirectNavigation)) {
        return new Response(null, { status: 204 })
      }
      if (isDevelopment) {
        console.info('[proxy] admin access denied - not platform admin')
      }
      return NextResponse.redirect(new URL('/staff/login', request.url))
    }

    if (isDevelopment) {
      console.info('[proxy] admin access granted', { userId: user.id })
    }
    return response
  }

  // For other routes, allow through
  return response
}

export const config = {
  matcher: [
    '/login',
    '/login/:path*',
    '/signup',
    '/signup/:path*',
    '/forgot-password',
    '/forgot-password/:path*',
    '/reset-password',
    '/reset-password/:path*',
    '/staff/login',
    '/staff/login/:path*',
    '/staff/signup',
    '/staff/signup/:path*',
    '/staff/forgot-password',
    '/staff/forgot-password/:path*',
    '/staff/reset-password',
    '/staff/reset-password/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/orders',
    '/orders/:path*',
    '/admin',
    '/admin/:path*',
  ],
}
