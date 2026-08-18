/**
 * Unified permissions types for the improved permission system
 */

export type MerchantMembership = {
  merchantId: string
  merchantName: string
  role: 'owner' | 'admin' | 'manager'
  isActive: boolean
  membershipCreatedAt: Date | string | null
}

/**
 * Session permissions - lightweight data loaded on initial page load
 * This contains everything needed for basic permission checks
 */
export type SessionPermissions = {
  userId: string
  email: string | null
  fullName: string | null
  
  // Platform admin (only included if true, undefined otherwise to save space)
  isPlatformAdmin?: boolean
  
  // Current tenant/merchant context (set by client)
  currentMerchantId: string | null
  
  // All merchant memberships (lightweight - just IDs and roles)
  merchantMemberships: MerchantMembership[]
}

/**
 * Extended merchant permissions - lazy loaded when full merchant data is needed
 */
export type MerchantPermissions = {
  merchantId: string
  merchant: {
    id: string
    name: string
    publicBrandName: string | null
    contactEmail: string
    contactPhone: string
    legalName: string
    vatNumber: string | null
    registeredAddressLine1: string | null
    registeredAddressLine2: string | null
    registeredPostalCode: string | null
    registeredCity: string | null
    registeredCountry: string
    kboNumber: string | null
    businessType: string
    status: string
    subscriptionTier: string
    subscriptionExpiresAt: Date | string | null
    logoUrl: string | null
    bannerUrl: string | null
    primaryBrandColor: string | null
    accentColor: string | null
    defaultCurrency: string
    defaultTimezone: string
    defaultLanguage: string
    dateFormat: string | null
    numberFormat: string | null
    billingEmail: string | null
    criticalAlertsEmail: string | null
    notificationPreferences: Record<string, any> | null
    createdAt: Date | string
    updatedAt: Date | string | null
  }
  role: 'owner' | 'admin' | 'manager'
  accessibleLocations?: Array<{
    id: string
    name: string
    address: string
    city: string
    status: string
  }>
  permissions: Record<string, boolean>
}