'use client'

import React, { createContext, useContext, ReactNode, useMemo } from 'react'
import { useSessionPermissions } from '@/lib/hooks/useSessionPermissions'
import type { SessionPermissions } from '@/lib/types/permissions'

/**
 * Legacy type for backward compatibility
 * Maps to the new SessionPermissions structure
 */
type UserPermissions = {
  userId: string
  platformAdmin: boolean
  merchantMemberships: Array<{
    merchantId: string
    merchantName: string
    role: 'owner' | 'admin' | 'manager'
    locationAccess: string[]
    permissions: Record<string, boolean>
    accessibleLocations: Array<{
      id: string
      name: string
      address: string
      city: string
      status: string
    }>
    allLocationsCount: number
    accessibleLocationsCount: number
    membershipCreatedAt: Date | string
  }>
  totalMerchants: number
}

type PermissionsContextType = {
  // Legacy format for backward compatibility
  permissions: UserPermissions | null
  loading: boolean
  error: string | null
  refetch: () => void
  isPlatformAdmin: boolean
  hasMerchantAccess: (merchantId: string) => boolean
  canAccessLocation: (locationId: string) => boolean
  getUserRole: (merchantId: string) => 'owner' | 'admin' | 'manager' | null
  // New format - direct access to session permissions
  sessionPermissions: SessionPermissions | null
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined)

// Internal component that only renders after mount to avoid blocking prerendering
function PermissionsProviderInner({ children }: { children: ReactNode }) {
  const { permissions: sessionPermissions, loading, error, refetch } = useSessionPermissions()

  // Transform new format to legacy format for backward compatibility
  const permissions: UserPermissions | null = useMemo(() => {
    if (!sessionPermissions) return null

    return {
      userId: sessionPermissions.userId,
      platformAdmin: sessionPermissions.isPlatformAdmin ?? false,
      merchantMemberships: sessionPermissions.merchantMemberships.map((m) => ({
        merchantId: m.merchantId,
        merchantName: m.merchantName,
        role: m.role,
        locationAccess: [], // Lazy loaded - empty for now
        permissions: {}, // Lazy loaded - empty for now
        accessibleLocations: [], // Lazy loaded - empty for now
        allLocationsCount: 0, // Lazy loaded
        accessibleLocationsCount: 0, // Lazy loaded
        membershipCreatedAt: m.membershipCreatedAt ?? new Date(),
      })),
      totalMerchants: sessionPermissions.merchantMemberships.length,
    }
  }, [sessionPermissions])

  const isPlatformAdmin = sessionPermissions?.isPlatformAdmin ?? false

  const hasMerchantAccess = (merchantId: string): boolean => {
    if (!sessionPermissions) return false
    return sessionPermissions.merchantMemberships.some(
      (m) => m.merchantId === merchantId && m.isActive,
    )
  }

  // Note: Location access requires lazy loading - this is a placeholder
  const canAccessLocation = (locationId: string): boolean => {
    if (!sessionPermissions) return false
    // For now, return true if user has any merchant access
    // Full location check requires lazy loading merchant data
    // This should be implemented when location data is needed
    return sessionPermissions.merchantMemberships.length > 0
  }

  const getUserRole = (
    merchantId: string,
  ): 'owner' | 'admin' | 'manager' | null => {
    if (!sessionPermissions) return null
    const membership = sessionPermissions.merchantMemberships.find(
      (m) => m.merchantId === merchantId,
    )
    return membership?.role ?? null
  }

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        loading,
        error,
        refetch,
        isPlatformAdmin,
        hasMerchantAccess,
        canAccessLocation,
        getUserRole,
        sessionPermissions, // Also expose new format
      }}
    >
      {children}
    </PermissionsContext.Provider>
  )
}

export function PermissionsProvider({ children }: { children: ReactNode }) {
  return <PermissionsProviderInner>{children}</PermissionsProviderInner>
}

export function usePermissionsContext() {
  const context = useContext(PermissionsContext)
  if (context === undefined) {
    throw new Error('usePermissionsContext must be used within a PermissionsProvider')
  }
  return context
}

