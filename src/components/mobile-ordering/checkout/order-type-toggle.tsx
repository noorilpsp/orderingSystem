"use client";

import { Bike, Package, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGuestT } from "@/lib/guest-i18n";
import type { GuestOrderType } from "@/lib/guest-menu/types";

interface OrderTypeToggleProps {
  value: GuestOrderType;
  onChange: (type: GuestOrderType) => void;
  dineInEnabled?: boolean;
  pickupEnabled?: boolean;
  deliveryEnabled?: boolean;
}

function iconForOrderType(type: GuestOrderType): LucideIcon {
  switch (type) {
    case "dine-in":
      return UtensilsCrossed;
    case "pickup":
      return Package;
    case "delivery":
      return Bike;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export function OrderTypeToggle({
  value,
  onChange,
  dineInEnabled = true,
  pickupEnabled = true,
  deliveryEnabled = false,
}: OrderTypeToggleProps) {
  const t = useGuestT();
  const options: Array<{ type: GuestOrderType; label: string }> = [];
  if (dineInEnabled) options.push({ type: "dine-in", label: t("checkout.dineIn") });
  if (pickupEnabled) options.push({ type: "pickup", label: t("checkout.pickup") });
  if (deliveryEnabled) options.push({ type: "delivery", label: t("checkout.delivery") });

  if (options.length < 2) return null;

  return (
    <div className="mx-auto w-full max-w-md">
      <div
        role="group"
        aria-label={t("checkout.orderType")}
        className="flex rounded-full border border-border/70 bg-muted/50 p-0.5"
      >
        {options.map((option) => {
          const Icon = iconForOrderType(option.type);
          const selected = value === option.type;
          return (
            <button
              key={option.type}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.type)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 font-semibold transition-colors",
                options.length > 2 ? "px-1 text-sm" : "text-base",
                selected
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
