"use client";

import { useGuestT } from "@/lib/guest-i18n";
import { useGuestLocalization } from "@/lib/hooks/useGuestLocalization";

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
  const { formatMoney } = useGuestLocalization();

  return (
    <div className="mb-0 space-y-3">
      {tax > 0 ? (
        <div className="flex justify-between text-base text-foreground">
          <span className="font-medium">{t("common.subtotal")}</span>
          <span className="font-medium">{formatMoney(subtotal)}</span>
        </div>
      ) : null}

      {tax > 0 ? (
        <div className="flex justify-between text-base text-foreground">
          <span className="font-medium">{t("common.tax")}</span>
          <span className="font-medium">{formatMoney(tax)}</span>
        </div>
      ) : null}

      <div className="flex justify-between text-base text-foreground">
        <span className="font-medium">{t("common.tip")}</span>
        <span className="font-medium">{formatMoney(tip)}</span>
      </div>

      <div className="h-px bg-gray-200 my-4" />

      <div className="flex justify-between items-center mb-0">
        <span className="text-lg font-bold text-foreground">{t("common.total")}</span>
        <span className="text-2xl font-bold text-foreground">
          {formatMoney(total)}
        </span>
      </div>
    </div>
  );
}
