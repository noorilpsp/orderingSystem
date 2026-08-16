import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { withTx } from "@/domain/tx";
import { guestSeatClaims } from "@/lib/db/schema/guest-seat-claims";
import {
  guestTableSplits,
  EXTRA_PAYER_PREFIX,
  isExtraPayerId,
  type GuestSplitClaimRecord,
  type GuestSplitClaimsMap,
  type GuestSplitExtraPayer,
  type GuestSplitProposalRecord,
  type GuestSplitShare,
} from "@/lib/db/schema/guest-table-splits";
import { seats as seatsTable } from "@/lib/db/schema/orders";
import { resolvePublicLocationBySlug } from "@/lib/public-menu/buildPublicMenuView";
import { findOpenSessionForTable } from "@/lib/public-menu/tableSession";
import { withDbRetry } from "@/lib/db/withDbRetry";

export type GuestSplitMode = "one-bill" | "by-seat" | "equal" | "item";

export type GuestBillLineAssignmentInput = {
  lineId: string;
  /** Clear assignment */
  clear?: boolean;
  /** Sole assignee seat id */
  seatId?: string | null;
  /** Multi-seat shares (Split). Ignores seatId when provided. */
  shares?: Array<{ seatId: string; shares?: number }>;
};

function normalizeDeviceId(deviceId: string): string | null {
  const trimmed = deviceId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

function money(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

/** Postgres jsonb text cannot contain NUL bytes — strip/replace before write. */
function sanitizeJsonbLineId(lineId: string): string {
  return lineId.replace(/\u0000/g, "\u001f");
}

/** Normalize legacy sole-claim JSON into shares[]. */
export function normalizeClaimRecord(
  lineId: string,
  raw: GuestSplitClaimRecord | null | undefined,
): GuestSplitClaimRecord | null {
  if (!raw) return null;
  if (Array.isArray(raw.shares) && raw.shares.length > 0) {
    const shares = raw.shares
      .filter((s) => s.seatId && (s.shares ?? 0) > 0)
      .map((s) => ({
        seatId: s.seatId,
        seatNumber: s.seatNumber ?? null,
        shares: Math.max(1, Math.floor(s.shares ?? 1)),
      }));
    if (shares.length === 0) return null;
    return {
      lineId,
      shares,
      updatedByDeviceId: raw.updatedByDeviceId || raw.deviceId || "",
      updatedAt: raw.updatedAt || raw.claimedAt || new Date().toISOString(),
    };
  }
  if (raw.seatId) {
    return {
      lineId,
      shares: [
        {
          seatId: raw.seatId,
          seatNumber: raw.seatNumber ?? null,
          shares: 1,
        },
      ],
      updatedByDeviceId: raw.deviceId || raw.updatedByDeviceId || "",
      updatedAt: raw.claimedAt || raw.updatedAt || new Date().toISOString(),
    };
  }
  return null;
}

export function normalizeClaimsMap(claims: GuestSplitClaimsMap): GuestSplitClaimsMap {
  const next: GuestSplitClaimsMap = {};
  for (const [lineId, raw] of Object.entries(claims ?? {})) {
    const normalized = normalizeClaimRecord(lineId, raw);
    if (normalized) next[lineId] = normalized;
  }
  return next;
}

export function normalizeExtraPayers(
  raw: GuestSplitExtraPayer[] | null | undefined,
): GuestSplitExtraPayer[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const next: GuestSplitExtraPayer[] = [];
  for (const row of raw) {
    const id = typeof row?.id === "string" ? row.id.trim() : "";
    const seatNumber = Math.floor(Number(row?.seatNumber));
    if (!id || !isExtraPayerId(id) || !Number.isFinite(seatNumber) || seatNumber < 1) {
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    next.push({ id, seatNumber });
  }
  next.sort((a, b) => a.seatNumber - b.seatNumber);
  return next;
}

async function requireClaimedSeat(input: {
  storeSlug: string;
  tableNumber: string;
  deviceId: string;
}): Promise<
  | {
      ok: true;
      sessionId: string;
      tableNumber: string;
      seatId: string;
      seatNumber: number | null;
      deviceId: string;
    }
  | { ok: false; code: "NOT_FOUND" | "BAD_REQUEST" | "FORBIDDEN"; message: string }
> {
  const storeSlug = input.storeSlug.trim().toLowerCase();
  const tableNumber = input.tableNumber.trim();
  const deviceId = normalizeDeviceId(input.deviceId);
  if (!storeSlug) {
    return { ok: false, code: "BAD_REQUEST", message: "storeSlug is required" };
  }
  if (!tableNumber) {
    return { ok: false, code: "BAD_REQUEST", message: "tableNumber is required" };
  }
  if (!deviceId) {
    return { ok: false, code: "BAD_REQUEST", message: "A valid deviceId is required" };
  }

  const location = await resolvePublicLocationBySlug(storeSlug);
  if (!location?.storeSlug) {
    return { ok: false, code: "NOT_FOUND", message: "Store not found" };
  }

  const session = await findOpenSessionForTable(location.id, tableNumber);
  if (!session) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "No open check for this table yet. Order something first.",
    };
  }

  const claim = await db.query.guestSeatClaims.findFirst({
    where: and(
      eq(guestSeatClaims.sessionId, session.sessionId),
      eq(guestSeatClaims.deviceId, deviceId),
    ),
    columns: { seatId: true },
  });
  if (!claim) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Join this table from its QR code to see the check.",
    };
  }

  const seat = await db.query.seats.findFirst({
    where: eq(seatsTable.id, claim.seatId),
    columns: { id: true, seatNumber: true },
  });

  return {
    ok: true,
    sessionId: session.sessionId,
    tableNumber: session.tableNumber,
    seatId: claim.seatId,
    seatNumber: seat?.seatNumber ?? null,
    deviceId,
  };
}

