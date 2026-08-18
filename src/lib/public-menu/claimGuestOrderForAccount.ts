import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { awardLoyaltyPointsForCompletedOrder } from "@/lib/loyalty/awardLoyaltyPointsForCompletedOrder";
import { resolvePublicLocationBySlug } from "@/lib/public-menu/buildPublicMenuView";
import { getLoggedInCustomer } from "@/lib/public-menu/getLoggedInCustomer";
import { verifyGuestOrderClaimToken } from "@/lib/public-menu/guest-order-claim-token";

const CLAIM_WINDOW_MS = 72 * 60 * 60 * 1000;

export type ClaimGuestOrderFailureCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "GONE"
  | "INTERNAL_ERROR";

export type ClaimGuestOrderResult =
  | { ok: true; awarded: number }
  | { ok: false; code: ClaimGuestOrderFailureCode; message: string };

export async function claimGuestOrderForAccount(input: {
  storeSlug: string;
  orderId: string;
  token: string;
}): Promise<ClaimGuestOrderResult> {
  const storeSlug = input.storeSlug.trim().toLowerCase();
  const orderId = input.orderId.trim();
  const token = input.token.trim();

  if (!storeSlug || !orderId || !token) {
    return { ok: false, code: "BAD_REQUEST", message: "storeSlug, orderId, and token are required" };
  }

  if (!verifyGuestOrderClaimToken(orderId, token)) {
    return { ok: false, code: "FORBIDDEN", message: "This order cannot be added to your account" };
  }

  const loggedIn = await getLoggedInCustomer(storeSlug);
  if (!loggedIn?.userId) {
    return { ok: false, code: "UNAUTHORIZED", message: "Sign in to save this order" };
  }
  if (!loggedIn.customerId) {
    return { ok: false, code: "INTERNAL_ERROR", message: "Could not load your account" };
  }

  const location = await resolvePublicLocationBySlug(storeSlug);
  if (!location?.id) {
    return { ok: false, code: "NOT_FOUND", message: "Store not found" };
  }

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    columns: {
      id: true,
      locationId: true,
      customerId: true,
      status: true,
      createdAt: true,
    },
  });

  if (!order || order.locationId !== location.id) {
    return { ok: false, code: "NOT_FOUND", message: "Order not found" };
  }

  if (order.createdAt.getTime() < Date.now() - CLAIM_WINDOW_MS) {
    return { ok: false, code: "GONE", message: "This order can no longer be added to an account" };
  }

  if (order.status === "cancelled") {
    return { ok: false, code: "FORBIDDEN", message: "Cancelled orders cannot be added to an account" };
  }

  if (order.customerId && order.customerId !== loggedIn.customerId) {
    const currentCustomer = await db.query.customers.findFirst({
      where: eq(customers.id, order.customerId),
      columns: { id: true, userId: true },
    });
    if (currentCustomer?.userId && currentCustomer.userId !== loggedIn.userId) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "This order is already linked to another account",
      };
    }
  }

  if (order.customerId !== loggedIn.customerId) {
    await db
      .update(orders)
      .set({
        customerId: loggedIn.customerId,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
  }

  const loyalty = await awardLoyaltyPointsForCompletedOrder(orderId);
  if (!loyalty.ok) {
    return { ok: true, awarded: 0 };
  }

  return { ok: true, awarded: loyalty.awarded };
}
