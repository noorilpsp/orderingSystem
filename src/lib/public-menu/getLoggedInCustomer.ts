import { eq } from "drizzle-orm";
import { db } from "@/db";
import { merchantLocations } from "@/db/schema";
import { getUser } from "@/lib/queries";
import { supabaseServer } from "@/lib/supabaseServer";
import { ensureCustomerForUser } from "@/lib/public-menu/ensureCustomerForUser";
import { getLoyaltyBalanceForUser } from "@/lib/loyalty/awardLoyaltyPointsForCompletedOrder";
import {
  getLoyaltyPointsExpirySummary,
  getLoyaltyPointLotsSnapshot,
  resolveLoyaltyAccount,
  type PointLotSnapshot,
} from "@/lib/loyalty/loyaltyPointLots";

export type LoyaltyPointsExpiry = {
  nextExpiresAt: string | null;
  pointsExpiringNext: number;
};

export type LoggedInCustomerProfile = {
  userId: string;
  email: string;
  name: string;
  phone: string | null;
  customerId: string | null;
  locationId: string | null;
  merchantId: string | null;
  /** Current loyalty points for this merchant/location scope; null when unknown / no store context. */
  loyaltyPoints: number | null;
  loyaltyPointsExpiry: LoyaltyPointsExpiry | null;
  loyaltyPointLots: PointLotSnapshot[] | null;
};

/**
 * Returns the authenticated diner profile.
 * With a storeSlug, also ensures a location-scoped customers row exists and loads loyalty balance.
 */
export async function getLoggedInCustomer(
  storeSlug?: string | null,
): Promise<LoggedInCustomerProfile | null> {
  const supabase = await supabaseServer();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const dbUser = await getUser();
  const email = authUser.email ?? dbUser?.email ?? "";
  const name =
    dbUser?.fullName?.trim() ||
    (authUser.user_metadata as { full_name?: string; name?: string } | null)?.full_name ||
    (authUser.user_metadata as { name?: string } | null)?.name ||
    email.split("@")[0] ||
    "Guest";

  const phone =
    dbUser?.phone?.trim() ||
    (authUser.user_metadata as { phone?: string } | null)?.phone?.trim() ||
    null;

  const slug = storeSlug?.trim().toLowerCase() || null;
  if (!slug) {
    return {
      userId: authUser.id,
      email,
      name,
      phone,
      customerId: null,
      locationId: null,
      merchantId: null,
      loyaltyPoints: null,
      loyaltyPointsExpiry: null,
      loyaltyPointLots: null,
    };
  }

  const ensured = await ensureCustomerForUser({
    userId: authUser.id,
    storeSlug: slug,
    name,
    email,
    phone,
  });

  let merchantId: string | null = null;
  let loyaltyPoints: number | null = null;
  let loyaltyPointsExpiry: LoyaltyPointsExpiry | null = null;
  let loyaltyPointLots: PointLotSnapshot[] | null = null;

  if (ensured?.locationId) {
    const location = await db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.id, ensured.locationId),
      columns: { merchantId: true },
    });
    merchantId = location?.merchantId ?? null;
    if (merchantId) {
      try {
        loyaltyPoints = await getLoyaltyBalanceForUser({
          userId: authUser.id,
          merchantId,
          locationId: ensured.locationId,
        });
        const account = await resolveLoyaltyAccount({
          userId: authUser.id,
          merchantId,
          locationId: ensured.locationId,
        });
        if (account) {
          loyaltyPointsExpiry = await getLoyaltyPointsExpirySummary(account.id);
          loyaltyPointLots = await getLoyaltyPointLotsSnapshot(account.id);
        }
      } catch (error) {
        console.error("[getLoggedInCustomer] loyalty balance failed", error);
        loyaltyPoints = 0;
      }
    }
  }

  return {
    userId: authUser.id,
    email,
    name: ensured?.name?.trim() || name,
    phone: ensured?.phone?.trim() || phone,
    customerId: ensured?.customerId ?? null,
    locationId: ensured?.locationId ?? null,
    merchantId,
    loyaltyPoints,
    loyaltyPointsExpiry,
    loyaltyPointLots,
  };
}
