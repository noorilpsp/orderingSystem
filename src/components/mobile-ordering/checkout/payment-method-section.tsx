"use client";

import { DollarSign, Store, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGuestT } from "@/lib/guest-i18n";
import type { EnMessageKey } from "@/lib/guest-i18n";

export type GuestPaymentMethodId =
  | "pay_at_pickup"
  | "pay_at_table"
  | "pay_at_counter";

type PaymentMethodOption = {
  id: GuestPaymentMethodId;
  labelKey: EnMessageKey;
  descriptionKey: EnMessageKey;
  icon: typeof DollarSign;
};

export function defaultGuestPaymentMethod(input: {
  orderType: "dine-in" | "pickup";
  usesTableSession: boolean;
  isSelfPickupMode: boolean;
}): GuestPaymentMethodId {
  if (input.orderType === "pickup") return "pay_at_pickup";
  if (input.usesTableSession) return "pay_at_table";
  if (input.isSelfPickupMode) return "pay_at_counter";
  return "pay_at_table";
}

function paymentMethodOptions(input: {
  orderType: "dine-in" | "pickup";
  usesTableSession: boolean;
}): PaymentMethodOption[] {
  if (input.orderType === "pickup") {
    return [
      {
        id: "pay_at_pickup",
        labelKey: "checkout.payAtPickup",
        descriptionKey: "checkout.payAtPickupDesc",
        icon: DollarSign,
      },
    ];
  }

  if (input.usesTableSession) {
    return [
      {
        id: "pay_at_table",
        labelKey: "checkout.payAtTable",
        descriptionKey: "checkout.payAtTableDesc",
        icon: UtensilsCrossed,
      },
    ];
  }

  return [
    {
      id: "pay_at_counter",
      labelKey: "checkout.payAtCounter",
      descriptionKey: "checkout.payAtCounterDesc",
      icon: Store,
    },
  ];
}

export function paymentMethodFooterHint(
  method: GuestPaymentMethodId,
  t: (key: EnMessageKey) => string,
): string {
  switch (method) {
    case "pay_at_pickup":
      return t("checkout.payAtPickupHint");
    case "pay_at_table":
      return t("checkout.payAtTableHint");
    case "pay_at_counter":
      return t("checkout.payAtCounterHint");
    default: {
      const _exhaustive: never = method;
      return _exhaustive;
    }
  }
}

interface PaymentMethodSectionProps {
  orderType: "dine-in" | "pickup";
  usesTableSession: boolean;
  isSelfPickupMode: boolean;
  selectedMethod: GuestPaymentMethodId;
  onMethodChange: (method: GuestPaymentMethodId) => void;
  className?: string;
}

export function PaymentMethodSection({
  orderType,
  usesTableSession,
  isSelfPickupMode: _isSelfPickupMode,
  selectedMethod,
  onMethodChange,
  className,
}: PaymentMethodSectionProps) {
  const t = useGuestT();
  const methods = paymentMethodOptions({
    orderType,
    usesTableSession,
  });

  return (
    <section
      className={cn(
        "rounded-2xl border border-border/70 bg-card/70 px-4 py-3 shadow-sm backdrop-blur-md",
        className,
      )}
    >
      <p className="mb-2 text-base font-semibold text-foreground">{t("checkout.paymentMethod")}</p>
      <div role="radiogroup" aria-label={t("checkout.paymentMethod")} className="space-y-2">
        {methods.map((method) => {
          const Icon = method.icon;
          const isSelected = selectedMethod === method.id;
          return (
            <button
              key={method.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onMethodChange(method.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                isSelected
                  ? "border-primary/60 bg-primary/10"
                  : "border-border/70 bg-background/40 hover:border-foreground/30",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  isSelected ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {t(method.labelKey)}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t(method.descriptionKey)}
                </span>
              </span>
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                  isSelected
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40 bg-transparent",
                )}
                aria-hidden
              >
                {isSelected ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
