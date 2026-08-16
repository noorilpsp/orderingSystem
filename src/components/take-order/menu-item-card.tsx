"use client"

import { useMerchantLocalization } from "@/lib/hooks/useMerchantLocalization"
import { AlertTriangle, Flame } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { dietaryIcons } from "@/lib/take-order-data"
import type { MenuItem } from "@/lib/take-order-data"
import { PromoPrice } from "@/components/shared/promo-price"

interface MenuItemCardProps {
  item: MenuItem
  hasAllergyConflict?: boolean
  categoryLabel?: string
  density?: "default" | "compact"
  onClick: (item: MenuItem) => void
}

export function MenuItemCard({
  item,
  hasAllergyConflict,
  categoryLabel,
  density = "default",
  onClick,
}: MenuItemCardProps) {
  const { formatMoney } = useMerchantLocalization()
  const isUnavailable = !item.available
  const isCompact = density === "compact"

  return (
    <button
      type="button"
      onClick={() => !isUnavailable && onClick(item)}
      disabled={isUnavailable}
      data-testid={`menu-item-card-${item.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden border-2 bg-card text-left shadow-sm transition-all",
        isCompact ? "min-h-[82px] rounded-lg" : "min-h-[100px] rounded-xl",
        isUnavailable
          ? "cursor-not-allowed opacity-60 grayscale"
          : hasAllergyConflict
            ? "border-destructive/50 hover:border-destructive hover:shadow-md"
            : "border-border hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5"
      )}
    >
      {/* Image */}
      <div className={cn("relative overflow-hidden bg-muted", isCompact ? "aspect-[16/9]" : "aspect-[3/2]")}>
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className={cn(
              "absolute inset-0 h-full w-full object-cover",
              isUnavailable && "grayscale"
            )}
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl text-muted-foreground/20">
            {item.category === "drinks" ? "🍹" : "🍽️"}
          </div>
        )}

        {/* Status Badges */}
        <div className="absolute right-2 top-2 flex flex-col gap-1">
          {item.stockStatus === "sold_out" && (
            <Badge variant="destructive" className="font-semibold">
              SOLD OUT
            </Badge>
          )}
          {item.stockStatus === "low" && (
            <Badge variant="secondary" className="bg-warning/20 text-warning-foreground">
              Only {item.stockCount} left
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={cn("flex flex-1 flex-col p-3", isCompact ? "gap-1 p-2.5" : "gap-1.5")}>
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn("font-semibold leading-tight", isCompact ? "text-sm" : "text-base")}>{item.name}</h3>
          <PromoPrice
            price={item.price}
            compareAtPrice={item.compareAtPrice}
            promoKind={item.promoKind}
            formatMoney={formatMoney}
            bogoLabel="BOGO"
            className={cn("shrink-0", isCompact ? "text-sm" : "text-base")}
          />
        </div>

        {categoryLabel && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="h-5 rounded px-1.5 text-[10px] font-semibold">
              {categoryLabel}
            </Badge>
          </div>
        )}

        {item.description && (
          <p className={cn("text-muted-foreground line-clamp-1", isCompact ? "text-[11px]" : "text-xs")}>
            {item.description}
          </p>
        )}

        {/* Dietary Tags */}
        {item.dietary.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5">
            {item.dietary.map((d) => {
              const info = dietaryIcons[d]
              return info ? (
                <span
                  key={d}
                  className="flex items-center gap-1 text-xs text-muted-foreground"
                  title={info.label}
                >
                  <span className={cn("leading-none", isCompact ? "text-xs" : "text-sm")}>{info.icon}</span>
                  <span className={cn(isCompact ? "hidden" : "hidden sm:inline")}>{info.label}</span>
                </span>
              ) : null
            })}
          </div>
        )}

        {/* Allergy Warning */}
        {hasAllergyConflict && (
          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs font-semibold">CONTAINS ALLERGEN</span>
          </div>
        )}
      </div>
    </button>
  )
}
