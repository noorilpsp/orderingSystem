/**
 * Deferred pickup scheduling: book now, release to live /orders later.
 * releaseAt = scheduledPickupAt - prepMinutes
 */

export function computeScheduledReleaseAt(
  scheduledPickupAt: Date,
  prepMinutes: number,
): Date {
  const bufferMs = Math.max(0, prepMinutes) * 60_000;
  return new Date(scheduledPickupAt.getTime() - bufferMs);
}

export function isScheduledOrderParked(input: {
  scheduledPickupAt: Date | string | null | undefined;
  prepMinutes: number;
  now?: Date;
}): boolean {
  if (input.scheduledPickupAt == null) return false;
  const scheduledAt =
    input.scheduledPickupAt instanceof Date
      ? input.scheduledPickupAt
      : new Date(input.scheduledPickupAt);
  if (Number.isNaN(scheduledAt.getTime())) return false;

  const now = input.now ?? new Date();
  const releaseAt = computeScheduledReleaseAt(scheduledAt, input.prepMinutes);
  return now.getTime() < releaseAt.getTime();
}

export function parseScheduledPickupAt(
  value: unknown,
): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatScheduledPickupNote(scheduledPickupAt: Date): string {
  const day = scheduledPickupAt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = scheduledPickupAt.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `Scheduled pickup: ${day} · ${time}`;
}