export async function getGuestTableSplitState(sessionId: string): Promise<{
  claims: GuestSplitClaimsMap;
  proposal: GuestSplitProposalRecord | null;
  extraPayers: GuestSplitExtraPayer[];
}> {
  const row = await db.query.guestTableSplits.findFirst({
    where: eq(guestTableSplits.sessionId, sessionId),
    columns: { claims: true, proposal: true, extraPayers: true },
  });
  return {
    claims: normalizeClaimsMap(row?.claims ?? {}),
    proposal: row?.proposal ?? null,
    extraPayers: normalizeExtraPayers(row?.extraPayers),
  };
}

/**
 * Atomically merge one line into claims JSON so concurrent writes to different
 * lines do not clobber each other (read-modify-write of the whole map is unsafe).
 */
async function mergeClaimAtomic(
  sessionId: string,
  lineId: string,
  record: GuestSplitClaimRecord,
): Promise<GuestSplitClaimsMap> {
  const safeLineId = sanitizeJsonbLineId(lineId);
  const safeRecord: GuestSplitClaimRecord = { ...record, lineId: safeLineId };
  const patch = JSON.stringify({ [safeLineId]: safeRecord });
  await withDbRetry(() =>
    db.execute(sql`
      INSERT INTO guest_table_splits (id, session_id, claims, proposal, extra_payers, updated_at, created_at)
      VALUES (gen_random_uuid(), ${sessionId}::uuid, ${patch}::jsonb, NULL, '[]'::jsonb, now(), now())
      ON CONFLICT (session_id) DO UPDATE SET
        claims = COALESCE(guest_table_splits.claims, '{}'::jsonb) || EXCLUDED.claims,
        updated_at = now()
    `),
  );
  const state = await getGuestTableSplitState(sessionId);
  return state.claims;
}

