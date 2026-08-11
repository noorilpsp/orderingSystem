"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, User } from "lucide-react";
import { usePublicMenu } from "@/lib/contexts/PublicMenuContext";
import { cn } from "@/lib/utils";

type GuestSeatBannerProps = {
  className?: string;
  compact?: boolean;
};

export function GuestSeatBanner({ className, compact = false }: GuestSeatBannerProps) {
  const {
    orderType,
    tableNumber,
    guestSeat,
    guestSeatLoading,
    guestSeatError,
    updateGuestSeatName,
    changeGuestSeat,
    fetchTableSeats,
  } = usePublicMenu();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isChangeOpen, setIsChangeOpen] = useState(false);
  const [seatOptions, setSeatOptions] = useState<
    Array<{ seatNumber: number; seatId: string; claimed: boolean; guestName: string | null }>
  >([]);
  const [isChangingSeat, setIsChangingSeat] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);

  const showSeatUi = orderType === "dine-in" && tableNumber.trim().length > 0;

  const openChangeSeat = useCallback(async () => {
    setChangeError(null);
    setIsChangeOpen(true);
    const seats = await fetchTableSeats();
    const maxSeat = seats.reduce((max, seat) => Math.max(max, seat.seatNumber), 0);
    const nextSeatNumber = maxSeat + 1;
    setSeatOptions([
      ...seats,
      {
        seatId: `new-${nextSeatNumber}`,
        seatNumber: nextSeatNumber,
        claimed: false,
        guestName: null,
      },
    ]);
  }, [fetchTableSeats]);

  useEffect(() => {
    if (!isChangeOpen || !showSeatUi) return;
    if (seatOptions.length === 0) {
      void openChangeSeat();
    }
  }, [isChangeOpen, openChangeSeat, seatOptions.length, showSeatUi]);

  const handleSelectSeat = async (seatNumber: number) => {
    if (guestSeat?.seatNumber === seatNumber) {
      setIsChangeOpen(false);
      return;
    }
    setIsChangingSeat(true);
    setChangeError(null);
    const result = await changeGuestSeat(seatNumber);
    setIsChangingSeat(false);
    if (result.ok) {
      setIsChangeOpen(false);
      setSeatOptions([]);
      return;
    }
    setChangeError(result.message ?? "Unable to change seat");
  };

  if (!showSeatUi) {
    return null;
  }

  const openNameEditor = () => {
    setNameDraft(guestSeat?.guestName ?? "");
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    setIsSavingName(true);
    const result = await updateGuestSeatName(nameDraft.trim() || null);
    setIsSavingName(false);
    if (result.ok) {
      setIsEditingName(false);
    }
  };

  if (guestSeatLoading && !guestSeat) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-sm text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Assigning your seat...</span>
      </div>
    );
  }

  if (guestSeatError && !guestSeat) {
    return (
      <div
        className={cn(
          "rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100",
          className,
        )}
      >
        {guestSeatError}
      </div>
    );
  }

  if (!guestSeat) return null;

  const seatLabel = `Table ${tableNumber} · Seat ${guestSeat.seatNumber}`;

  return (
    <>
      <div
        className={cn(
          "rounded-xl border border-border/70 bg-card/70 px-3 py-2 shadow-sm backdrop-blur-md",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn("font-semibold text-foreground", compact ? "text-xs" : "text-sm")}>
              {seatLabel}
            </p>
            {guestSeat.guestName ? (
              <p className="text-xs text-muted-foreground">{guestSeat.guestName}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Your items stay on this check</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-xs font-medium text-primary underline"
              onClick={() => void openChangeSeat()}
            >
              Change
            </button>
            <button
              type="button"
              className="rounded-lg p-1 text-muted-foreground hover:bg-foreground/10"
              aria-label={guestSeat.guestName ? "Edit name" : "Add name"}
              onClick={openNameEditor}
            >
              {guestSeat.guestName ? (
                <Pencil className="h-3.5 w-3.5" />
              ) : (
                <User className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {isEditingName ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              placeholder="Your name (optional)"
              maxLength={255}
              className="h-9 flex-1 rounded-lg border border-border/70 bg-background px-3 text-sm"
            />
            <button
              type="button"
              disabled={isSavingName}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              onClick={() => void handleSaveName()}
            >
              {isSavingName ? "..." : "Save"}
            </button>
            <button
              type="button"
              className="rounded-lg px-2 py-2 text-xs text-muted-foreground"
              onClick={() => setIsEditingName(false)}
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>

      {isChangeOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl border border-border/70 bg-card p-4 shadow-xl">
            <p className="text-base font-semibold text-foreground">Change seat</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick another seat if you joined the wrong check.
            </p>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {seatOptions.map((seat) => {
                const isCurrent = guestSeat.seatNumber === seat.seatNumber;
                const isTaken = seat.claimed && !isCurrent;
                return (
                  <button
                    key={`${seat.seatId}-${seat.seatNumber}`}
                    type="button"
                    disabled={isChangingSeat || isTaken}
                    onClick={() => void handleSelectSeat(seat.seatNumber)}
                    className={cn(
                      "rounded-xl border px-2 py-3 text-sm font-semibold",
                      isCurrent
                        ? "border-primary bg-primary/10 text-primary"
                        : isTaken
                          ? "border-border/40 text-muted-foreground opacity-50"
                          : "border-border/70 bg-card/50 text-foreground hover:bg-foreground/5",
                    )}
                  >
                    {seat.seatNumber}
                  </button>
                );
              })}
            </div>
            {changeError ? (
              <p className="mt-3 text-xs text-red-500">{changeError}</p>
            ) : null}
            <button
              type="button"
              className="mt-4 flex h-10 w-full items-center justify-center rounded-xl border border-border/70 text-sm font-medium"
              onClick={() => {
                setIsChangeOpen(false);
                setSeatOptions([]);
                setChangeError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
