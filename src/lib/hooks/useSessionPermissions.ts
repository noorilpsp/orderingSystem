'use client'

import { useEffect, useState } from 'react'
import type { SessionPermissions } from '@/lib/types/permissions'

let permissionsCache: SessionPermissions | null = null

function getPermissionsCache(): SessionPermissions | null {
  return permissionsCache
}

function setPermissionsCache(data: SessionPermissions | null): void {
  permissionsCache = data
}

/**
 * Hook to fetch session permissions (lightweight initial load)
 * This replaces the old usePermissions hook with a more efficient approach
 */
export function useSessionPermissions() {
  // Always start empty so SSR HTML matches the client's first paint.
  // Module cache is applied after mount to avoid hydration mismatches.
  const [permissions, setPermissions] = useState<SessionPermissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const cached = getPermissionsCache()

    async function fetchPermissions(silent: boolean) {
      try {
        if (!silent) {
          setLoading(true)
          setError(null)
        }

        const response = await fetch('/api/session/permissions', {
          credentials: 'include',
          // Prevent browser caching to avoid cross-user data leaks
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        })

        if (!response.ok) {
          if (response.status === 401) {
            setPermissionsCache(null)
            if (!cancelled) {
              setError('Unauthorized - Please log in')
              setPermissions(null)
            }
            return
          }
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Failed to fetch permissions: ${response.status}`)
        }

        const data: SessionPermissions = await response.json()
        setPermissionsCache(data)

        if (!cancelled) {
          if (typeof window !== 'undefined') {
            console.log('[useSessionPermissions] Loaded permissions:', {
              userId: data.userId,
              merchantMembershipsCount: data.merchantMemberships.length,
              merchantMemberships: data.merchantMemberships,
            })
          }
          setPermissions(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch permissions')
          console.error('[useSessionPermissions] Error:', err)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    const silent = Boolean(cached)
    const timeoutId = setTimeout(() => {
      void fetchPermissions(silent)
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [])

  const refetch = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/session/permissions', {
        credentials: 'include',
        // Prevent browser caching to avoid cross-user data leaks
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          setPermissionsCache(null)
          setError('Unauthorized - Please log in')
          setPermissions(null)
          return
        }
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch permissions: ${response.status}`)
      }

      const data: SessionPermissions = await response.json()
      setPermissionsCache(data)
      setPermissions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch permissions')
      console.error('[useSessionPermissions] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  return { permissions, loading, error, refetch }
}