/** Calendar date/time in a store IANA zone (or the runtime local zone). */
export type StoreWallParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function partNumber(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  return Number(parts.find((part) => part.type === type)?.value);
}

export function isValidIanaTimeZone(timeZone?: string | null): boolean {
  const tz = timeZone?.trim();
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function getStoreWallParts(
  now: Date,
  timeZone?: string | null,
): StoreWallParts {
  const tz = timeZone?.trim();
  if (!tz || !isValidIanaTimeZone(tz)) {
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
    };
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  let hour = partNumber(parts, "hour");
  if (hour === 24) hour = 0;

  return {
    year: partNumber(parts, "year"),
    month: partNumber(parts, "month"),
    day: partNumber(parts, "day"),
    hour,
    minute: partNumber(parts, "minute"),
  };
}

export function addCalendarDays(
  year: number,
  month: number,
  day: number,
  offset: number,
): { year: number; month: number; day: number } {
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/**
 * Convert a wall-clock time in `timeZone` to a real UTC instant.
 * `month` is 1-12.
 */
export function zonedWallTimeToUtc(
  wall: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  },
  timeZone: string,
): Date {
  const asUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    0,
  );

  const offsetMs = (instant: number) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(instant));
    let hour = partNumber(parts, "hour");
    if (hour === 24) hour = 0;
    const asIfUtc = Date.UTC(
      partNumber(parts, "year"),
      partNumber(parts, "month") - 1,
      partNumber(parts, "day"),
      hour,
      partNumber(parts, "minute"),
      partNumber(parts, "second"),
    );
    return asIfUtc - instant;
  };

  let utc = asUtc - offsetMs(asUtc);
  utc = asUtc - offsetMs(utc);
  return new Date(utc);
}
