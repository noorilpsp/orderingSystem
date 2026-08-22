import {
  addCalendarDays,
  getStoreWallParts,
  isValidIanaTimeZone,
  zonedWallTimeToUtc,
} from "@/lib/public-menu/store-wall-time";

export type GuestHoursEntry = {
  day: string;
  time: string;
};

export type PickupScheduleDay = {
  value: string; // YYYY-MM-DD
  label: string;
  dateLabel: string;
  closed: boolean;
};

export type PickupScheduleSlot = {
  value: string;
  label: string;
  dayValue: string;
  dayLabel: string;
};

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

type TimeBlock = { openMinutes: number; closeMinutes: number };

function roundUpToStep(date: Date, stepMinutes: number): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const remainder = rounded.getMinutes() % stepMinutes;
  if (remainder !== 0) {
    rounded.setMinutes(rounded.getMinutes() + (stepMinutes - remainder));
  }
  return rounded;
}

function localeTimeZone(
  timeZone?: string | null,
): string | undefined {
  const tz = timeZone?.trim();
  return tz && isValidIanaTimeZone(tz) ? tz : undefined;
}

function formatSlotLabel(date: Date, timeZone?: string | null): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: localeTimeZone(timeZone),
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseHm(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function parseGuestDayBlocks(time: string): TimeBlock[] {
  const normalized = time.trim();
  if (!normalized || /^closed$/i.test(normalized)) return [];

  const blocks: TimeBlock[] = [];
  for (const part of normalized.split(",")) {
    const range = part.trim().match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!range) continue;
    const openMinutes = parseHm(range[1]);
    const closeMinutes = parseHm(range[2]);
    if (openMinutes == null || closeMinutes == null) continue;
    if (closeMinutes <= openMinutes) continue;
    blocks.push({ openMinutes, closeMinutes });
  }
  return blocks;
}

function hoursByWeekday(
  hours: GuestHoursEntry[] | null | undefined,
): Map<number, TimeBlock[]> {
  const map = new Map<number, TimeBlock[]>();
  for (const entry of hours ?? []) {
    const key = entry.day.trim().toLowerCase();
    const weekday = DAY_KEYS.indexOf(key as (typeof DAY_KEYS)[number]);
    if (weekday < 0) continue;
    map.set(weekday, parseGuestDayBlocks(entry.time));
  }
  return map;
}

function defaultBlocks(): TimeBlock[] {
  return [{ openMinutes: 10 * 60, closeMinutes: 22 * 60 }];
}

function calendarDayNumber(date: Date, timeZone?: string | null): number {
  const wall = getStoreWallParts(date, localeTimeZone(timeZone) ?? null);
  return Date.UTC(wall.year, wall.month - 1, wall.day) / 86_400_000;
}

function formatDayChipLabel(
  date: Date,
  today: Date,
  timeZone?: string | null,
): string {
  const diffDays = Math.round(
    calendarDayNumber(date, timeZone) - calendarDayNumber(today, timeZone),
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    timeZone: localeTimeZone(timeZone),
  });
}

function formatDateChipLabel(date: Date, timeZone?: string | null): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: localeTimeZone(timeZone),
  });
}

export function formatPickupScheduleLabel(
  iso: string,
  timeZone?: string | null,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Scheduled";
  const now = new Date();
  const day = formatDayChipLabel(date, now, timeZone);
  const time = formatSlotLabel(date, timeZone);
  if (day === "Today") return time;
  if (day === "Tomorrow") return `Tomorrow · ${time}`;
  return `${day} ${formatDateChipLabel(date, timeZone)} · ${time}`;
}

function roundUpToStepInZone(
  date: Date,
  stepMinutes: number,
  timeZone?: string | null,
): Date {
  const tz = localeTimeZone(timeZone);
  if (!tz) return roundUpToStep(date, stepMinutes);

  const wall = getStoreWallParts(date, tz);
  const remainder = wall.minute % stepMinutes;
  let minute = wall.minute;
  let hour = wall.hour;
  let dayOffset = 0;
  if (remainder !== 0) {
    minute += stepMinutes - remainder;
  }
  if (minute >= 60) {
    hour += Math.floor(minute / 60);
    minute %= 60;
  }
  if (hour >= 24) {
    dayOffset += Math.floor(hour / 24);
    hour %= 24;
  }
  const nextDay = addCalendarDays(wall.year, wall.month, wall.day, dayOffset);
  return zonedWallTimeToUtc(
    {
      year: nextDay.year,
      month: nextDay.month,
      day: nextDay.day,
      hour,
      minute,
    },
    tz,
  );
}

