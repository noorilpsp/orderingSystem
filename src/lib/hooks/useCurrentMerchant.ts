'use client'

import { useTenant } from '@/lib/contexts/TenantContext'
import { useState, useEffect } from 'react'
import type { Merchant } from '@/lib/db/schema/merchants'
import type { MerchantMembership } from '@/lib/types/permissions'

/**
 * Gets the current merchant with lazy-loaded full data
 * Only fetches full merchant details when currentMerchantId is set
 */
export function useCurrentMerchant() {
  const { currentMerchantId, merchantMemberships, getCurrentMembership, loading: tenantLoading } = useTenant()
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Wait for tenant to finish initializing
    if (tenantLoading) {
      return
    }

    // Ensure we have a valid merchant ID before fetching
    if (!currentMerchantId || currentMerchantId.trim() === '') {
      if (typeof window !== 'undefined') {
        console.warn('[useCurrentMerchant] No valid merchant ID available:', {
          currentMerchantId,
          merchantMembershipsCount: merchantMemberships.length,
          merchantMemberships: merchantMemberships.map(m => ({ id: m.merchantId, name: m.merchantName })),
        })
      }
      setMerchant(null)
      setError(null)
      setLoading(false)
      return
    }

    // Lazy load full merchant data
    let cancelled = false

    async function fetchMerchant() {
      try {
        setLoading(true)
        setError(null)

        // Validate merchant ID before making request
        const validMerchantId = currentMerchantId?.trim()
        if (!validMerchantId) {
          const errorMsg = 'Invalid merchant ID - merchant ID is empty or null'
          console.error('[useCurrentMerchant]', errorMsg, {
            currentMerchantId,
            type: typeof currentMerchantId,
            merchantMemberships: merchantMemberships.map(m => ({ id: m.merchantId, name: m.merchantName })),
          })
          setError(errorMsg)
          setLoading(false)
          return
        }

        // Log the request for debugging
        if (typeof window !== 'undefined') {
          console.log('[useCurrentMerchant] Fetching merchant:', validMerchantId)
        }

        const response = await fetch(`/api/merchants/${encodeURIComponent(validMerchantId)}`, {
          credentials: 'include',
          // Prevent browser caching to avoid cross-user data leaks
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        })

        if (!response.ok) {
          if (response.status === 401) {
            setError('Unauthorized - Please log in')
            return
          }
          if (response.status === 403) {
            setError("Forbidden - You don't have access to this merchant")
            return
          }
          if (response.status === 404) {
            setError('Merchant not found')
            return
          }
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Failed to fetch merchant: ${response.status}`)
        }

        const merchantData: Merchant = await response.json()

        if (!cancelled) {
          setMerchant(merchantData)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch merchant data')
          console.error('[useCurrentMerchant] Error:', err)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchMerchant()

    return () => {
      cancelled = true
    }
  }, [currentMerchantId, tenantLoading])

  const membership = getCurrentMembership()

  return {
    merchantId: currentMerchantId,
    merchant, // Full merchant object (lazy loaded)
    membership,
    loading,
    error,
    refetch: async () => {
      const validMerchantId = currentMerchantId?.trim()
      if (!validMerchantId) return null
      const response = await fetch(`/api/merchants/${encodeURIComponent(validMerchantId)}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (!response.ok) return null
      const merchantData: Merchant = await response.json()
      setMerchant(merchantData)
      return merchantData
    },
  }
}