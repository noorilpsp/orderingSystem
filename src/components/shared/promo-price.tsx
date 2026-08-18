"use client";

import { cn } from "@/lib/utils";

type PromoPriceProps = {
  price: number;
  compareAtPrice?: number | null;
  promoKind?: "sale_price" | "bogo" | null;
  formatMoney: (amount: number) => string;
  className?: string;
  bogoLabel?: string;
};

export function PromoPrice({
  price,
  compareAtPrice,
  promoKind,
  formatMoney,
  className,
  bogoLabel,
}: PromoPriceProps) {
  const showCompare =
    typeof compareAtPrice === "number" &&
    Number.isFinite(compareAtPrice) &&
    compareAtPrice > price;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1.5 leading-none", className)}>
      {showCompare ? (
        <span className="text-muted-foreground line-through font-normal">
          {formatMoney(compareAtPrice)}
        </span>
      ) : null}
      <span className="font-semibold">{formatMoney(price)}</span>
      {promoKind === "bogo" && bogoLabel ? (
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold uppercase leading-none tracking-wide text-emerald-800 dark:text-emerald-200">
          {bogoLabel}
        </span>
      ) : null}
    </span>
  );
}