export function buildPickupSchedule(
  options: {
    hours?: GuestHoursEntry[] | null;
    prepMinutes?: number;
    stepMinutes?: number;
    daysAhead?: number;
    now?: Date;
    timeZone?: string | null;
  } = {},
): { days: PickupScheduleDay[]; slots: PickupScheduleSlot[] } {
  const {
    hours,
    prepMinutes = 15,
    stepMinutes = 15,
    daysAhead = 7,
    now = new Date(),
    timeZone,
  } = options;

  const tz = localeTimeZone(timeZone) ?? null;
  const byWeekday = hoursByWeekday(hours);
  const hasAnyOpen = [...byWeekday.values()].some((blocks) => blocks.length > 0);
  const hasHoursConfig = (hours?.length ?? 0) > 0;
  const earliest = roundUpToStepInZone(
    new Date(now.getTime() + prepMinutes * 60_000),
    stepMinutes,
    tz,
  );

  const days: PickupScheduleDay[] = [];
  const slots: PickupScheduleSlot[] = [];
  const nowWall = getStoreWallParts(now, tz);

  for (let offset = 0; offset < daysAhead; offset += 1) {
    const wallDay = addCalendarDays(nowWall.year, nowWall.month, nowWall.day, offset);
    const weekday = new Date(Date.UTC(wallDay.year, wallDay.month - 1, wallDay.day)).getUTCDay();
    const blocks = hasAnyOpen
      ? (byWeekday.get(weekday) ?? [])
      : hasHoursConfig
        ? []
        : defaultBlocks();
    const dayValue = `${wallDay.year}-${pad2(wallDay.month)}-${pad2(wallDay.day)}`;
    const dayInstant = tz
      ? zonedWallTimeToUtc(
          {
            year: wallDay.year,
            month: wallDay.month,
            day: wallDay.day,
            hour: 12,
            minute: 0,
          },
          tz,
        )
      : (() => {
          const local = new Date(now);
          local.setHours(0, 0, 0, 0);
          local.setDate(local.getDate() + offset);
          return local;
        })();
    let dayHasSlot = false;

    for (const block of blocks) {
      // Last pickup a little before close so kitchen can finish.
      const lastPickupMinutes = Math.max(block.openMinutes, block.closeMinutes - stepMinutes);
      for (
        let minutes = block.openMinutes;
        minutes <= lastPickupMinutes;
        minutes += stepMinutes
      ) {
        const hour = Math.floor(minutes / 60);
        const minute = minutes % 60;
        const slot = tz
          ? zonedWallTimeToUtc(
              {
                year: wallDay.year,
                month: wallDay.month,
                day: wallDay.day,
                hour,
                minute,
              },
              tz,
            )
          : (() => {
              const local = new Date(dayInstant);
              local.setHours(hour, minute, 0, 0);
              return local;
            })();
        if (slot < earliest) continue;

        dayHasSlot = true;
        slots.push({
          value: slot.toISOString(),
          label: formatSlotLabel(slot, tz),
          dayValue,
          dayLabel: formatDayChipLabel(dayInstant, now, tz),
        });
      }
    }

    days.push({
      value: dayValue,
      label: formatDayChipLabel(dayInstant, now, tz),
      dateLabel: dayHasSlot ? formatDateChipLabel(dayInstant, tz) : "Closed",
      closed: !dayHasSlot,
    });
  }

  return { days, slots };
}

export function nextGuestFulfillmentAt(options: {
  hours?: GuestHoursEntry[] | null;
  prepMinutes?: number;
  stepMinutes?: number;
  daysAhead?: number;
  now?: Date;
  timeZone?: string | null;
}): Date | null {
  const { slots } = buildPickupSchedule({
    hours: options.hours,
    prepMinutes: options.prepMinutes,
    stepMinutes: options.stepMinutes,
    daysAhead: options.daysAhead ?? 7,
    now: options.now,
    timeZone: options.timeZone,
  });
  const iso = slots[0]?.value;
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** @deprecated Prefer buildPickupSchedule for day + time UI */
export function buildPickupScheduleSlots(options: {
  hours?: GuestHoursEntry[] | null;
  prepMinutes?: number;
  stepMinutes?: number;
  daysAhead?: number;
  maxHoursAhead?: number;
  now?: Date;
  timeZone?: string | null;
}): PickupScheduleSlot[] {
  const { slots } = buildPickupSchedule({
    hours: options.hours,
    prepMinutes: options.prepMinutes,
    stepMinutes: options.stepMinutes,
    daysAhead: options.daysAhead ?? 7,
    now: options.now,
    timeZone: options.timeZone,
  });
  return slots;
}
