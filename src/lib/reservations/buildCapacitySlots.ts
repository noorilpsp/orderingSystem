/**
 * Capacity aggregation engine - computes real seat occupancy per 30-minute slot
 * from reservations, sessions, and location capacity.
 *
 * Pure synchronous function. No side effects.
 */

export type CapacitySlotInput = {
  time: string;
  seatsOccupied: number;
  totalSeats: number;
  occupancyPct: number;
  arrivals: number;
};

/** Output shape compatible with CapacitySlot (arrivingReservations, predictedTurns). */
export type CapacitySlot = CapacitySlotInput & {
  arrivingReservations: number;
  predictedTurns: number;
};

export type ReservationForCapacity = {
  date: string | Date;
  time: string;
  status: string;
  partySize?: number;
};

export type SessionForCapacity = {
  openedAt: Date;
  closedAt: Date | null;
  guestCount: number;
  status: string;
};

export type BuildCapacitySlotsOptions = {
  /** Slot range start, "HH:mm". Default "17:00". */
  startTime?: string;
  /** Slot range end, "HH:mm". Default "23:00". */
  endTime?: string;
  /** Slot duration in minutes. Default 30. */
  slotMinutes?: number;
};

/** Parse time to minutes. Handles "HH:MM" (24h) and "H:MM AM/PM". Returns 0 if invalid. */
function parseTimeToMinutes(time: string): number {
  if (!time || typeof time !== "string") return 0;
  const t = time.trim();
  const m24 = t.match(/^(\d{1,2}):(\d{1,2})\s*$/);
  if (m24) {
    const h = Number.parseInt(m24[1]!, 10);
    const m = Number.parseInt(m24[2]!, 10);
    if (!Number.isNaN(h) && !Number.isNaN(m)) return h * 60 + m;
  }
  const m12 = t.match(/^(\d{1,2}):(\d{1,2})\s*(AM|PM)\s*$/i);
  if (m12) {
    let h = Number.parseInt(m12[1]!, 10);
    const m = Number.parseInt(m12[2]!, 10);
    const isPM = m12[3]!.toUpperCase() === "PM";
    if (Number.isNaN(h) || Number.isNaN(m)) return 0;
    if (h === 12) h = isPM ? 12 : 0;
    else if (isPM) h += 12;
    return h * 60 + m;
  }
  return 0;
}

function minutesToTime(totalMin: number): string {
  const n = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(n / 60)
    .toString()
    .padStart(2, "0");
  const m = (n % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Build capacity slots for a date from reservations and sessions.
 *
 * - seatsOccupied: sum of guestCount for sessions overlapping the slot
 * - arrivals: count of reservations in [pending, confirmed] whose time falls in the slot
 */
export function buildCapacitySlots(
  reservations: ReservationForCapacity[],
  sessions: SessionForCapacity[],
  totalSeats: number,
  date: string,
  options?: BuildCapacitySlotsOptions
): CapacitySlot[] {
  const startTime = options?.startTime ?? "17:00";
  const endTime = options?.endTime ?? "23:00";
  const slotMinutes = options?.slotMinutes ?? 30;

  const startMin = parseTimeToMinutes(startTime);
  let endMin = parseTimeToMinutes(endTime);
  if (endMin <= startMin) endMin += 24 * 60;

  const slots: CapacitySlot[] = [];

  for (let m = startMin; m < endMin; m += slotMinutes) {
    const slotTime = minutesToTime(m);
    const slotStart = new Date(`${date}T${slotTime}:00`);
    const slotEnd = new Date(slotStart.getTime() + slotMinutes * 60 * 1000);

    let seatsOccupied = 0;
    for (const s of sessions) {
      if (s.status === "cancelled") continue;
      const openedAt = s.openedAt instanceof Date ? s.openedAt : new Date(s.openedAt);
      const closedAt = s.closedAt == null ? null : s.closedAt instanceof Date ? s.closedAt : new Date(s.closedAt);

      const overlaps =
        openedAt < slotEnd && (closedAt === null || closedAt > slotStart);
      if (overlaps) seatsOccupied += Math.max(0, s.guestCount ?? 0);
    }

    const arrivals = reservations.filter((r) => {
      const resDate =
        r.date instanceof Date
          ? r.date.toISOString().slice(0, 10)
          : String(r.date ?? "").slice(0, 10);
      if (resDate !== date) return false;
      const resStatus = (r.status ?? "").toLowerCase();
      if (
        resStatus === "seated" ||
        resStatus === "completed" ||
        resStatus === "cancelled" ||
        resStatus === "noshow" ||
        resStatus === "no_show"
      )
        return false;

      const resMin = parseTimeToMinutes(r.time);
      const slotStartMin = m;
      const slotEndMin = m + slotMinutes;
      return resMin >= slotStartMin && resMin < slotEndMin;
    }).length;

    const occupancyPct =
      totalSeats > 0
        ? Math.round(Math.min(100, (seatsOccupied / totalSeats) * 100))
        : 0;

    slots.push({
      time: slotTime,
      seatsOccupied,
      totalSeats,
      occupancyPct,
      arrivals,
      arrivingReservations: arrivals,
      predictedTurns: 0,
    });
  }

  return slots;
}

/** Default empty slots (17:00–23:00) when no real data. */
export function getDefaultCapacitySlots(
  totalSeats: number,
  options?: BuildCapacitySlotsOptions
): CapacitySlot[] {
  return buildCapacitySlots([], [], totalSeats, new Date().toISOString().slice(0, 10), options);
}
