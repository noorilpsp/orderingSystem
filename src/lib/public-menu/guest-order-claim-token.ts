import { createHmac, timingSafeEqual } from "node:crypto";

const PURPOSE = "guest-loyalty-claim:v1";

function signingSecret(): string | null {
  const value = process.env.AUTH_SECRET?.trim();
  return value || null;
}

export function createGuestOrderClaimToken(orderId: string): string | null {
  const key = signingSecret();
  const id = orderId.trim();
  if (!key || !id) return null;
  return createHmac("sha256", key).update(`${PURPOSE}:${id}`).digest("hex");
}

export function verifyGuestOrderClaimToken(orderId: string, token: string): boolean {
  const expected = createGuestOrderClaimToken(orderId);
  const provided = token.trim();
  if (!expected || !provided) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
