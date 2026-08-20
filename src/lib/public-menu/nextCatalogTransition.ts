import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { items, menus } from "@/db/schema";
import { merchantLocations } from "@/lib/db/schema/merchant-locations";
import { promotions } from "@/lib/db/schema/promotions";
import { nowInTimeZone } from "@/lib/promotions/schedule";
import { resolveStoreTimezone } from "@/lib/timezone/fromCountry";
import {
  dbScheduleToBlocks,
  nextWithinScheduleBoundary,
} from "@/lib/public-menu/resolveActiveMenu";

const ALL_DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6];

function parseDayIndex(day: string): number | undefined {
  return {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  }[day.toLowerCase()];
}

function sooner(current: Date | null, candidate: Date | null): Date | null {
  if (!candidate) return current;
  if (!current || candidate.getTime() < current.getTime()) return candidate;
  return current;
}

function dateAtMidnight(ymd: string, timeZoneNow: Date): Date | null {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const next = new Date(timeZoneNow);
  next.setHours(0, 0, 0, 0);
  next.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return next;
}

/**
 * Next merchant-configured time a public menu, item hours, or promo flips.
 * Returns null when nothing is scheduled to change.
 */
export async function getNextPublicMenuTransitionAt(
  locationId: string,
): Promise<Date | null> {
  const [location] = await db
    .select({
      timezone: merchantLocations.timezone,
      country: merchantLocations.country,
    })
    .from(merchantLocations)
    .where(eq(merchantLocations.id, locationId))
    .limit(1);

  const now = nowInTimeZone(
    resolveStoreTimezone({
      country: location?.country,
      locationTimezone: location?.timezone,
    }),
  );
  let next: Date | null = null;

  const [menuRows, itemRows, promoRows] = await Promise.all([
    db.query.menus.findMany({
      where: and(eq(menus.locationId, locationId), eq(menus.status, "active")),
      columns: { schedule: true },
    }),
    db.query.items.findMany({
      where: eq(items.locationId, locationId),
      columns: { useCustomHours: true, customSchedule: true, status: true },
    }),
    db.query.promotions.findMany({
      where: and(eq(promotions.locationId, locationId), eq(promotions.status, "active")),
      columns: {
        startsOn: true,
        endsOn: true,
        startTime: true,
        endTime: true,
        activeDays: true,
      },
    }),
  ]);

  for (const menu of menuRows) {
    next = sooner(next, nextWithinScheduleBoundary(dbScheduleToBlocks(menu.schedule), now));
  }

  for (const item of itemRows) {
    if (item.status === "draft" || item.status === "hidden") continue;
    if (!item.useCustomHours) continue;
    next = sooner(next, nextWithinScheduleBoundary(dbScheduleToBlocks(item.customSchedule), now));
  }

  for (const promo of promoRows) {
    const namedDays = (promo.activeDays ?? [])
      .map((day) => parseDayIndex(day))
      .filter((day): day is number => day !== undefined);
    next = sooner(
      next,
      nextWithinScheduleBoundary(
        [
          {
            days: namedDays.length > 0 ? namedDays : ALL_DAY_INDEXES,
            startTime: promo.startTime?.trim() || "00:00",
            endTime: promo.endTime?.trim() || "23:59",
          },
        ],
        now,
      ),
    );

    if (promo.startsOn) {
      const start = dateAtMidnight(String(promo.startsOn).slice(0, 10), now);
      next = sooner(next, start && start.getTime() > now.getTime() ? start : null);
    }
    if (promo.endsOn) {
      const endDay = dateAtMidnight(String(promo.endsOn).slice(0, 10), now);
      if (endDay) {
        const end = new Date(endDay);
        end.setHours(23, 59, 59, 0);
        next = sooner(next, end.getTime() > now.getTime() ? end : null);
      }
    }
  }

  return next;
}
