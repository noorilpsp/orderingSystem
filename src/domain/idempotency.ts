/**
 * Idempotency support for POS mutation endpoints.
 * - Same key + same requestHash -> return stored response
 * - Same key + different requestHash -> CONFLICT error
 */

import { createHash } from "crypto";
import { eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { posIdempotencyKeys } from "@/lib/db/schema/pos-idempotency";

/** Stable JSON stringify with sorted keys for deterministic hashing */
function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const items = value.map(stableStringify);
    return `[${items.join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const keys = Object.keys(value).sort();
    const pairs = keys.map(
      (k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`,
    );
    return `{${pairs.join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Compute a stable hash of the request body for idempotency comparison.
 * Sorts object keys so equivalent payloads produce the same hash.
 */
export function computeRequestHash(body: unknown): string {
  const str = stableStringify(body);
  return createHash("sha256").update(str).digest("hex");
}

export const IDEMPOTENCY_CONFLICT = "CONFLICT" as const;

export type IdempotentResult =
  | { ok: true; response: unknown }
  | { ok: false; code: typeof IDEMPOTENCY_CONFLICT };

export type GetIdempotentResponseParams = {
  key: string;
  userId: string;
  route: string;
  requestHash: string;
};

/**
 * Returns stored response if key exists with same requestHash.
 * Returns CONFLICT if key exists with different requestHash.
 * Returns null if key does not exist.
 */
export async function getIdempotentResponse(
  params: GetIdempotentResponseParams,
): Promise<IdempotentResult | null> {
  const { key, userId, route, requestHash } = params;
  const [row] = await db
    .select()
    .from(posIdempotencyKeys)
    .where(eq(posIdempotencyKeys.key, key))
    .limit(1);

  if (!row) return null;

  if (row.requestHash !== requestHash) {
    return { ok: false, code: IDEMPOTENCY_CONFLICT };
  }

  return { ok: true, response: row.responseJson as unknown };
}

export type SaveIdempotentResponseParams = {
  key: string;
  userId: string;
  route: string;
  requestHash: string;
  responseJson: unknown;
};

type DbClient = Pick<typeof db, "insert">;

/**
 * Saves an idempotent response. Call only when the key does not yet exist
 * (i.e. after getIdempotentResponse returned null and the mutation succeeded).
 * Pass optional tx to run the insert inside a transaction (e.g. same tx as domain writes).
 */
export async function saveIdempotentResponse(
  params: SaveIdempotentResponseParams,
  tx?: DbClient,
): Promise<void> {
  const { key, userId, route, requestHash, responseJson } = params;
  const client = tx ?? db;
  await client.insert(posIdempotencyKeys).values({
    key,
    userId,
    route,
    requestHash,
    responseJson: responseJson as Record<string, unknown>,
  });
}

/**
 * Deletes idempotency keys older than N days. Run periodically (e.g. via cron) to avoid unbounded growth.
 * Not scheduled automatically - wire into your job runner or cron.
 *
 * @param days - Delete rows older than this many days (default 30)
 * @returns Number of rows deleted
 */
export async function cleanupIdempotencyKeys(days = 30): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(posIdempotencyKeys)
    .where(lt(posIdempotencyKeys.createdAt, cutoff))
    .returning({ key: posIdempotencyKeys.key });
  return deleted.length;
}