async function removeClaimAtomic(
  sessionId: string,
  lineId: string,
): Promise<GuestSplitClaimsMap> {
  const safeLineId = sanitizeJsonbLineId(lineId);
  await withDbRetry(() =>
    db.execute(sql`
      UPDATE guest_table_splits
      SET
        claims = COALESCE(claims, '{}'::jsonb) - ${safeLineId},
        updated_at = now()
      WHERE session_id = ${sessionId}::uuid
    `),
  );
  const state = await getGuestTableSplitState(sessionId);
  return state.claims;
}

async function resolveSeatMeta(
  sessionId: string,
  seatId: string,
  extraPayers?: GuestSplitExtraPayer[],
): Promise<{ seatId: string; seatNumber: number | null } | null> {
  const extras = extraPayers ?? (await getGuestTableSplitState(sessionId)).extraPayers;
  const extra = extras.find((payer) => payer.id === seatId);
  if (extra) {
    return { seatId: extra.id, seatNumber: extra.seatNumber };
  }

  const seat = await db.query.seats.findFirst({
    where: and(
      eq(seatsTable.id, seatId),
      eq(seatsTable.sessionId, sessionId),
      ne(seatsTable.status, "removed"),
    ),
    columns: { id: true, seatNumber: true },
  });
  if (!seat) return null;
  return { seatId: seat.id, seatNumber: seat.seatNumber };
}

async function buildSharesForAssignment(
  sessionId: string,
  accessSeatId: string,
  input: Pick<GuestBillLineAssignmentInput, "seatId" | "shares">,
): Promise<
  | { ok: true; shares: GuestSplitShare[] }
  | { ok: false; code: "BAD_REQUEST"; message: string }
> {
  const extraPayers = (await getGuestTableSplitState(sessionId)).extraPayers;

  if (input.shares && input.shares.length > 0) {
    const shares: GuestSplitShare[] = [];
    for (const row of input.shares) {
      const seatId = row.seatId?.trim();
      if (!seatId || (row.shares ?? 0) <= 0) continue;
      const meta = await resolveSeatMeta(sessionId, seatId, extraPayers);
      if (!meta) {
        return { ok: false, code: "BAD_REQUEST", message: "Invalid seat in split shares" };
      }
      shares.push({
        seatId: meta.seatId,
        seatNumber: meta.seatNumber,
        shares: Math.max(1, Math.floor(row.shares ?? 1)),
      });
    }
    if (shares.length === 0) {
      return { ok: false, code: "BAD_REQUEST", message: "At least one share is required" };
    }
    return { ok: true, shares };
  }

  const targetSeatId = (input.seatId?.trim() || accessSeatId).trim();
  const meta = await resolveSeatMeta(sessionId, targetSeatId, extraPayers);
  if (!meta) {
    return { ok: false, code: "BAD_REQUEST", message: "Invalid seat" };
  }
  return {
    ok: true,
    shares: [{ seatId: meta.seatId, seatNumber: meta.seatNumber, shares: 1 }],
  };
}

async function writeClaimsMapLocked(
  sessionId: string,
  mutate: (claims: GuestSplitClaimsMap) => void,
): Promise<GuestSplitClaimsMap> {
  return withTx(async (tx) => {
    const existing = await tx.query.guestTableSplits.findFirst({
      where: eq(guestTableSplits.sessionId, sessionId),
      columns: { id: true, claims: true },
    });

    if (existing) {
      await tx.execute(sql`
        SELECT id
        FROM guest_table_splits
        WHERE session_id = ${sessionId}::uuid
        FOR UPDATE
      `);
    }

    const locked = existing
      ? await tx.query.guestTableSplits.findFirst({
          where: eq(guestTableSplits.sessionId, sessionId),
          columns: { id: true, claims: true },
        })
      : null;

    const claimsMap: GuestSplitClaimsMap = {
      ...normalizeClaimsMap(locked?.claims ?? existing?.claims ?? {}),
    };
    mutate(claimsMap);
    const normalized = normalizeClaimsMap(claimsMap);
    const now = new Date();

    if (locked ?? existing) {
      await tx
        .update(guestTableSplits)
        .set({ claims: normalized, updatedAt: now })
        .where(eq(guestTableSplits.sessionId, sessionId));
    } else {
      await tx.insert(guestTableSplits).values({
        sessionId,
        claims: normalized,
        proposal: null,
        extraPayers: [],
        updatedAt: now,
        createdAt: now,
      });
    }

    return normalized;
  });
}

