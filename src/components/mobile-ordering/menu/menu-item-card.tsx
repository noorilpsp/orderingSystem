"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Plus, Minus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MenuItem } from "@/lib/menu-data";
import { cn } from "@/lib/utils";
import { resolveTagLabel } from "@/lib/catalog-i18n";
import { useGuestT, useGuestLocale, useLocalizedCatalogText } from "@/lib/guest-i18n";
import { useGuestLocalization } from "@/lib/hooks/useGuestLocalization";
import { PromoPrice } from "@/components/shared/promo-price";

interface MenuItemCardProps {
  item: MenuItem;
  onAddToCart: (item: MenuItem) => void;
  onRemoveFromCart?: (itemId: string) => void;
  onItemClick?: (item: MenuItem) => void;
  quantity?: number;
  /** row = phone list; tile = tablet/desktop grid card */
  variant?: "row" | "tile";
}

export function MenuItemCard({
  item,
  onAddToCart,
  onRemoveFromCart,
  onItemClick,
  quantity = 0,
  variant = "row",
}: MenuItemCardProps) {
  const t = useGuestT();
  const { locale } = useGuestLocale();
  const { formatMoney } = useGuestLocalization();
  const { name: localizedName, description: localizedDescription } =
    useLocalizedCatalogText(
      { name: item.name, description: item.description },
      item.i18n,
    );
  const [isPressed, setIsPressed] = useState(false);
  const isSoldOut = item.status === "soldout";
  const isInCart = quantity > 0;
  const isTile = variant === "tile";
  const caloriesLabel = item.calories ? `${item.calories} cal` : null;
  const dietaryTags = item.dietaryTags ?? [];
  const regularTags = item.tags ?? [];

  const splitLeadingEmoji = (value: string): { emoji: string | null; label: string } => {
    const match = value.match(/^(\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*)\s*/u);
    if (!match) return { emoji: null, label: value };
    return {
      emoji: match[1] ?? match[0].trim(),
      label: value.slice(match[0].length).trim() || value,
    };
  };

  const getDietaryEmoji = (name: string): string | null => {
    const key = name.trim().toLowerCase();
    const emojiMap: Record<string, string> = {
      vegetarian: "🥬",
      vegan: "🌱",
      "gluten-free": "🌾",
      "dairy-free": "🥛",
      "nut-free": "🥜",
      "sugar-free": "🍯",
      keto: "🥑",
      paleo: "🥩",
      "low-carb": "🥗",
      "high-protein": "💪",
      organic: "🌿",
      raw: "🥕",
      halal: "☪️",
      kosher: "✡️",
    };
    return emojiMap[key] ?? null;
  };

  const getRegularTagEmoji = (name: string): string | null => {
    const key = name.trim().toLowerCase();
    const emojiMap: Record<string, string> = {
      spicy: "🌶️",
      popular: "🔥",
      new: "✨",
      "chef-pick": "👨‍🍳",
      "chef's pick": "👨‍🍳",
      "chefs pick": "👨‍🍳",
    };
    return emojiMap[key] ?? null;
  };

  const renderTagChip = (
    key: string,
    label: string,
    toneClass: string,
    emoji?: string,
  ) => (
    <span
      key={key}
      className={`sheen-overlay relative inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur-md ring-1 ring-white/10 ${toneClass}`}
    >
      {emoji ? <span>{emoji}</span> : null}
      {label}
    </span>
  );

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSoldOut) return;
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 200);
    onAddToCart(item);
  };

  const handleCardClick = () => {
    if (isSoldOut) return;
    onItemClick?.(item);
  };

  const overlayControlClass =
    "sheen-overlay absolute bottom-1 right-1 flex items-center gap-1.5 rounded-full border border-white/26 bg-black/78 px-2 py-1 text-white backdrop-blur-2xl shadow-[0_10px_24px_rgba(0,0,0,0.4)] ring-1 ring-white/10 dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:backdrop-blur-xl vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:backdrop-blur-xl";
  const overlayAddClass = cn(
    "sheen-overlay absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full border border-white/26 bg-black/78 text-white backdrop-blur-2xl shadow-[0_10px_24px_rgba(0,0,0,0.4)] ring-1 ring-white/10 hover:bg-black/84 dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:backdrop-blur-xl dark:hover:bg-blue-900/70 vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:backdrop-blur-xl vivid:hover:bg-white/84 transition-all",
    isPressed ? "scale-125" : "scale-100",
  );
  const qtyBtnClass =
    "sheen-overlay relative flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-background text-foreground transition-colors hover:bg-muted";

  const overlayQuantityControls = !isSoldOut ? (
    !isInCart ? (
      <button
        type="button"
        onClick={handleAddClick}
        className={overlayAddClass}
        style={{
          transitionDuration: "200ms",
          transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
        aria-label={t("menu.addItemAria", { name: localizedName })}
      >
        <Plus className="h-4 w-4" />
      </button>
    ) : (
      <div className={overlayControlClass}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemoveFromCart?.(item.id);
          }}
          className="sheen-overlay relative flex h-6 w-6 items-center justify-center rounded-full border border-white/26 bg-black/78 text-white backdrop-blur-2xl ring-1 ring-white/10 transition-colors hover:bg-black/84 dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:backdrop-blur-xl dark:hover:bg-blue-900/70 vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:backdrop-blur-xl vivid:hover:bg-white/84"
          aria-label={t("menu.removeItemAria", { name: localizedName })}
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
          onClick={handleAddClick}
          className={cn(
            "sheen-overlay relative flex h-6 w-6 items-center justify-center rounded-full border border-white/26 bg-black/78 text-white backdrop-blur-2xl ring-1 ring-white/10 transition-all hover:bg-black/84 dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:backdrop-blur-xl dark:hover:bg-blue-900/70 vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:backdrop-blur-xl vivid:hover:bg-white/84",
            isPressed ? "scale-125" : "scale-100",
          )}
          style={{
            transitionDuration: "200ms",
            transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
          aria-label={t("menu.addMoreAria", { name: localizedName })}
        >
          <Plus className="h-4 w-4 text-current" />
        </button>
      </div>
    )
  ) : null;

  const tileQuantityControls = !isSoldOut ? (
    !isInCart ? (
      <button
        type="button"
        onClick={handleAddClick}
        className={cn(
          "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border/70 bg-foreground px-3.5 text-sm font-semibold text-background transition hover:opacity-90",
          isPressed && "scale-105",
        )}
        aria-label={t("menu.addItemAria", { name: localizedName })}
      >
        <Plus className="h-4 w-4" />
        {t("menu.add")}
      </button>
    ) : (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/60 p-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemoveFromCart?.(item.id);
          }}
          className={qtyBtnClass}
          aria-label={t("menu.removeItemAria", { name: localizedName })}
        >
          {quantity === 1 ? (
            <Trash2 className="h-3.5 w-3.5" />
          ) : (
            <Minus className="h-3.5 w-3.5" />
          )}
        </button>
        <span className="min-w-5 text-center text-sm font-semibold text-foreground">
          {quantity}
        </span>
        <button
          type="button"
          onClick={handleAddClick}
          className={cn(qtyBtnClass, isPressed && "scale-110")}
          aria-label={t("menu.addMoreAria", { name: localizedName })}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  ) : null;

  const tags =
    regularTags.length > 0 || dietaryTags.length > 0 ? (
      <div className="flex flex-wrap gap-1">
        {dietaryTags.map((tag) => {
          const label = resolveTagLabel(locale, tag.name, tag.i18n);
          const parsed = splitLeadingEmoji(label);
          return renderTagChip(
            `dietary-${tag.name}`,
            parsed.label,
            "border-emerald-400/45 bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 vivid:text-emerald-100",
            tag.emoji || parsed.emoji || getDietaryEmoji(tag.name) || undefined,
          );
        })}
        {regularTags.map((tag) => {
          const normalizedTagName = splitLeadingEmoji(tag.name).label;
          let toneClass =
            "border-zinc-400/35 bg-zinc-500/15 text-zinc-800 dark:text-zinc-200 vivid:text-zinc-100";
          const tagKey = normalizedTagName.trim().toLowerCase();
          const tagEmoji = getRegularTagEmoji(normalizedTagName) || "";

          if (tagKey === "vegetarian") {
            toneClass =
              "border-emerald-400/45 bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 vivid:text-emerald-100";
          } else if (tagKey === "spicy") {
            toneClass =
              "border-rose-400/45 bg-rose-500/20 text-rose-800 dark:text-rose-200 vivid:text-rose-100";
          } else if (tagKey === "popular") {
            toneClass =
              "border-orange-500/55 bg-orange-500/20 text-orange-900 dark:text-orange-200 vivid:text-orange-100";
          } else if (tagKey === "new") {
            toneClass =
              "border-sky-400/55 bg-sky-500/20 text-sky-900 dark:text-sky-200 vivid:text-sky-100";
          } else if (tagKey === "gluten-free" || tagKey === "gluten free") {
            toneClass =
              "border-sky-400/45 bg-sky-500/20 text-sky-800 dark:text-sky-200 vivid:text-sky-100";
          }

          const label = resolveTagLabel(locale, tag.name, tag.i18n);
          const parsed = splitLeadingEmoji(label);
          return renderTagChip(
            `tag-${tag.name}`,
            parsed.label,
            toneClass,
            tag.emoji || parsed.emoji || tagEmoji || undefined,
          );
        })}
      </div>
    ) : null;

  if (isTile) {
    return (
      <div
        onClick={handleCardClick}
        aria-disabled={isSoldOut}
        className={cn(
          "menu-item-controls flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-sm transition",
          isSoldOut
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:border-border hover:bg-card/90",
        )}
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          <Image
            src={item.image || "/placeholder.svg"}
            alt={localizedName}
            fill
            className={cn("object-cover", isSoldOut && "grayscale")}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
          />
          {isSoldOut ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Badge variant="destructive" className="text-xs font-semibold">
                {t("menu.soldOut")}
              </Badge>
            </div>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-3">
          <h3
            className={cn(
              "font-semibold text-foreground",
              isSoldOut && "text-muted-foreground",
            )}
          >
            {localizedName}
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {localizedDescription}
          </p>
          {tags}
          <div className="mt-auto flex items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <p className="inline-flex items-center font-semibold leading-none text-foreground">
                <PromoPrice
                  price={item.price}
                  compareAtPrice={item.compareAtPrice}
                  promoKind={item.promoKind}
                  formatMoney={formatMoney}
                  bogoLabel={t("menu.bogo")}
                />
              </p>
              {caloriesLabel ? (
                <span className="inline-flex items-center self-center whitespace-nowrap text-xs leading-none text-muted-foreground">
                  {caloriesLabel}
                </span>
              ) : null}
            </div>
            {tileQuantityControls}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleCardClick}
      aria-disabled={isSoldOut}
      className={cn(
        "flex gap-3",
        isSoldOut ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="flex flex-col gap-1">
          <h3
            className={cn(
              "font-semibold text-foreground",
              isSoldOut && "text-muted-foreground",
            )}
          >
            {localizedName}
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {localizedDescription}
          </p>
          {tags}
          <div className="flex items-center gap-2">
            <p className="inline-flex items-center font-semibold leading-none text-foreground">
              <PromoPrice
                price={item.price}
                compareAtPrice={item.compareAtPrice}
                promoKind={item.promoKind}
                formatMoney={formatMoney}
                bogoLabel={t("menu.bogo")}
              />
            </p>
            {caloriesLabel ? (
              <span className="inline-flex items-center self-center whitespace-nowrap text-xs leading-none text-muted-foreground">
                {caloriesLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="menu-item-controls relative h-28 w-28 shrink-0">
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg">
          <Image
            src={item.image || "/placeholder.svg"}
            alt={localizedName}
            fill
            className={cn("object-cover", isSoldOut && "grayscale")}
          />
          {isSoldOut ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Badge variant="destructive" className="text-xs font-semibold">
                {t("menu.soldOut")}
              </Badge>
            </div>
          ) : null}
          {overlayQuantityControls}
        </div>
      </div>
    </div>
  );
}
