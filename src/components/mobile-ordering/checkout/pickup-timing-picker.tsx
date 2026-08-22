"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, MoonStar, Zap } from "lucide-react";
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
  timeZone?: string | null;
  forceScheduled?: boolean;
  /** Hide the When-to-prepare card and only render the schedule sheet. */
  hideCard?: boolean;
  /** Increment to reopen the schedule sheet (e.g. Place order with no time). */
  openRequestKey?: number;
  onModeChange: (mode: PickupTimingMode) => void;
  onScheduledAtChange: (iso: string | null) => void;
  onSheetOpenChange?: (open: boolean) => void;
  className?: string;
}

function ClosedNowBanner({ className }: { className?: string }) {
  const t = useGuestT();
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-rose-400/40 bg-rose-500/15 px-3.5 py-3 text-rose-950 dark:border-rose-400/35 dark:bg-rose-500/20 dark:text-rose-50",
        className,
      )}
      role="status"
    >
      <MoonStar className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
      <div className="min-w-0">
        <p className="text-base font-bold leading-tight">{t("info.closedNow")}</p>
        <p className="mt-1 text-sm font-medium leading-snug opacity-90">
          {t("checkout.closedNowHint")}
        </p>
      </div>
    </div>
  );
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
  timeZone,
  forceScheduled = false,
  hideCard = false,
  openRequestKey = 0,
  onModeChange,
  onScheduledAtChange,
  onSheetOpenChange,
  className,
}: PickupTimingPickerProps) {
  const t = useGuestT();
  const copy = scheduleCopy(kind);
  const { days, slots } = useMemo(
    () => buildPickupSchedule({ hours, prepMinutes, daysAhead: 7, timeZone }),
    [hours, prepMinutes, timeZone],
  );
  const firstSlot = slots[0]?.value ?? null;
  const whenWeOpenSelected =
    forceScheduled && Boolean(firstSlot && scheduledAt === firstSlot);

  const firstOpenDay = useMemo(
    () => days.find((day) => !day.closed) ?? days[0] ?? null,
    [days],
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftDay, setDraftDay] = useState<string>(firstOpenDay?.value ?? "");
  const [draftSlot, setDraftSlot] = useState<string | null>(null);

  useEffect(() => {
    onSheetOpenChange?.(sheetOpen);
  }, [onSheetOpenChange, sheetOpen]);

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

  useEffect(() => {
    if (openRequestKey <= 0) return;
    openScheduleSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parent nonce
  }, [openRequestKey]);

  const handleConfirm = () => {
    if (draftClosed || !draftSlot) return;
    onModeChange("schedule");
    onScheduledAtChange(draftSlot);
    setSheetOpen(false);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (open) return;
    if (scheduledAt) return;
    if (forceScheduled) {
      onModeChange("schedule");
      return;
    }
    // Closing without a confirmed time falls back to Order now.
    onModeChange("now");
    onScheduledAtChange(null);
  };

  return (
    <>
      {hideCard ? null : (
      <section
        className={cn(
          "rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm backdrop-blur-md",
          className,
        )}
      >
        <p className="mb-3 text-base font-semibold text-foreground">{t("checkout.whenToPrepare")}</p>
        {forceScheduled ? <ClosedNowBanner className="mb-3" /> : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={forceScheduled ? whenWeOpenSelected : mode === "now"}
            disabled={forceScheduled && !firstSlot}
            onClick={() => {
              if (forceScheduled) {
                openScheduleSheet();
                return;
              }
              setSheetOpen(false);
              onModeChange("now");
              onScheduledAtChange(null);
            }}
            className={cn(
              "rounded-xl border px-3 py-3 text-left transition-colors",
              (forceScheduled ? whenWeOpenSelected : mode === "now")
                ? "border-primary bg-primary/10"
                : "border-border/70 bg-background/40 hover:border-border",
              forceScheduled && !firstSlot && "opacity-50",
            )}
          >
            <Zap className="mb-2 h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">
              {forceScheduled ? t("checkout.whenWeOpen") : t("checkout.orderNow")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {forceScheduled
                ? whenWeOpenSelected && firstSlot
                  ? formatPickupScheduleLabel(firstSlot, timeZone)
                  : t("checkout.pickTime")
                : t("checkout.readyAsap")}
            </p>
          </button>

          <button
            type="button"
            aria-pressed={mode === "schedule" && !whenWeOpenSelected}
            onClick={openScheduleSheet}
            className={cn(
              "rounded-xl border px-3 py-3 text-left transition-colors",
              mode === "schedule" && !whenWeOpenSelected
                ? "border-primary bg-primary/10"
                : "border-border/70 bg-background/40 hover:border-border",
            )}
          >
            <CalendarClock className="mb-2 h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">{t("checkout.schedule")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {mode === "schedule" && scheduledAt && !whenWeOpenSelected
                ? formatPickupScheduleLabel(scheduledAt, timeZone)
                : t("checkout.pickTime")}
            </p>
          </button>
        </div>
      </section>
      )}

      <Sheet open={sheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          side="bottom"
          showClose={false}
          className="flex h-[80dvh] max-h-[80dvh] flex-col overflow-hidden rounded-t-2xl border-border bg-card px-4 pt-3"
        >
          <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-border" />
          <SheetHeader className="shrink-0 bg-transparent px-0 pb-3 text-left">
            <SheetTitle>{t(copy.sheetTitle)}</SheetTitle>
            {forceScheduled ? <ClosedNowBanner className="mt-3" /> : null}
          </SheetHeader>

          {days.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              {t(copy.noTimes)}
            </p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0">
                <p className="mb-2 text-xs font-medium text-muted-foreground">{t("checkout.pickupDay")}</p>
                <div className="-mx-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex w-max gap-2 px-4">
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
              </div>

              <div className="mt-4 flex min-h-0 flex-1 flex-col">
                <p className="mb-2 shrink-0 text-xs font-medium text-muted-foreground">{t(copy.timeLabel)}</p>
                {draftClosed ? (
                  <div className="rounded-xl border border-dashed border-border/80 bg-muted/30 px-4 py-6 text-center">
                    <p className="text-sm font-semibold text-foreground">{t("checkout.closed")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("checkout.noTimesThatDay")}
                    </p>
                  </div>
                ) : (
                  <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-2 overflow-y-auto pr-0.5">
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

              <div className="shrink-0 bg-card pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
                <Button
                  type="button"
                  className="h-12 w-full text-base font-semibold"
                  disabled={draftClosed || !draftSlot}
                  onClick={handleConfirm}
                >
                  {t("common.confirm")}
                  {draftSlot && !draftClosed
                    ? ` · ${formatPickupScheduleLabel(draftSlot, timeZone)}`
                    : ""}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
