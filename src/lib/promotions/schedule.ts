import { isWithinSchedule } from "@/lib/public-menu/resolveActiveMenu";

const ALL_DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export type PromotionSchedule = {
  startsOn: string | Date | null;
  endsOn: string | Date | null;
  activeDays: string[] | null;
  startTime: string | null;
  endTime: string | null;
};

export function nowInTimeZone(timeZone?: string | null): Date {
  const tz = timeZone?.trim();
  if (!tz) return new Date();
  try {
    return new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  } catch {
    return new Date();
  }
}

function toYmd(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return match?.[1] ?? null;
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isPromotionScheduleActive(
  schedule: PromotionSchedule,
  now = new Date(),
  timeZone?: string | null,
): boolean {
  const zoned = timeZone ? nowInTimeZone(timeZone) : now;
  const today = toYmd(zoned);
  const startsOn = toYmd(schedule.startsOn);
  const endsOn = toYmd(schedule.endsOn);
  if (today && startsOn && today < startsOn) return false;
  if (today && endsOn && today > endsOn) return false;

  const namedDays = (schedule.activeDays ?? []).filter((day) =>
    Boolean(DAY_MAP[day.toLowerCase()]),
  );
  const days =
    namedDays.length > 0
      ? namedDays.map((day) => DAY_MAP[day.toLowerCase()])
      : ALL_DAYS.map((day) => DAY_MAP[day]);

  return isWithinSchedule(
    [
      {
        days,
        startTime: schedule.startTime?.trim() || "00:00",
        endTime: schedule.endTime?.trim() || "23:59",
      },
    ],
    zoned,
  );
}
