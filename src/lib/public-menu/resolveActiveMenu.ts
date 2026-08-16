import type { OpeningHours } from "@/lib/db/schema/merchant-locations";

type MenuScheduleBlock = {
  days: number[];
  startTime: string;
  endTime: string;
};

type DbSchedule = Record<string, Array<{ open: string; close: string }>>;

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function normalizeTime(value: string): string {
  const trimmed = value.trim();
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [h, m] = trimmed.split(":");
    return `${h.padStart(2, "0")}:${m}`;
  }
  return trimmed;
}

function to24HourFormat(time12: string): string {
  if (!time12) return "00:00";
  if (!time12.includes("AM") && !time12.includes("PM")) {
    return normalizeTime(time12);
  }
  const match = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return "00:00";
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toUpperCase();
  if (period === "AM") {
    if (hours === 12) hours = 0;
  } else if (hours !== 12) {
    hours += 12;
  }
  return `${hours.toString().padStart(2, "0")}:${minutes}`;
}

export function dbScheduleToBlocks(schedule: unknown): MenuScheduleBlock[] {
  if (!schedule || typeof schedule !== "object") return [];

  const timeBlocks: Record<string, Array<{ day: string; open: string; close: string }>> = {};

  for (const [day, blocks] of Object.entries(schedule as DbSchedule)) {
    if (!Array.isArray(blocks)) continue;
    for (const block of blocks) {
      const normalizedOpen = normalizeTime(block.open);
      const normalizedClose = normalizeTime(block.close);
      const key = `${normalizedOpen}-${normalizedClose}`;
      if (!timeBlocks[key]) timeBlocks[key] = [];
      timeBlocks[key].push({ day, open: normalizedOpen, close: normalizedClose });
    }
  }

  const result: MenuScheduleBlock[] = [];
  for (const blocks of Object.values(timeBlocks)) {
    if (blocks.length === 0) continue;
    const days = blocks
      .map((block) => DAY_MAP[block.day])
      .filter((day): day is number => day !== undefined);
    if (days.length === 0) continue;
    result.push({
      days,
      startTime: blocks[0].open,
      endTime: blocks[0].close,
    });
  }
  return result;
}

export function isWithinSchedule(blocks: MenuScheduleBlock[], now = new Date()): boolean {
  if (blocks.length === 0) return true;
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();

  return blocks.some((block) => {
    const [startH, startM] = to24HourFormat(block.startTime).split(":").map(Number);
    const [endH, endM] = to24HourFormat(block.endTime).split(":").map(Number);
    if (!Number.isFinite(startH) || !Number.isFinite(endH)) return false;

    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes = endH * 60 + (endM || 0);
    const overnight = endMinutes < startMinutes;

    if (overnight) {
      const onStartDay = block.days.includes(day) && minutes >= startMinutes;
      const previousDay = (day + 6) % 7;
      const onEndDay = block.days.includes(previousDay) && minutes <= endMinutes;
      return onStartDay || onEndDay;
    }

    if (!block.days.includes(day)) return false;
    return minutes >= startMinutes && minutes <= endMinutes;
  });
}

function blockMinutes(block: MenuScheduleBlock): {
  startMinutes: number;
  endMinutes: number;
  overnight: boolean;
} | null {
  const [startH, startM] = to24HourFormat(block.startTime).split(":").map(Number);
  const [endH, endM] = to24HourFormat(block.endTime).split(":").map(Number);
  if (!Number.isFinite(startH) || !Number.isFinite(endH)) return null;
  const startMinutes = startH * 60 + (startM || 0);
  const endMinutes = endH * 60 + (endM || 0);
  return {
    startMinutes,
    endMinutes,
    overnight: endMinutes < startMinutes,
  };
}

function atMinutes(dayStart: Date, minutes: number): Date {
  const next = new Date(dayStart);
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return next;
}

/** Next start or end of these blocks after `now` (merchant-defined slots). */
export function nextWithinScheduleBoundary(
  blocks: MenuScheduleBlock[],
  now = new Date(),
): Date | null {
  if (blocks.length === 0) return null;
  const nowMs = now.getTime();
  let soonest: number | null = null;

  const consider = (value: Date) => {
    const ms = value.getTime();
    if (ms > nowMs && (soonest === null || ms < soonest)) soonest = ms;
  };

  for (let offset = 0; offset <= 8; offset += 1) {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() + offset);
    const weekday = dayStart.getDay();

    for (const block of blocks) {
      const times = blockMinutes(block);
      if (!times) continue;
      const startsToday = block.days.includes(weekday);
      if (startsToday) {
        consider(atMinutes(dayStart, times.startMinutes));
        if (!times.overnight) {
          consider(atMinutes(dayStart, times.endMinutes));
        } else {
          const nextDay = new Date(dayStart);
          nextDay.setDate(nextDay.getDate() + 1);
          consider(atMinutes(nextDay, times.endMinutes));
        }
      }
    }
  }

  return soonest === null ? null : new Date(soonest);
}

export function isItemAvailableNow(
  useCustomHours: boolean | null | undefined,
  customSchedule: unknown,
  now = new Date(),
): boolean {
  if (!useCustomHours) return true;
  const blocks = dbScheduleToBlocks(customSchedule);
  if (blocks.length === 0) return false;
  return isWithinSchedule(blocks, now);
}

export function resolveActiveMenu<
  T extends { id: string; name: string; schedule: unknown; status: string; displayOrder: number },
>(menus: T[], now = new Date()): T | null {
  const activeMenus = menus
    .filter((menu) => menu.status === "active")
    .sort((a, b) => a.displayOrder - b.displayOrder);

  for (const menu of activeMenus) {
    const blocks = dbScheduleToBlocks(menu.schedule);
    if (isWithinSchedule(blocks, now)) return menu;
  }

  return activeMenus[0] ?? null;
}

export function openingHoursToGuestHours(
  openingHours: OpeningHours | null | undefined,
): Array<{ day: string; time: string }> {
  if (!openingHours) return [];

  return DAY_NAMES.map((day) => {
    const blocks = openingHours[day];
    if (!blocks?.length) {
      return { day: day.charAt(0).toUpperCase() + day.slice(1), time: "Closed" };
    }
    const time = blocks.map((block) => `${block.open} - ${block.close}`).join(", ");
    return { day: day.charAt(0).toUpperCase() + day.slice(1), time };
  });
}
