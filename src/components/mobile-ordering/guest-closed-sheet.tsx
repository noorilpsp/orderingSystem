"use client";

import { CalendarClock, MoonStar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGuestT } from "@/lib/guest-i18n";

type GuestClosedSheetProps = {
  open: boolean;
  restaurantName: string;
  opensAtLabel: string | null;
  onSchedule: () => void;
  onBrowse: () => void;
  /** Close without persisting — used for unmount / refresh, not a real choice. */
  onClose: () => void;
};

export function GuestClosedSheet({
  open,
  restaurantName,
  opensAtLabel,
  onSchedule,
  onBrowse,
  onClose,
}: GuestClosedSheetProps) {
  const t = useGuestT();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        onPointerDownOutside={onBrowse}
        onEscapeKeyDown={onBrowse}
        className="bottom-0 top-auto max-w-md translate-x-[-50%] translate-y-0 gap-0 overflow-hidden rounded-t-3xl border-border/80 bg-card p-0 text-foreground shadow-2xl shadow-black/30 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:max-w-md"
      >
        <div className="relative overflow-hidden px-5 pb-2 pt-5">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_10%_0%,rgba(244,63,94,0.18),transparent_55%),radial-gradient(90%_70%_at_100%_20%,rgba(59,130,246,0.10),transparent_50%)]"
          />
          <div className="relative mx-auto mb-4 flex h-1 w-10 rounded-full bg-border/80" />
          <div className="relative space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-rose-400/35 bg-rose-500/15 text-rose-600 dark:text-rose-300">
              <MoonStar className="h-6 w-6" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {restaurantName}
            </p>
            <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
              {t("info.closedNow")}
            </DialogTitle>
            <DialogDescription className="mx-auto max-w-[20rem] text-sm leading-relaxed text-muted-foreground">
              {opensAtLabel
                ? t("closed.sheetSubtitle", { time: opensAtLabel })
                : t("closed.sheetSubtitleNoTime")}
            </DialogDescription>
          </div>
        </div>

        <div className="space-y-2 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
          <button
            type="button"
            onClick={onSchedule}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <CalendarClock className="h-4 w-4" />
            {t("closed.scheduleOrder")}
          </button>
          <button
            type="button"
            onClick={onBrowse}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border/80 bg-background/70 text-sm font-semibold text-foreground transition hover:bg-muted/60"
          >
            {t("closed.browseMenu")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
