"use client";

import { cn } from "@/lib/utils";
import { useGuestT } from "@/lib/guest-i18n";

interface OrderTypeToggleProps {
  value: "dine-in" | "pickup";
  onChange: (type: "dine-in" | "pickup") => void;
  dineInLabel?: string;
  pickupLabel?: string;
}

export function OrderTypeToggle({
  value,
  onChange,
  dineInLabel,
  pickupLabel,
}: OrderTypeToggleProps) {
  const t = useGuestT();
  const resolvedDineInLabel = dineInLabel ?? t("checkout.dineIn");
  const resolvedPickupLabel = pickupLabel ?? t("checkout.pickup");

  return (
    <div className="mx-auto w-full max-w-md">
      <div
        role="group"
        aria-label={t("checkout.orderType")}
        className="flex rounded-full border border-border/70 bg-muted/50 p-0.5"
      >
        <button
          type="button"
          aria-pressed={value === "dine-in"}
          onClick={() => onChange("dine-in")}
          className={cn(
            "flex-1 rounded-full py-1.5 text-base font-semibold transition-colors",
            value === "dine-in"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {resolvedDineInLabel}
        </button>
        <button
          type="button"
          aria-pressed={value === "pickup"}
          onClick={() => onChange("pickup")}
          className={cn(
            "flex-1 rounded-full py-1.5 text-base font-semibold transition-colors",
            value === "pickup"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {resolvedPickupLabel}
        </button>
      </div>
    </div>
  );
}