/**
 * Assign a bill line: sole seat, multi-seat split, or clear.
 * Last write wins (any claimed device at the table can change assignments).
 */
export async function assignGuestBillLine(input: {
  storeSlug: string;
  tableNumber: string;
  deviceId: string;
  lineId: string;
  clear?: boolean;
  seatId?: string | null;
  shares?: Array<{ seatId: string; shares?: number }>;
}): Promise<
  | { ok: true; claims: GuestSplitClaimsMap }
  | { ok: false; code: "NOT_FOUND" | "BAD_REQUEST" | "FORBIDDEN"; message: string }
> {
  const lineId = sanitizeJsonbLineId(input.lineId.trim());
  if (!lineId) {
    return { ok: false, code: "BAD_REQUEST", message: "lineId is required" };
  }

  const access = await requireClaimedSeat(input);
  if (!access.ok) return access;

  if (input.clear) {
    const next = await removeClaimAtomic(access.sessionId, lineId);
    return { ok: true, claims: next };
  }

  const built = await buildSharesForAssignment(access.sessionId, access.seatId, input);
  if (!built.ok) return built;

  const record: GuestSplitClaimRecord = {
    lineId,
    shares: built.shares,
    updatedByDeviceId: access.deviceId,
    updatedAt: new Date().toISOString(),
  };

  const next = await mergeClaimAtomic(access.sessionId, lineId, record);
  return { ok: true, claims: next };
}

/**
 * Apply many line assignments in one locked write (presets / clear-all).
 * Avoids lost updates from parallel single-line claim requests.
 */
export async function assignGuestBillLinesBatch(input: {
  storeSlug: string;
  tableNumber: string;
  deviceId: string;
  assignments: GuestBillLineAssignmentInput[];
}): Promise<
  | { ok: true; claims: GuestSplitClaimsMap }
  | { ok: false; code: "NOT_FOUND" | "BAD_REQUEST" | "FORBIDDEN"; message: string }
