"use client";

import React from "react";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X, Minus, Plus, GripHorizontal, Trash2, Check, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  menuItemModalData,
  customizationGroups as staticCustomizationGroups,
  type CustomizationGroup,
} from "@/lib/menu-item-modal-data";
import { usePublicMenuOptional } from "@/lib/contexts/PublicMenuContext";
import { resolveCustomizationOptionPrice } from "@/lib/public-menu/resolve-customization-option-price";
import { useGuestT, useGuestLocale, useLocalizedCatalogText } from "@/lib/guest-i18n";
import { useGuestLocalization } from "@/lib/hooks/useGuestLocalization";
import { PromoPrice } from "@/components/shared/promo-price";
import { lineTotalWithPromo } from "@/lib/promotions/pricing";
import {
  resolveCatalogInstructions,
  resolveCatalogText,
  resolveAllergenLabel,
  resolveTagLabel,
  type CatalogI18n,
} from "@/lib/catalog-i18n";

interface ItemDetailModalProps {
  item: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: (item: any) => void;
  customizationGroups?: CustomizationGroup[];
}

function RequiredGroupBadge({
  state,
  label,
}: {
  state: "idle" | "satisfied" | "attention";
  label: string;
}) {
  switch (state) {
    case "satisfied":
      return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          {label}
        </span>
      );
    case "attention":
      return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
          <CircleAlert className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          {label}
        </span>
      );
    case "idle":
      return (
        <span className="inline-flex whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {label}
        </span>
      );
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function ItemDetailModal({
  item,
  open,
  onOpenChange,
  onAddToCart,
  customizationGroups: customizationGroupsProp,
}: ItemDetailModalProps) {
  const t = useGuestT();
  const { locale, dir } = useGuestLocale();
  const { formatMoney } = useGuestLocalization();
  const { name: localizedName, description: localizedDescription } =
    useLocalizedCatalogText(
      { name: item?.name ?? "", description: item?.description },
      item?.i18n,
    );
  const publicMenu = usePublicMenuOptional();
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
  const getAllergenEmoji = (name: string): string | null => {
    const key = name.trim().toLowerCase();
    const emojiMap: Record<string, string> = {
      nuts: "🥜",
      peanuts: "🥜",
      dairy: "🥛",
      milk: "🥛",
      shellfish: "🦐",
      gluten: "🌾",
      soy: "🫘",
      eggs: "🥚",
      "tree nuts": "🌰",
      fish: "🐟",
      sesame: "🌰",
      mustard: "🌶️",
      celery: "🥬",
      lupin: "🫘",
      molluscs: "🐚",
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
  const customizationGroups =
    customizationGroupsProp ??
    (item?.id && publicMenu
      ? publicMenu.getCustomizationGroupsForItem(item.id)
      : staticCustomizationGroups);
  const renderTagChip = (
    key: string,
    label: string,
    toneClass: string,
    emoji?: string,
  ) => (
    <span
      key={key}
      className={`sheen-overlay relative inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium backdrop-blur-md ring-1 ring-white/10 ${toneClass}`}
    >
      {emoji ? <span>{emoji}</span> : null}
      {label}
    </span>
  );
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string[]>
  >({});
  const [sauceQuantities, setSauceQuantities] = useState<Record<string, number>>({});
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [dragY, setDragY] = useState(0);
  const [isSheetDragging, setIsSheetDragging] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [attentionGroupIds, setAttentionGroupIds] = useState<string[]>([]);
  const touchStartY = useRef(0);
  const dragYRef = useRef(0);
  const draggingFromHandleRef = useRef(false);
  const pullingSheetRef = useRef(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const groupSectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const glassControlBase =
    "sheen-overlay relative border border-white/26 bg-black/78 text-white backdrop-blur-2xl ring-1 ring-white/10 transition-colors hover:bg-black/84 dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:backdrop-blur-xl dark:hover:bg-blue-900/70 vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:backdrop-blur-xl vivid:hover:bg-white/84";

  // Initialize with cart item customizations if available
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize with cart item customizations if available
  useEffect(() => {
    if (open && item) {
      setSelectedOptions(item.selectedOptions || {});
      setSauceQuantities(item.sauceQuantities || {});
      setSpecialInstructions(item.specialInstructions || "");
      setQuantity(1);
      setAttentionGroupIds([]);
    }
  }, [open, item]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  const sizeSelection = selectedOptions["size"]?.[0];

  const setSheetOffset = (next: number) => {
    dragYRef.current = next;
    setDragY(next);
  };

  const finishSheetDrag = () => {
    const wasPulling =
      draggingFromHandleRef.current ||
      pullingSheetRef.current ||
      dragYRef.current > 0;
    draggingFromHandleRef.current = false;
    pullingSheetRef.current = false;
    if (!wasPulling) return;
    const y = dragYRef.current;
    setIsSheetDragging(false);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (y > 100) {
          const offscreen = Math.max(
            typeof window !== "undefined" ? window.innerHeight : 800,
            y + 160,
          );
          setSheetOffset(offscreen);
          if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = setTimeout(() => {
            dismissTimerRef.current = null;
            setSheetOffset(0);
            onOpenChange(false);
          }, 280);
          return;
        }
        setSheetOffset(0);
      });
    });
  };

  const handleHandleTouchStart = (e: React.TouchEvent) => {
    if (dismissTimerRef.current) return;
    draggingFromHandleRef.current = true;
    pullingSheetRef.current = true;
    setIsSheetDragging(true);
    touchStartY.current = e.touches[0].clientY;
  };

  const handleContentTouchStart = (e: React.TouchEvent) => {
    if (dismissTimerRef.current) return;
    draggingFromHandleRef.current = false;
    pullingSheetRef.current = false;
    touchStartY.current = e.touches[0].clientY;
  };

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleEl = handleRef.current;
    const scrollEl = scrollRef.current;

    const onHandleMove = (event: TouchEvent) => {
      if (!draggingFromHandleRef.current) return;
      const diff = event.touches[0].clientY - touchStartY.current;
      if (diff > 0) {
        event.preventDefault();
        setSheetOffset(diff);
      }
    };

    const onScrollMove = (event: TouchEvent) => {
      if (draggingFromHandleRef.current) return;
      const diff = event.touches[0].clientY - touchStartY.current;
      const atTop = !scrollEl || scrollEl.scrollTop <= 5;
      if (!pullingSheetRef.current) {
        if (!(atTop && diff > 6)) return;
        pullingSheetRef.current = true;
        setIsSheetDragging(true);
      }
      if (diff > 0) {
        event.preventDefault();
        setSheetOffset(diff);
      }
    };

    handleEl?.addEventListener("touchmove", onHandleMove, { passive: false });
    scrollEl?.addEventListener("touchmove", onScrollMove, { passive: false });
    return () => {
      handleEl?.removeEventListener("touchmove", onHandleMove);
      scrollEl?.removeEventListener("touchmove", onScrollMove);
    };
  }, [open, mounted]);

  // Calculate conditional max selections for toppings
  const effectiveGroups = useMemo(() => {
    return customizationGroups.map((group) => {
      if (group.conditionalQuantities) {
        const baseSelection =
          selectedOptions[group.conditionalQuantities.baseGroupId]?.[0] ??
          (group.conditionalQuantities.baseGroupId === "size"
            ? sizeSelection
            : undefined);
        if (baseSelection) {
          const rule = group.conditionalQuantities.rules.find(
            (r) => r.baseOptionId === baseSelection,
          );
          if (rule) {
            return { ...group, maxSelections: rule.maxSelections };
          }
        }
      }
      return group;
    });
  }, [customizationGroups, selectedOptions, sizeSelection]);

  const hasCustomizations = effectiveGroups.length > 0;

  const getOptionPrice = (
    _groupId: string,
    _optionId: string,
    option: CustomizationGroup["options"][number],
  ): number => {
    return resolveCustomizationOptionPrice(option, selectedOptions, customizationGroups);
  };

  // Calculate total price
  const totalPrice = useMemo(() => {
    let basePrice = Number(item?.price ?? menuItemModalData.basePrice);

    // Legacy demo: absolute size pricing replaces the menu base.
    if (sizeSelection) {
      const sizeGroup = customizationGroups.find((g) => g.id === "size");
      const sizeOption = sizeGroup?.options.find((o) => o.id === sizeSelection);
      if (sizeOption) {
        basePrice = sizeOption.price;
      }
    }

    let addOnsPrice = 0;
    Object.entries(selectedOptions).forEach(([groupId, optionIds]) => {
      if (groupId === "size") return;
      const group = customizationGroups.find((g) => g.id === groupId);
      if (!group) return;

      optionIds.forEach((optionId) => {
        const option = group.options.find((o) => o.id === optionId);
        if (option) {
          addOnsPrice += getOptionPrice(groupId, optionId, option);
        }
      });
    });

    // Add sauce prices
    Object.entries(sauceQuantities).forEach(([sauceId, qty]) => {
      const sauceGroup = customizationGroups.find((g) => g.id === "sauces");
      const sauce = sauceGroup?.options.find((o) => o.id === sauceId);
      if (sauce) {
        addOnsPrice += getOptionPrice("sauces", sauceId, sauce) * qty;
      }
    });

    return lineTotalWithPromo({
      kind: item?.promoKind,
      unitBasePrice: basePrice,
      addOnsTotalPerUnit: addOnsPrice,
      quantity,
    });
  }, [selectedOptions, sauceQuantities, sizeSelection, quantity, item?.price, item?.promoKind, customizationGroups]);

  const incompleteRequiredGroupIds = useMemo(() => {
    return effectiveGroups
      .filter((group) => {
        if (!group.isRequired) return false;

        if (group.isSecondary && group.triggerRule) {
          const isTriggered =
            selectedOptions[group.triggerRule.triggerGroupId]?.[0] ===
            group.triggerRule.triggerOptionId;
          if (!isTriggered) return false;
        }

        const selected = selectedOptions[group.id] || [];
        return selected.length < Math.max(group.minSelections, 1);
      })
      .map((group) => group.id);
  }, [effectiveGroups, selectedOptions]);

  const visibleGroups = useMemo(() => {
    return effectiveGroups.filter((group) => {
      if (group.isSecondary && group.triggerRule) {
        return (
          selectedOptions[group.triggerRule.triggerGroupId]?.[0] ===
          group.triggerRule.triggerOptionId
        );
      }
      return true;
    });
  }, [effectiveGroups, selectedOptions]);

  useEffect(() => {
    setAttentionGroupIds((prev) => {
      if (prev.length === 0) return prev;
      const incomplete = new Set(incompleteRequiredGroupIds);
      const next = prev.filter((id) => incomplete.has(id));
      if (
        next.length === prev.length &&
        next.every((id, index) => id === prev[index])
      ) {
        return prev;
      }
      return next;
    });
  }, [incompleteRequiredGroupIds]);

  const handleSelectOption = (groupId: string, optionId: string) => {
    const group = effectiveGroups.find((g) => g.id === groupId);
    if (!group) return;

    setSelectedOptions((prev) => {
      const current = prev[groupId] || [];
      let updated: string[];

      if (group.maxSelections === 1) {
        // Single select
        updated = [optionId];
      } else {
        // Multi select
        if (current.includes(optionId)) {
          updated = current.filter((id) => id !== optionId);
        } else if (current.length < group.maxSelections) {
          updated = [...current, optionId];
        } else {
          return prev;
        }
      }

      return { ...prev, [groupId]: updated };
    });
  };

  if (!open || !mounted) return null;

  const handleAddToCart = () => {
    if (incompleteRequiredGroupIds.length > 0) {
      setAttentionGroupIds(incompleteRequiredGroupIds);
      const firstIncompleteId = incompleteRequiredGroupIds[0];
      const target = groupSectionRefs.current.get(firstIncompleteId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    const cartItem = {
      ...item,
      selectedOptions,
      sauceQuantities,
      specialInstructions,
      quantity,
    };
    onAddToCart(cartItem);
    onOpenChange(false);
  };

  const modal = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[1000] bg-black/50"
        aria-hidden
        style={{
          opacity: Math.max(0, 1 - dragY / 420),
          transition: isSheetDragging ? "none" : "opacity 0.28s ease-out",
        }}
      />

      {/* Bottom Sheet / centered dialog on tablet+ */}
      <div
        className="fixed inset-0 z-[1001] flex items-end justify-center animate-in slide-in-from-bottom-80 duration-300 md:items-center md:p-6 md:animate-in md:fade-in-0 md:zoom-in-95"
        onClick={() => onOpenChange(false)}
        role="presentation"
      >
        <div 
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          dir={dir}
          lang={locale}
          className="item-modal-surface liquid-glass relative flex h-[98vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border/70 bg-card/90 shadow-2xl shadow-black/35 backdrop-blur-xl will-change-transform md:h-auto md:max-h-[min(90vh,52rem)] md:rounded-3xl"
          style={{ 
            transform: `translateY(${dragY}px)`,
            transition: isSheetDragging ? "none" : "transform 0.28s ease-out",
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {/* Header: drag handle + close - keep X on the visual right in both locales */}
          <div className="relative z-20 flex shrink-0 items-center justify-between gap-2 px-3 pb-1 pt-3" dir="ltr">
            <div className="h-10 w-10 shrink-0" aria-hidden />
            <div
              ref={handleRef}
              className="flex flex-1 touch-none items-center justify-center py-2 md:pointer-events-none"
              onTouchStart={handleHandleTouchStart}
              onTouchEnd={finishSheetDrag}
              onTouchCancel={finishSheetDrag}
            >
              <div className="flex h-1 w-12 rounded-full bg-border md:hidden" />
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/90 text-foreground shadow-sm backdrop-blur-sm transition hover:bg-background"
              aria-label={t("common.close")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div 
            ref={scrollRef}
            onTouchStart={handleContentTouchStart}
            onTouchEnd={finishSheetDrag}
            onTouchCancel={finishSheetDrag}
            className="menu-item-controls min-h-0 flex-1 overflow-y-auto px-4 pb-2"
          >
            {/* Image */}
            <div className="relative h-48 w-full overflow-hidden rounded-lg">
              <Image
                src={item?.image || "/placeholder.svg"}
                alt={localizedName || "Item"}
                fill
                className="object-cover"
              />
            </div>

            {/* Item Info */}
            <div className="mt-4">
              <h1 className="text-2xl font-bold text-foreground">
                {localizedName}
              </h1>

              {/* Price / calories */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {item?.price != null && (
                  <div className="inline-flex items-center leading-none">
                    <PromoPrice
                      price={item.price}
                      compareAtPrice={item.compareAtPrice}
                      promoKind={item.promoKind}
                      formatMoney={formatMoney}
                      bogoLabel={t("menu.bogo")}
                    className="items-center text-sm text-foreground"
                    />
                  </div>
                )}
                {item?.calories ? (
                  <span className="relative top-px inline-flex items-center self-center whitespace-nowrap text-xs leading-none text-muted-foreground">
                    {item.calories} cal
                  </span>
                ) : null}
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                {localizedDescription}
              </p>

              {/* Tags */}
              {(item?.tags?.length > 0 || item?.dietaryTags?.length > 0 || item?.allergens?.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(item?.dietaryTags ?? []).map((tag: { name: string; emoji?: string | null; i18n?: CatalogI18n | null }) => {
                    const label = resolveTagLabel(locale, tag.name, tag.i18n);
                    const parsed = splitLeadingEmoji(label);
                    return renderTagChip(
                      `dietary-${tag.name}`,
                      parsed.label,
                      "border-emerald-400/45 bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 vivid:text-emerald-100",
                      tag.emoji || parsed.emoji || getDietaryEmoji(tag.name) || undefined,
                    );
                  })}
                  {(item?.allergens ?? []).map((allergen: { name: string; emoji?: string | null } | string) => {
                    const name = typeof allergen === "string" ? allergen : allergen.name;
                    const emoji = typeof allergen === "string" ? null : allergen.emoji;
                    const parsed = splitLeadingEmoji(name);
                    return renderTagChip(
                      `allergen-${name}`,
                      resolveAllergenLabel(locale, parsed.label),
                      "border-amber-400/45 bg-amber-500/20 text-amber-900 dark:text-amber-200 vivid:text-amber-100",
                      emoji || parsed.emoji || getAllergenEmoji(name) || "⚠️",
                    );
                  })}
                  {(item?.tags ?? []).map((tag: { name: string; i18n?: CatalogI18n | null }) => {
                    const normalizedTagName = splitLeadingEmoji(tag.name).label;
                    const tagKey = normalizedTagName.trim().toLowerCase();
                    let toneClass =
                      "border-zinc-400/35 bg-zinc-500/15 text-zinc-800 dark:text-zinc-200 vivid:text-zinc-100";

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
                      (tag as { emoji?: string | null }).emoji || parsed.emoji || getRegularTagEmoji(normalizedTagName) || undefined,
                    );
                  })}
                </div>
              )}
            </div>

            {/* Customization Groups */}
            {hasCustomizations ? (
              <>
                <div className="-mx-4 mt-3 mb-3 h-0.5 bg-border/70" />
                <div className="mt-6 space-y-0">
                  {visibleGroups.map((group, index) => {
                const isMultiSelect = group.maxSelections > 1;
                const selected = selectedOptions[group.id] || [];
                const isRequiredSatisfied =
                  selected.length >= Math.max(group.minSelections, 1);
                const needsAttention = attentionGroupIds.includes(group.id);
                const requiredBadgeState: "idle" | "satisfied" | "attention" =
                  !group.isRequired
                    ? "idle"
                    : isRequiredSatisfied
                      ? "satisfied"
                      : needsAttention
                        ? "attention"
                        : "idle";

                // Special rendering for sauces group
                if (group.id === "sauces") {
                  return (
                    <div
                      key={group.id}
                      ref={(node) => {
                        if (node) groupSectionRefs.current.set(group.id, node);
                        else groupSectionRefs.current.delete(group.id);
                      }}
                    >
                      <div className="flex items-start justify-between px-0 py-1.5 gap-3">
                        <div>
                          <h3 className="font-semibold text-foreground">
                            {resolveCatalogText(locale, { name: group.name }, group.i18n).name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {t("item.addAsMany")}
                          </p>
                        </div>
                        {group.isRequired && (
                          <RequiredGroupBadge state={requiredBadgeState} label={t("item.required")} />
                        )}
                      </div>

                      <div className="space-y-0">
                        {group.options.map((option, optionIndex) => {
                          const qty = sauceQuantities[option.id] || 0;

                          const addOneSauce = () =>
                            setSauceQuantities((prev) => ({
                              ...prev,
                              [option.id]: (prev[option.id] || 0) + 1,
                            }));

                          return (
                            <div key={option.id}>
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={addOneSauce}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    addOneSauce();
                                  }
                                }}
                                className="flex w-full cursor-pointer items-start justify-between gap-3 px-0 py-3 rounded-lg hover:bg-muted/50 transition-colors"
                              >
                                <div className="min-w-0 flex-1 text-start">
                                  <p className="text-sm font-medium text-foreground">
                                    {resolveCatalogText(locale, { name: option.name }, option.i18n).name}
                                  </p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    +{formatMoney(option.price)}
                                  </p>
                                </div>
                                <div
                                  className="flex shrink-0 items-center gap-2"
                                  dir="ltr"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {qty === 0 ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSauceQuantities((prev) => ({
                                          ...prev,
                                          [option.id]: 1,
                                        }));
                                      }}
                                      className={`${glassControlBase} flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold`}
                                    >
                                      +
                                    </button>
                                  ) : qty === 1 ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSauceQuantities((prev) => ({
                                            ...prev,
                                            [option.id]: 0,
                                          }));
                                        }}
                                        className={`${glassControlBase} flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold`}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-current" />
                                      </button>
                                      <span className="w-7 text-center text-sm font-semibold">
                                        {qty}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          addOneSauce();
                                        }}
                                        className={`${glassControlBase} flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold`}
                                      >
                                        +
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSauceQuantities((prev) => ({
                                            ...prev,
                                            [option.id]: Math.max(0, (prev[option.id] || 0) - 1),
                                          }));
                                        }}
                                        className={`${glassControlBase} flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold`}
                                      >
                                        −
                                      </button>
                                      <span className="w-7 text-center text-sm font-semibold">
                                        {qty}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          addOneSauce();
                                        }}
                                        className={`${glassControlBase} flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold`}
                                      >
                                        +
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              {optionIndex < group.options.length - 1 && (
                                <div className="h-px bg-gray-200" />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {index < visibleGroups.length - 1 && (
                        <div className="-mx-4 h-0.5 bg-gray-200 mt-3 mb-3" />
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={group.id}
                    ref={(node) => {
                      if (node) groupSectionRefs.current.set(group.id, node);
                      else groupSectionRefs.current.delete(group.id);
                    }}
                  >
                    <div className="flex items-start justify-between px-0 py-1.5 gap-3">
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {resolveCatalogText(locale, { name: group.name }, group.i18n).name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {(() => {
                            const instructions = resolveCatalogInstructions(
                              locale,
                              group.customerInstructions,
                              group.i18n,
                            );
                            return instructions ? `${instructions} • ` : "";
                          })()}
                          {group.maxSelections === 1
                            ? t("item.selectOne")
                            : group.minSelections === group.maxSelections
                              ? t("item.selectCount", { count: group.minSelections })
                              : t("item.selectUpTo", { count: group.maxSelections })}
                        </p>
                      </div>
                      {group.isRequired && (
                        <RequiredGroupBadge state={requiredBadgeState} label={t("item.required")} />
                      )}
                    </div>

                    <div className="space-y-0">
                      {group.options.map((option, optionIndex) => {
                        const isSelected = selected.includes(option.id);
                        const isMaxReached = selected.length >= group.maxSelections && isMultiSelect;
                        const isDisabled = !isSelected && isMaxReached;
                        const optionPrice = getOptionPrice(
                          group.id,
                          option.id,
                          option
                        );
                        const displayPrice =
                          optionPrice === 0
                            ? t("item.included")
                            : `+${formatMoney(optionPrice)}`;

                        return (
                          <div key={option.id}>
                            <button
                              onClick={() => handleSelectOption(group.id, option.id)}
                              disabled={isDisabled}
                              className={`flex w-full items-start justify-between gap-3 px-0 py-3 text-start ${
                                isDisabled ? "opacity-40 cursor-not-allowed" : ""
                              }`}
                            >
                              <div className="min-w-0 flex-1 text-start">
                                <p className={`text-sm font-medium ${isDisabled ? "text-gray-400" : "text-foreground"}`}>
                                  {resolveCatalogText(locale, { name: option.name }, option.i18n).name}
                                </p>
                                <p className={`mt-0.5 text-xs ${isDisabled ? "text-gray-300" : "text-muted-foreground"}`}>
                                  {displayPrice}
                                </p>
                              </div>
                              <div className="mt-1 shrink-0" dir="ltr">
                                {isMultiSelect ? (
                                  <div
                                    className={`sheen-overlay relative flex h-5 w-5 items-center justify-center rounded border ${
                                      isSelected
                                        ? "border-white/45 bg-black/82 text-white ring-1 ring-white/15 dark:border-blue-200/45 dark:bg-blue-900/68 dark:text-blue-100 dark:ring-blue-200/25 vivid:border-black/45 vivid:bg-white/86 vivid:text-black vivid:ring-black/10"
                                        : isDisabled
                                        ? "border-white/12 bg-black/35 text-white/45 dark:border-blue-200/15 dark:bg-blue-950/28 dark:text-blue-200/45 vivid:border-black/20 vivid:bg-white/45 vivid:text-black/40"
                                        : "border-white/26 bg-black/70 text-white ring-1 ring-white/10 dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:ring-blue-300/18 vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:ring-black/10"
                                    }`}
                                  >
                                    {isSelected && (
                                      <svg
                                        className="h-full w-full text-current"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={3}
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                    )}
                                  </div>
                                ) : (
                                  <div
                                    className={`sheen-overlay relative flex h-5 w-5 items-center justify-center rounded-full border ${
                                      isSelected
                                        ? "border-white/45 bg-black/82 text-white ring-1 ring-white/15 dark:border-blue-200/45 dark:bg-blue-900/68 dark:text-blue-100 dark:ring-blue-200/25 vivid:border-black/45 vivid:bg-white/86 vivid:text-black vivid:ring-black/10"
                                        : "border-white/26 bg-black/70 text-white ring-1 ring-white/10 dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:ring-blue-300/18 vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:ring-black/10"
                                    }`}
                                  >
                                    {isSelected && (
                                      <div className="h-1.5 w-1.5 rounded-full bg-current" />
                                    )}
                                  </div>
                                )}
                              </div>
                            </button>
                            {optionIndex < group.options.length - 1 && (
                              <div className="h-px bg-gray-200" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Separator between groups */}
                    {index < visibleGroups.length - 1 && (
                      <div className="-mx-4 h-0.5 bg-gray-200 mt-3 mb-3" />
                    )}
                  </div>
                );
              })}
                </div>
                <div className="-mx-4 mt-3 mb-3 h-0.5 bg-gray-200" />
              </>
            ) : (
              <div className="-mx-4 mt-4 mb-3 h-0.5 bg-border/70" />
            )}

            {/* Special Instructions */}
            <div className="mt-4">
              <label className="block text-sm font-semibold text-foreground">
                {t("item.specialInstructions")}
              </label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder={t("item.specialInstructionsPlaceholder")}
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                rows={3}
              />
            </div>

            {/* Quantity Selector - keep − / + order in both locales */}
            <div className="mt-4 mb-1 flex items-center justify-center gap-5" dir="ltr">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className={`${glassControlBase} flex h-8 w-8 items-center justify-center rounded-full`}
                aria-label={t("item.decreaseQty")}
              >
                <Minus className="h-4 w-4 text-current" />
              </button>
              <span className="text-lg font-semibold">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className={`${glassControlBase} flex h-8 w-8 items-center justify-center rounded-full`}
                aria-label={t("item.increaseQty")}
              >
                <Plus className="h-4 w-4 text-current" />
              </button>
            </div>
          </div>

          {/* Add to Cart Button - Sticky */}
          <div className="item-modal-footer liquid-glass shrink-0 rounded-t-2xl border-t border-border/70 bg-card/85 px-4 pt-3 pb-3 shadow-lg shadow-black/30 backdrop-blur-xl">
            <Button
              onClick={handleAddToCart}
              className="sheen-overlay relative flex min-h-12 w-full items-center justify-center rounded-xl border border-white/26 bg-black/78 px-4 py-3 text-white backdrop-blur-2xl shadow-[0_14px_30px_rgba(0,0,0,0.42)] ring-1 ring-white/10 transition-transform duration-200 hover:bg-black/84 active:scale-[0.99] dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:backdrop-blur-xl dark:hover:bg-blue-900/70 vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:backdrop-blur-xl vivid:hover:bg-white/84"
            >
              {t("item.addToCartPrice", { price: formatMoney(totalPrice) })}
            </Button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
}
