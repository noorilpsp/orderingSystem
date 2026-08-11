import { posFailure, posSuccess } from "@/app/api/_lib/pos-envelope";
import { getVapidPublicKey } from "@/lib/orders/web-push";

export const runtime = "nodejs";

/**
 * GET /api/orders/push/vapid
 * Public VAPID key for staff Web Push subscription.
 */
export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return posFailure("INTERNAL_ERROR", "Web Push is not configured", { status: 503 });
  }
  return posSuccess({ publicKey });
}