> {
  if (!Array.isArray(input.assignments) || input.assignments.length === 0) {
    return { ok: false, code: "BAD_REQUEST", message: "assignments are required" };
  }

  const access = await requireClaimedSeat(input);
  if (!access.ok) return access;

  const prepared: Array<
    | { lineId: string; clear: true }
    | { lineId: string; clear: false; record: GuestSplitClaimRecord }
  > = [];

  for (const raw of input.assignments) {
    const lineId = sanitizeJsonbLineId((raw.lineId ?? "").trim());
    if (!lineId) {
      return { ok: false, code: "BAD_REQUEST", message: "lineId is required" };
    }
    if (raw.clear) {
      prepared.push({ lineId, clear: true });
      continue;
    }
    const built = await buildSharesForAssignment(access.sessionId, access.seatId, raw);
    if (!built.ok) return built;
    prepared.push({
      lineId,
      clear: false,
      record: {
        lineId,
        shares: built.shares,
        updatedByDeviceId: access.deviceId,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  const claims = await writeClaimsMapLocked(access.sessionId, (claimsMap) => {
    for (const op of prepared) {
      if (op.clear) {
        delete claimsMap[op.lineId];
      } else {
        claimsMap[op.lineId] = op.record;
      }
    }
  });

  return { ok: true, claims };
}

/** @deprecated use assignGuestBillLine — kept for claim toggle compatibility */
export async function claimGuestBillLine(input: {
  storeSlug: string;
  tableNumber: string;
  deviceId: string;
  lineId: string;
  claim: boolean;
}): Promise<
  | { ok: true; claims: GuestSplitClaimsMap }
  | { ok: false; code: "NOT_FOUND" | "BAD_REQUEST" | "FORBIDDEN"; message: string }
> {
  if (!input.claim) {
    return assignGuestBillLine({ ...input, clear: true });
  }
  return assignGuestBillLine({ ...input, seatId: undefined });
}

export async function proposeGuestTableSplit(input: {
  storeSlug: string;
  tableNumber: string;
  deviceId: string;
  mode: GuestSplitMode;
  equalCount?: number;
  amounts: Array<{ seatId: string | null; seatNumber: number | null; amount: number }>;
  unassignedAmount?: number;
}): Promise<
  | { ok: true; proposal: GuestSplitProposalRecord }
  | { ok: false; code: "NOT_FOUND" | "BAD_REQUEST" | "FORBIDDEN"; message: string }
> {
  const access = await requireClaimedSeat(input);
  if (!access.ok) return access;

  const mode = input.mode;
  if (
    mode !== "one-bill" &&
    mode !== "by-seat" &&
    mode !== "equal" &&
    mode !== "item"
  ) {
    return { ok: false, code: "BAD_REQUEST", message: "Invalid split mode" };
  }

  const amounts = input.amounts.map((row) => ({
    seatId: row.seatId,
    seatNumber: row.seatNumber,
    amount: money(row.amount),
  }));

  const proposal: GuestSplitProposalRecord = {
    id: crypto.randomUUID(),
    mode,
    fromSeatId: access.seatId,
    fromSeatNumber: access.seatNumber,
    createdAt: new Date().toISOString(),
    equalCount:
      mode === "equal" && input.equalCount != null
        ? Math.max(2, Math.min(20, Math.floor(input.equalCount)))
        : undefined,
    amounts,
    unassignedAmount:
      input.unassignedAmount != null ? money(input.unassignedAmount) : undefined,
  };

  const existing = await db.query.guestTableSplits.findFirst({
    where: eq(guestTableSplits.sessionId, access.sessionId),
    columns: { id: true, claims: true },
  });
  const now = new Date();
  if (existing) {
    await db
      .update(guestTableSplits)
      .set({ proposal, updatedAt: now })
      .where(eq(guestTableSplits.sessionId, access.sessionId));
  } else {
    await db.insert(guestTableSplits).values({
      sessionId: access.sessionId,
      claims: {},
      proposal,
      extraPayers: [],
      updatedAt: now,
      createdAt: now,
    });
  }

  return { ok: true, proposal };
}

const MAX_EXTRA_PAYERS = 20;

async function writeExtraPayersLocked(
  sessionId: string,
  mutate: (payers: GuestSplitExtraPayer[], claims: GuestSplitClaimsMap) => void,
): Promise<{
  extraPayers: GuestSplitExtraPayer[];
  claims: GuestSplitClaimsMap;
}> {
  return withTx(async (tx) => {
    const existing = await tx.query.guestTableSplits.findFirst({
      where: eq(guestTableSplits.sessionId, sessionId),
      columns: { id: true, claims: true, extraPayers: true },
    });

    if (existing) {
      await tx.execute(sql`
        SELECT id
        FROM guest_table_splits
        WHERE session_id = ${sessionId}::uuid
        FOR UPDATE
      `);
    }

    const locked = existing
      ? await tx.query.guestTableSplits.findFirst({
          where: eq(guestTableSplits.sessionId, sessionId),
          columns: { id: true, claims: true, extraPayers: true },
        })
      : null;

    const payers = normalizeExtraPayers(locked?.extraPayers ?? existing?.extraPayers);
    const claimsMap: GuestSplitClaimsMap = {
      ...normalizeClaimsMap(locked?.claims ?? existing?.claims ?? {}),
    };
    mutate(payers, claimsMap);
    const nextPayers = normalizeExtraPayers(payers);
    const nextClaims = normalizeClaimsMap(claimsMap);
    const now = new Date();

    if (locked ?? existing) {
      await tx
        .update(guestTableSplits)
        .set({
          extraPayers: nextPayers,
          claims: nextClaims,
          updatedAt: now,
        })
        .where(eq(guestTableSplits.sessionId, sessionId));
    } else {
      await tx.insert(guestTableSplits).values({
        sessionId,
        claims: nextClaims,
        proposal: null,
        extraPayers: nextPayers,
        updatedAt: now,
        createdAt: now,
      });
    }

    return { extraPayers: nextPayers, claims: nextClaims };
  });
}

export async function addGuestTableExtraPayer(input: {
  storeSlug: string;
  tableNumber: string;
  deviceId: string;
  /** Client-generated id for optimistic UI (must be extra-payer:…). */
  payer?: { id?: string; seatNumber?: number };
}): Promise<
  | { ok: true; extraPayers: GuestSplitExtraPayer[]; added: GuestSplitExtraPayer }
  | { ok: false; code: "NOT_FOUND" | "BAD_REQUEST" | "FORBIDDEN"; message: string }
> {
  const access = await requireClaimedSeat(input);
  if (!access.ok) return access;

  const requestedId = input.payer?.id?.trim() || "";
  const requestedNumber = Math.floor(Number(input.payer?.seatNumber));
  if (requestedId && !isExtraPayerId(requestedId)) {
    return { ok: false, code: "BAD_REQUEST", message: "Invalid extra payer id" };
  }

  let added: GuestSplitExtraPayer | null = null;
  const seatRows = await db.query.seats.findMany({
    where: and(
      eq(seatsTable.sessionId, access.sessionId),
      ne(seatsTable.status, "removed"),
    ),
    columns: { seatNumber: true },
  });
  const result = await writeExtraPayersLocked(access.sessionId, (payers) => {
    if (requestedId) {
      const existing = payers.find((payer) => payer.id === requestedId);
      if (existing) {
        added = existing;
        return;
      }
    }
    if (payers.length >= MAX_EXTRA_PAYERS) return;
    const nextNumber =
      Number.isFinite(requestedNumber) && requestedNumber >= 1
        ? requestedNumber
        : Math.max(
            0,
            ...payers.map((payer) => payer.seatNumber),
            ...seatRows.map((seat) => seat.seatNumber ?? 0),
            access.seatNumber ?? 0,
          ) + 1;
    added = {
      id: requestedId || `${EXTRA_PAYER_PREFIX}${crypto.randomUUID()}`,
      seatNumber: nextNumber,
    };
    payers.push(added);
  });

  if (!added) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: `At most ${MAX_EXTRA_PAYERS} extra payers are allowed`,
    };
  }

  return { ok: true, extraPayers: result.extraPayers, added };
}

export async function removeGuestTableExtraPayer(input: {
  storeSlug: string;
  tableNumber: string;
  deviceId: string;
  payerId: string;
}): Promise<
  | { ok: true; extraPayers: GuestSplitExtraPayer[]; claims: GuestSplitClaimsMap }
  | { ok: false; code: "NOT_FOUND" | "BAD_REQUEST" | "FORBIDDEN"; message: string }
> {
  const access = await requireClaimedSeat(input);
  if (!access.ok) return access;

  const payerId = input.payerId.trim();
  if (!payerId || !isExtraPayerId(payerId)) {
    return { ok: false, code: "BAD_REQUEST", message: "Invalid extra payer id" };
  }

  const result = await writeExtraPayersLocked(access.sessionId, (payers, claims) => {
    const idx = payers.findIndex((payer) => payer.id === payerId);
    if (idx < 0) return;
    payers.splice(idx, 1);

    for (const [lineId, record] of Object.entries(claims)) {
      const nextShares = (record.shares ?? []).filter((share) => share.seatId !== payerId);
      if (nextShares.length === 0) {
        delete claims[lineId];
      } else if (nextShares.length !== record.shares.length) {
        claims[lineId] = { ...record, shares: nextShares, lineId };
      }
    }
  });

  return { ok: true, extraPayers: result.extraPayers, claims: result.claims };
}
