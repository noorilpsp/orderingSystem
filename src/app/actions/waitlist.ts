"use server";

import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { waitlist as waitlistTable } from "@/lib/db/schema/orders";
import { verifyLocationAccess } from "@/lib/location-access";
import {
  createReservation,
  seatReservation,
} from "@/app/actions/reservations";
import { deleteReservationMutation } from "@/domain/reservation-mutations";
import type { WaitlistEntry } from "@/store/types";

export type SeatFromWaitlistResult =
  | { ok: true; reservationId: string; sessionId: string; tableId: string }
  | { ok: false; reason: string };

/**
 * Get waitlist entries for a location
 */
export async function getWaitlistForLocation(
  locationId: string
): Promise<WaitlistEntry[]> {
  const location = await verifyLocationAccess(locationId);
  if (!location) {
    throw new Error("Unauthorized or location not found");
  }

  const rows = await db.query.waitlist.findMany({
    where: eq(waitlistTable.locationId, locationId),
    orderBy: (w, { asc }) => [asc(w.addedAt)],
  });

  return rows.map((r) => ({
    id: r.id,
    guestName: r.guestName,
    partySize: r.partySize,
    phone: r.phone ?? undefined,
    addedAt: r.addedAt.toISOString(),
    waitTime: r.waitTime ?? "-",
    notes: r.notes ?? undefined,
  }));
}

export async function addToWaitlist(
  locationId: string,
  data: { guestName: string; partySize: number; phone?: string; notes?: string; waitTime?: string }
): Promise<{ id: string }> {
  const location = await verifyLocationAccess(locationId);
  if (!location) {
    throw new Error("Unauthorized or location not found");
  }

  const [inserted] = await db
    .insert(waitlistTable)
    .values({
      locationId,
      guestName: data.guestName,
      partySize: data.partySize,
      phone: data.phone ?? null,
      notes: data.notes ?? null,
      waitTime: data.waitTime ?? null,
    })
    .returning({ id: waitlistTable.id });

  if (!inserted) throw new Error("Failed to add to waitlist");
  return { id: inserted.id };
}

export async function removeFromWaitlist(
  locationId: string,
  waitlistId: string
): Promise<void> {
  const location = await verifyLocationAccess(locationId);
  if (!location) {
    throw new Error("Unauthorized or location not found");
  }

  await db
    .delete(waitlistTable)
    .where(
      and(
        eq(waitlistTable.id, waitlistId),
        eq(waitlistTable.locationId, locationId)
      )
    );
}

export async function updateWaitlistEntry(
  locationId: string,
  waitlistId: string,
  data: { guestName?: string; partySize?: number; phone?: string; notes?: string; waitTime?: string }
): Promise<void> {
  const location = await verifyLocationAccess(locationId);
  if (!location) {
    throw new Error("Unauthorized or location not found");
  }

  await db
    .update(waitlistTable)
    .set({
      ...(data.guestName !== undefined && { guestName: data.guestName }),
      ...(data.partySize !== undefined && { partySize: data.partySize }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.waitTime !== undefined && { waitTime: data.waitTime }),
      updatedAt: new Date(),
    })
    .where(eq(waitlistTable.id, waitlistId));
}

/**
 * Seat a waitlist party: create a reservation, seat it (create session), then remove from waitlist.
 * Requires tableUuid (table id or display id e.g. "T12").
 */
export async function seatFromWaitlist(
  locationId: string,
  waitlistEntryId: string,
  tableUuid: string
): Promise<SeatFromWaitlistResult> {
  const location = await verifyLocationAccess(locationId);
  if (!location) {
    return { ok: false, reason: "Unauthorized or location not found" };
  }

  const trimmedTable = tableUuid?.trim();
  if (!trimmedTable) {
    return { ok: false, reason: "Table is required" };
  }

  const waitlistRow = await db.query.waitlist.findFirst({
    where: and(
      eq(waitlistTable.id, waitlistEntryId),
      eq(waitlistTable.locationId, locationId)
    ),
    columns: { id: true, guestName: true, partySize: true, phone: true, notes: true },
  });

  if (!waitlistRow) {
    return { ok: false, reason: "Waitlist entry not found" };
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const timeNow =
    now.getHours().toString().padStart(2, "0") +
    ":" +
    now.getMinutes().toString().padStart(2, "0");

  let created;
  try {
    created = await createReservation(locationId, {
      customerName: waitlistRow.guestName,
      customerPhone: waitlistRow.phone ?? undefined,
      partySize: Math.max(1, waitlistRow.partySize),
      reservationDate: today,
      reservationTime: timeNow,
      notes: waitlistRow.notes ?? undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create reservation";
    return { ok: false, reason: msg };
  }

  const seatResult = await seatReservation(locationId, created.id, trimmedTable);
  if (!seatResult.ok) {
    await deleteReservationMutation(locationId, created.id);
    return seatResult;
  }

  await db
    .delete(waitlistTable)
    .where(
      and(
        eq(waitlistTable.id, waitlistEntryId),
        eq(waitlistTable.locationId, locationId)
      )
    );

  return {
    ok: true,
    reservationId: created.id,
    sessionId: seatResult.sessionId,
    tableId: seatResult.tableId,
  };
}
