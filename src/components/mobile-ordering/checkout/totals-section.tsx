"use client";

import { useGuestT } from "@/lib/guest-i18n";

interface TotalsSectionProps {
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
}

export function TotalsSection({
  subtotal,
  tax,
  tip,
  total,
}: TotalsSectionProps) {
  const t = useGuestT();

  return (
    <div className="mb-0 space-y-3">
      {tax > 0 ? (
        <div className="flex justify-between text-base text-foreground">
          <span className="font-medium">{t("common.subtotal")}</span>
          <span className="font-medium">€{subtotal.toFixed(2)}</span>
        </div>
      ) : null}

      {tax > 0 ? (
        <div className="flex justify-between text-base text-foreground">
          <span className="font-medium">{t("common.tax")}</span>
          <span className="font-medium">€{tax.toFixed(2)}</span>
        </div>
      ) : null}

      <div className="flex justify-between text-base text-foreground">
        <span className="font-medium">{t("common.tip")}</span>
        <span className="font-medium">€{tip.toFixed(2)}</span>
      </div>

      <div className="h-px bg-gray-200 my-4" />

      <div className="flex justify-between items-center mb-0">
        <span className="text-lg font-bold text-foreground">{t("common.total")}</span>
        <span className="text-2xl font-bold text-foreground">
          €{total.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
