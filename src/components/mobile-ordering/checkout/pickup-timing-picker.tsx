"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  buildPickupSchedule,
  formatPickupScheduleLabel,
  type GuestHoursEntry,
} from "@/lib/public-menu/buildPickupScheduleSlots";
import { useGuestT, type EnMessageKey } from "@/lib/guest-i18n";

export type PickupTimingMode = "now" | "schedule";
export type FulfillmentScheduleKind = "pickup" | "delivery";

interface PickupTimingPickerProps {
  mode: PickupTimingMode;
  scheduledAt: string | null;
  hours?: GuestHoursEntry[] | null;
  prepMinutes?: number;
  kind?: FulfillmentScheduleKind;
  onModeChange: (mode: PickupTimingMode) => void;
  onScheduledAtChange: (iso: string | null) => void;
  className?: string;
}

function scheduleCopy(kind: FulfillmentScheduleKind): {
  sheetTitle: EnMessageKey;
  timeLabel: EnMessageKey;
  noTimes: EnMessageKey;
} {
  switch (kind) {
    case "delivery":
      return {
        sheetTitle: "checkout.scheduleDelivery",
        timeLabel: "checkout.deliveryTime",
        noTimes: "checkout.noDeliveryTimes",
      };
    case "pickup":
      return {
        sheetTitle: "checkout.schedulePickup",
        timeLabel: "checkout.pickupTime",
        noTimes: "checkout.noTimes",
      };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function PickupTimingPicker({
  mode,
  scheduledAt,
  hours,
  prepMinutes = 15,
  kind = "pickup",
  onModeChange,
  onScheduledAtChange,
  className,
}: PickupTimingPickerProps) {
  const t = useGuestT();
  const copy = scheduleCopy(kind);
  const { days, slots } = useMemo(
    () => buildPickupSchedule({ hours, prepMinutes, daysAhead: 7 }),
    [hours, prepMinutes],
  );

  const firstOpenDay = useMemo(
    () => days.find((day) => !day.closed) ?? days[0] ?? null,
    [days],
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftDay, setDraftDay] = useState<string>(firstOpenDay?.value ?? "");
  const [draftSlot, setDraftSlot] = useState<string | null>(null);

  const draftDayInfo = days.find((day) => day.value === draftDay) ?? null;
  const draftClosed = draftDayInfo?.closed === true;

  const daySlots = useMemo(
    () => slots.filter((slot) => slot.dayValue === draftDay),
    [draftDay, slots],
  );

  const syncDraftFromScheduled = () => {
    if (scheduledAt) {
      const match = slots.find((slot) => slot.value === scheduledAt);
      if (match) {
        setDraftDay(match.dayValue);
        setDraftSlot(match.value);
        return;
      }
    }
    const openDay = firstOpenDay?.value ?? days[0]?.value ?? "";
    setDraftDay(openDay);
    const first = slots.find((slot) => slot.dayValue === openDay) ?? slots[0] ?? null;
    setDraftSlot(first?.value ?? null);
  };

  const openScheduleSheet = () => {
    onModeChange("schedule");
    syncDraftFromScheduled();
    setSheetOpen(true);
  };

  useEffect(() => {
    if (!days.length) {
      setDraftDay("");
      return;
    }
    if (!days.some((day) => day.value === draftDay)) {
      setDraftDay(firstOpenDay?.value ?? days[0].value);
    }
  }, [days, draftDay, firstOpenDay]);

  const handleConfirm = () => {
    if (draftClosed || !draftSlot) return;
    onModeChange("schedule");
    onScheduledAtChange(draftSlot);
    setSheetOpen(false);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (open) return;
    // Closing without a confirmed time falls back to Order now.
    if (!scheduledAt) {
      onModeChange("now");
      onScheduledAtChange(null);
    }
  };

  return (
    <>
      <section
        className={cn(
          "rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm backdrop-blur-md",
          className,
        )}
      >
        <p className="mb-3 text-base font-semibold text-foreground">{t("checkout.whenToPrepare")}</p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={mode === "now"}
            onClick={() => {
              setSheetOpen(false);
              onModeChange("now");
              onScheduledAtChange(null);
            }}
            className={cn(
              "rounded-xl border px-3 py-3 text-left transition-colors",
              mode === "now"
                ? "border-primary bg-primary/10"
                : "border-border/70 bg-background/40 hover:border-border",
            )}
          >
            <Zap className="mb-2 h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">{t("checkout.orderNow")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("checkout.readyAsap")}</p>
          </button>

          <button
            type="button"
            aria-pressed={mode === "schedule"}
            onClick={openScheduleSheet}
            className={cn(
              "rounded-xl border px-3 py-3 text-left transition-colors",
              mode === "schedule"
                ? "border-primary bg-primary/10"
                : "border-border/70 bg-background/40 hover:border-border",
            )}
          >
            <CalendarClock className="mb-2 h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">{t("checkout.schedule")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {mode === "schedule" && scheduledAt
                ? formatPickupScheduleLabel(scheduledAt)
                : t("checkout.pickTime")}
            </p>
          </button>
        </div>
      </section>

      <Sheet open={sheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          side="bottom"
          showClose={false}
          className="h-[80vh] max-h-[80vh] rounded-t-2xl border-border bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3"
        >
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
          <SheetHeader className="bg-transparent px-0 pb-3 text-left">
            <SheetTitle>{t(copy.sheetTitle)}</SheetTitle>
          </SheetHeader>

          {days.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              {t(copy.noTimes)}
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">{t("checkout.pickupDay")}</p>
                <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {days.map((day) => {
                    const selected = draftDay === day.value;
                    return (
                      <button
                        key={day.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setDraftDay(day.value);
                          if (day.closed) {
                            setDraftSlot(null);
                            return;
                          }
                          const first = slots.find((slot) => slot.dayValue === day.value);
                          setDraftSlot(first?.value ?? null);
                        }}
                        className={cn(
                          "shrink-0 rounded-lg border px-3 py-2 text-left transition-colors",
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-border/70 bg-background/40 hover:border-border",
                          day.closed && "opacity-70",
                        )}
                      >
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            day.closed ? "text-muted-foreground" : "text-foreground",
                          )}
                        >
                          {day.label}
                        </p>
                        <p
                          className={cn(
                            "text-[11px]",
                            day.closed ? "font-medium text-rose-500" : "text-muted-foreground",
                          )}
                        >
                          {day.dateLabel}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">{t(copy.timeLabel)}</p>
                {draftClosed ? (
                  <div className="rounded-xl border border-dashed border-border/80 bg-muted/30 px-4 py-6 text-center">
                    <p className="text-sm font-semibold text-foreground">{t("checkout.closed")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("checkout.noTimesThatDay")}
                    </p>
                  </div>
                ) : (
                  <div className="grid max-h-[48vh] grid-cols-3 gap-2 overflow-y-auto pr-0.5">
                    {daySlots.map((slot) => {
                      const selected = draftSlot === slot.value;
                      return (
                        <button
                          key={slot.value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setDraftSlot(slot.value)}
                          className={cn(
                            "rounded-lg border px-2 py-2 text-sm font-semibold transition-colors",
                            selected
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border/70 bg-background/40 text-foreground hover:border-border",
                          )}
                        >
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <Button
                type="button"
                className="h-12 w-full text-base font-semibold"
                disabled={draftClosed || !draftSlot}
                onClick={handleConfirm}
              >
                {t("common.confirm")}
                {draftSlot && !draftClosed
                  ? ` · ${formatPickupScheduleLabel(draftSlot)}`
                  : ""}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
