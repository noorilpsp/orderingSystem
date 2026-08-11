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

function formatSlotLabel(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toDayValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
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

function formatDayChipLabel(date: Date, today: Date): string {
  const slotDay = new Date(date);
  slotDay.setHours(0, 0, 0, 0);
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const diffDays = Math.round((slotDay.getTime() - todayStart.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

function formatDateChipLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatPickupScheduleLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Scheduled";
  const day = formatDayChipLabel(date, new Date());
  const time = formatSlotLabel(date);
  if (day === "Today") return time;
  if (day === "Tomorrow") return `Tomorrow · ${time}`;
  return `${day} ${formatDateChipLabel(date)} · ${time}`;
}

export function buildPickupSchedule(
  options: {
    hours?: GuestHoursEntry[] | null;
    prepMinutes?: number;
    stepMinutes?: number;
    daysAhead?: number;
    now?: Date;
  } = {},
): { days: PickupScheduleDay[]; slots: PickupScheduleSlot[] } {
  const {
    hours,
    prepMinutes = 15,
    stepMinutes = 15,
    daysAhead = 7,
    now = new Date(),
  } = options;

  const byWeekday = hoursByWeekday(hours);
  const hasAnyOpen = [...byWeekday.values()].some((blocks) => blocks.length > 0);
  const earliest = roundUpToStep(
    new Date(now.getTime() + prepMinutes * 60_000),
    stepMinutes,
  );

  const days: PickupScheduleDay[] = [];
  const slots: PickupScheduleSlot[] = [];

  for (let offset = 0; offset < daysAhead; offset += 1) {
    const dayDate = new Date(now);
    dayDate.setHours(0, 0, 0, 0);
    dayDate.setDate(dayDate.getDate() + offset);

    const weekday = dayDate.getDay();
    const blocks = hasAnyOpen
      ? (byWeekday.get(weekday) ?? [])
      : defaultBlocks();
    const dayValue = toDayValue(dayDate);
    let dayHasSlot = false;

    for (const block of blocks) {
      // Last pickup a little before close so kitchen can finish.
      const lastPickupMinutes = Math.max(block.openMinutes, block.closeMinutes - stepMinutes);
      for (
        let minutes = block.openMinutes;
        minutes <= lastPickupMinutes;
        minutes += stepMinutes
      ) {
        const slot = new Date(dayDate);
        slot.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
        if (slot < earliest) continue;

        dayHasSlot = true;
        slots.push({
          value: slot.toISOString(),
          label: formatSlotLabel(slot),
          dayValue,
          dayLabel: formatDayChipLabel(dayDate, now),
        });
      }
    }

    days.push({
      value: dayValue,
      label: formatDayChipLabel(dayDate, now),
      dateLabel: dayHasSlot ? formatDateChipLabel(dayDate) : "Closed",
      closed: !dayHasSlot,
    });
  }

  return { days, slots };
}

/** @deprecated Prefer buildPickupSchedule for day + time UI */
export function buildPickupScheduleSlots(options: {
  hours?: GuestHoursEntry[] | null;
  prepMinutes?: number;
  stepMinutes?: number;
  daysAhead?: number;
  maxHoursAhead?: number;
  now?: Date;
}): PickupScheduleSlot[] {
  const { slots } = buildPickupSchedule({
    hours: options.hours,
    prepMinutes: options.prepMinutes,
    stepMinutes: options.stepMinutes,
    daysAhead: options.daysAhead ?? 7,
    now: options.now,
  });
  return slots;
}
