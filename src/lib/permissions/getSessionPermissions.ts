import { db } from '@/db'
import { merchantUsers, merchants, users } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { unstable_cache } from '@/lib/unstable-cache'
import { isPlatformAdmin } from '@/lib/permissions'
import type { SessionPermissions, MerchantMembership } from '@/lib/types/permissions'
import { supabaseServer } from '@/lib/supabaseServer'

function resolveFullName(
  dbFullName: string | null | undefined,
  authMetadata: unknown,
): string | null {
  const trimmedDb = dbFullName?.trim()
  if (trimmedDb) return trimmedDb

  const meta = authMetadata as { full_name?: string; fullName?: string; name?: string } | null
  const fromMeta = meta?.full_name?.trim() || meta?.fullName?.trim() || meta?.name?.trim()
  return fromMeta || null
}

/**
 * Single optimized query to get all session permissions
 * Uses JOINs to minimize database queries
 * 
 * @param userId - The authenticated user ID
 * @returns SessionPermissions with all merchant memberships and platform admin status
 */
export async function getSessionPermissions(userId: string): Promise<SessionPermissions> {
  // Get user email from Supabase session (no DB query needed)
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email ?? null

  let dbFullName: string | null = null
  try {
    const [dbUser] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    dbFullName = dbUser?.fullName ?? null
  } catch (error) {
    console.error('[getSessionPermissions] Error fetching user name:', error)
  }
  const fullName = resolveFullName(dbFullName, user?.user_metadata)

  // Single optimized query with JOIN to get all merchant memberships
  // This replaces multiple separate queries
  // Note: We filter by isActive in the query, matching the old behavior
  const getCachedMemberships = unstable_cache(
    async () => {
      try {
        const result = await db
          .select({
            merchantId: merchantUsers.merchantId,
            merchantName: merchants.name,
            role: merchantUsers.role,
            isActive: merchantUsers.isActive,
            membershipCreatedAt: merchantUsers.createdAt,
          })
          .from(merchantUsers)
          .innerJoin(merchants, eq(merchants.id, merchantUsers.merchantId))
          .where(
            and(
              eq(merchantUsers.userId, userId),
              eq(merchantUsers.isActive, true)
            )
          )
          .orderBy(merchantUsers.createdAt)

        console.log(`[getSessionPermissions] Found ${result.length} active merchant memberships for user ${userId}`)

        return result.map((r): MerchantMembership => ({
          merchantId: r.merchantId,
          merchantName: r.merchantName,
          role: r.role as 'owner' | 'admin' | 'manager',
          isActive: r.isActive,
          membershipCreatedAt: r.membershipCreatedAt,
        }))
      } catch (error) {
        console.error('[getSessionPermissions] Error fetching memberships:', error)
        throw error
      }
    },
    ['session-memberships', userId],
    { revalidate: 600 } // 10 minutes cache
  )

  let merchantMemberships = await getCachedMemberships()

  // If no memberships found, try querying without isActive filter to debug
  // (This should not happen in production, but helps diagnose issues)
  if (merchantMemberships.length === 0) {
    console.warn(`[getSessionPermissions] No active memberships found for user ${userId}, checking all memberships...`)
    try {
      const allMemberships = await db
        .select({
          merchantId: merchantUsers.merchantId,
          merchantName: merchants.name,
          role: merchantUsers.role,
          isActive: merchantUsers.isActive,
          membershipCreatedAt: merchantUsers.createdAt,
        })
        .from(merchantUsers)
        .innerJoin(merchants, eq(merchants.id, merchantUsers.merchantId))
        .where(eq(merchantUsers.userId, userId))
        .orderBy(merchantUsers.createdAt)

      console.log(`[getSessionPermissions] Found ${allMemberships.length} total memberships (active + inactive)`)
      if (allMemberships.length > 0) {
        console.log('[getSessionPermissions] Membership details:', allMemberships.map(m => ({
          merchantId: m.merchantId,
          merchantName: m.merchantName,
          isActive: m.isActive,
        })))
      }
    } catch (debugError) {
      console.error('[getSessionPermissions] Error checking all memberships:', debugError)
    }
  }

  // Platform admin check - lazy and heavily cached
  // Only check if we suspect user might be admin (can be optimized further)
  // For now, we check but it's cached at multiple levels in isPlatformAdmin
  const platformAdminStatus = await isPlatformAdmin(userId)
  const isPlatformAdminFlag = platformAdminStatus ? true : undefined

  return {
    userId,
    email,
    fullName,
    isPlatformAdmin: isPlatformAdminFlag, // Only include if true
    currentMerchantId: null, // Set on client side
    merchantMemberships,
  }
}