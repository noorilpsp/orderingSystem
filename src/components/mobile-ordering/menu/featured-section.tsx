"use client";

import React from "react"

import { useState, useRef } from "react";
import { Plus, Minus, Trash2 } from "lucide-react";
import type { MenuItem, CartItem } from "@/lib/menu-data";
import { resolveCatalogText } from "@/lib/catalog-i18n";
import { useGuestLocale, useGuestT } from "@/lib/guest-i18n";
import { useGuestLocalization } from "@/lib/hooks/useGuestLocalization";
import { PromoPrice } from "@/components/shared/promo-price";
import { cartQuantityForCatalogItem } from "@/lib/public-menu/guest-cart-lines";

interface FeaturedSectionProps {
  items: MenuItem[];
  cartItems: CartItem[];
  onAddToCart: (item: MenuItem) => void;
  onRemoveFromCart: (itemId: string) => void;
  onItemClick: (item: MenuItem) => void;
}

export function FeaturedSection({
  items,
  cartItems,
  onAddToCart,
  onRemoveFromCart,
  onItemClick,
}: FeaturedSectionProps) {
  const t = useGuestT();
  const { locale } = useGuestLocale();
  const { formatMoney } = useGuestLocalization();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [pressedItems, setPressedItems] = useState<Set<string>>(new Set());

  const handleAddClick = (e: React.MouseEvent, item: MenuItem) => {
    e.stopPropagation();
    setPressedItems((prev) => new Set(prev).add(item.id));
    setTimeout(() => {
      setPressedItems((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }, 200);
    onAddToCart(item);
  };

  if (items.length === 0) return null;

  return (
    <div className="mb-2 px-4 py-6 lg:px-0">
      <h2 className="mb-4 text-lg font-bold text-foreground">✨ {t("menu.featured")}</h2>

      {/* Phone: horizontal scroll. Tablet/desktop: grid. */}
      <div
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:pb-0 lg:grid-cols-4 lg:gap-8 xl:grid-cols-5"
      >
        {items.map((item) => {
          const quantity = cartQuantityForCatalogItem(cartItems, item.id);
          const isPressed = pressedItems.has(item.id);
          const localized = resolveCatalogText(
            locale,
            { name: item.name, description: item.description },
            item.i18n,
          );

          return (
            <div
              key={item.id}
              className="w-[calc(40%-4px)] min-w-[120px] flex-shrink-0 snap-start md:w-auto md:min-w-0"
              onClick={() => onItemClick(item)}
            >
              <div className="menu-item-controls relative aspect-square bg-gray-200 rounded-lg overflow-hidden">
                {/* Image */}
                <img
                  src={item.image || "/placeholder.svg"}
                  alt={localized.name}
                  className="w-full h-full object-cover"
                />

                {/* Status Badge */}
                {item.status === "soldout" && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-semibold">{t("menu.soldOut")}</span>
                  </div>
                )}

                {/* Add/Quantity buttons */}
                {item.status === "live" && (
                  <div className="absolute bottom-1 right-1">
                    {!quantity ? (
                      <button
                        type="button"
                        onClick={(e) => handleAddClick(e, item)}
                        className={`sheen-overlay relative flex h-9 w-9 items-center justify-center rounded-full border border-white/26 bg-black/78 text-white backdrop-blur-2xl shadow-[0_10px_24px_rgba(0,0,0,0.4)] ring-1 ring-white/10 hover:bg-black/84 dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:backdrop-blur-xl dark:hover:bg-blue-900/70 vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:backdrop-blur-xl vivid:hover:bg-white/84 transition-all ${
                          isPressed ? "scale-125" : "scale-100"
                        }`}
                        style={{
                          transitionDuration: "200ms",
                          transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                        }}
                        aria-label={t("menu.addItemAria", { name: localized.name })}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="sheen-overlay relative flex items-center gap-2 rounded-full border border-white/26 bg-black/78 px-2 py-1 text-white backdrop-blur-2xl shadow-[0_10px_24px_rgba(0,0,0,0.4)] ring-1 ring-white/10 dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:backdrop-blur-xl vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:backdrop-blur-xl">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveFromCart(item.id);
                          }}
                          className="sheen-overlay relative flex h-6 w-6 items-center justify-center rounded-full border border-white/26 bg-black/78 text-white backdrop-blur-2xl ring-1 ring-white/10 transition-colors hover:bg-black/84 dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:backdrop-blur-xl dark:hover:bg-blue-900/70 vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:backdrop-blur-xl vivid:hover:bg-white/84"
                          aria-label={t("menu.removeItemAria", { name: localized.name })}
                        >
                          {quantity === 1 ? (
                            <Trash2 className="h-4 w-4 text-current" />
                          ) : (
                            <Minus className="h-4 w-4 text-current" />
                          )}
                        </button>
                        <span className="w-4 text-center text-xs font-semibold text-current">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleAddClick(e, item)}
                          className={`sheen-overlay relative flex h-6 w-6 items-center justify-center rounded-full border border-white/26 bg-black/78 text-white backdrop-blur-2xl ring-1 ring-white/10 transition-all hover:bg-black/84 dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:backdrop-blur-xl dark:hover:bg-blue-900/70 vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:backdrop-blur-xl vivid:hover:bg-white/84 ${
                            isPressed ? "scale-125" : "scale-100"
                          }`}
                          style={{
                            transitionDuration: "200ms",
                            transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                          }}
                          aria-label={t("menu.addMoreAria", { name: localized.name })}
                        >
                          <Plus className="h-4 w-4 text-current" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Item info */}
              <div className="mt-2">
                <h3 className="font-semibold text-sm text-foreground line-clamp-1">
                  {localized.name}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {localized.description}
                </p>
                <p className="text-sm font-semibold text-foreground mt-1">
                  <PromoPrice
                    price={item.price}
                    compareAtPrice={item.compareAtPrice}
                    promoKind={item.promoKind}
                    formatMoney={formatMoney}
                    bogoLabel={t("menu.bogo")}
                  />
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
