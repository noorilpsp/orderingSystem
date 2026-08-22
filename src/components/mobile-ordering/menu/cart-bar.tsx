"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import type { CartItem, MenuItem } from "@/lib/menu-data";
import { restaurant as staticRestaurant } from "@/lib/menu-data";
import {
  customizationGroups as staticCustomizationGroups,
} from "@/lib/menu-item-modal-data";
import { usePublicMenuOptional } from "@/lib/contexts/PublicMenuContext";
import { isRewardCartLine } from "@/lib/public-menu/guest-reward-cart";
import {
  getGuestCartItemCompareAtLineTotal,
  getGuestCartItemLineTotal,
  getGuestCartItemUnitPrice,
} from "@/lib/public-menu/guest-cart-pricing";
import { guestCartLineId } from "@/lib/public-menu/guest-cart-lines";
import { GuestCustomizationDisplayLines } from "@/components/shared/customization-display-lines";
import { PromoPrice } from "@/components/shared/promo-price";
import { resolveCatalogText } from "@/lib/catalog-i18n";
import { useGuestLocale, useGuestT } from "@/lib/guest-i18n";
import { useGuestLocalization } from "@/lib/hooks/useGuestLocalization";
import { GuestDealBadge, guestDealKind } from "@/components/mobile-ordering/guest-deal-badge";
import { guestParksUntilOpen } from "@/lib/public-menu/guestParksUntilOpen";
import { isGuestRestaurantOpenNow } from "@/lib/public-menu/resolveActiveMenu";
import { formatPickupScheduleLabel } from "@/lib/public-menu/buildPickupScheduleSlots";

interface CartBarProps {
  items: CartItem[];
  total: number;
  menuItems: MenuItem[];
  onAddToCart: (item: MenuItem | CartItem) => void;
  onRemoveFromCart: (itemId: string) => void;
  onItemClick: (item: CartItem, menuItem: MenuItem) => void;
  hideTrigger?: boolean;
  externalOpenSignal?: number;
  checkoutPath?: string;
}

export function CartBar({
  items,
  total,
  menuItems,
  onAddToCart,
  onRemoveFromCart,
  onItemClick,
  hideTrigger = false,
  externalOpenSignal,
  checkoutPath,
}: CartBarProps) {
  const router = useRouter();
  const t = useGuestT();
  const { locale } = useGuestLocale();
  const { formatMoney } = useGuestLocalization();
  const publicMenu = usePublicMenuOptional();
  const restaurant = publicMenu?.restaurant ?? staticRestaurant;
  const customizationGroups = publicMenu?.customizationGroups ?? staticCustomizationGroups;
  const taxRatePercent = publicMenu?.taxRate ?? 0;
  const resolvedCheckoutPath = checkoutPath ?? publicMenu?.checkoutPath ?? "/mobile/checkout";
  const parksUntilOpen = guestParksUntilOpen({
    storeOpenNow: isGuestRestaurantOpenNow(
      publicMenu?.restaurant?.hours,
      publicMenu?.restaurant?.timezone,
    ),
    orderType: publicMenu?.orderType ?? "pickup",
    orderModes: publicMenu?.orderModes,
  });
  const scheduledPickupAt = publicMenu?.scheduledPickupAt ?? null;
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isSheetDragging, setIsSheetDragging] = useState(false);
  const touchStartY = useRef(0);
  const dragYRef = useRef(0);
  const draggingFromHandleRef = useRef(false);
  const pullingSheetRef = useRef(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );
  const subtotal = total;
  const tax = Math.round(subtotal * (taxRatePercent / 100) * 100) / 100;
  const cartTotal = subtotal + tax;

  const setSheetOffset = (next: number) => {
    dragYRef.current = next;
    setDragY(next);
  };

  const closeCart = () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = null;
    setSheetOffset(0);
    setIsSheetDragging(false);
    setIsOpen(false);
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
            setIsOpen(false);
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
    setMounted(true);
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!externalOpenSignal || externalOpenSignal <= 0) return;
    setIsOpen(true);
  }, [externalOpenSignal]);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = "unset";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !mounted) return;
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
  }, [isOpen, mounted]);

  const cartButtonClass =
    "sheen-overlay relative flex min-h-12 w-full items-center justify-between rounded-xl border border-white/26 bg-black/78 px-4 py-3 text-white backdrop-blur-2xl shadow-[0_14px_30px_rgba(0,0,0,0.42)] ring-1 ring-white/10 transition-transform duration-200 hover:bg-black/84 active:scale-[0.99] dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:backdrop-blur-xl dark:hover:bg-blue-900/70 vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:backdrop-blur-xl vivid:hover:bg-white/84";
  const qtyWrapClass =
    "sheen-overlay relative flex h-fit flex-shrink-0 items-center gap-1 rounded-full border border-white/26 bg-black/78 px-1.5 py-1 text-white backdrop-blur-2xl shadow-[0_10px_24px_rgba(0,0,0,0.4)] ring-1 ring-white/10 dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:backdrop-blur-xl vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:backdrop-blur-xl";
  const qtyButtonClass =
    "sheen-overlay relative flex h-7 w-7 items-center justify-center rounded-full border border-white/26 bg-black/78 text-white backdrop-blur-2xl ring-1 ring-white/10 transition-colors hover:bg-black/84 dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:backdrop-blur-xl dark:hover:bg-blue-900/70 vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:backdrop-blur-xl vivid:hover:bg-white/84";

  return (
    <>
      {!hideTrigger && (
        <div className="menu-item-controls fixed bottom-4 left-4 right-4 z-[var(--z-bottom-bar)]">
          <button type="button" className={cartButtonClass} onClick={() => setIsOpen(true)}>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              <span className="font-semibold">{t("cart.viewCart")}</span>
              {itemCount > 0 ? <span className="font-semibold">({itemCount})</span> : null}
            </div>
            <span className="text-lg font-bold">
              {itemCount > 0 ? formatMoney(cartTotal) : t("cart.emptyShort")}
            </span>
          </button>
        </div>
      )}

      {mounted &&
        isOpen &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[54] bg-black/30"
              onClick={closeCart}
              aria-label={t("cart.closeDrawer")}
              style={{
                opacity: Math.max(0, 1 - dragY / 420),
                transition: isSheetDragging ? "none" : "opacity 0.28s ease-out",
              }}
            />

            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[55]">
              <div className="pointer-events-auto mx-auto w-full max-w-none pb-[env(safe-area-inset-bottom)] px-1.5 md:max-w-2xl md:px-4">
                <div
                  className="liquid-glass animate-in slide-in-from-bottom-6 fade-in-0 rounded-t-2xl border-t border-border/90 bg-card/95 shadow-2xl shadow-black/45 backdrop-blur-xl will-change-transform duration-300"
                  style={{
                    transform: `translateY(${dragY}px)`,
                    transition: isSheetDragging ? "none" : "transform 0.28s ease-out",
                  }}
                >
                  <div
                    ref={handleRef}
                    className="flex h-8 touch-none items-center justify-center"
                    onTouchStart={handleHandleTouchStart}
                    onTouchEnd={finishSheetDrag}
                    onTouchCancel={finishSheetDrag}
                  >
                    <div className="h-1 w-12 rounded-full bg-border" />
                  </div>

                  <div
                    ref={scrollRef}
                    className="max-h-[78vh] overflow-y-auto px-4 pb-4 md:px-5"
                    onTouchStart={handleContentTouchStart}
                    onTouchEnd={finishSheetDrag}
                    onTouchCancel={finishSheetDrag}
                  >
                    <div className="flex items-center justify-between pb-4">
                      <ShoppingCart className="h-6 w-6 text-foreground" />
                      <p className="flex-1 text-center text-xl font-bold text-foreground">{t("cart.title")}</p>
                      <button
                        type="button"
                        onClick={closeCart}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/80 text-muted-foreground transition-colors hover:bg-background/90 hover:text-foreground"
                        aria-label={t("common.close")}
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <p className="mb-4 text-sm font-semibold text-foreground">{restaurant.name}</p>

                    {items.length === 0 ? (
                      <div className="py-8">
                        <div className="flex flex-col items-center justify-center gap-4 py-8">
                          <div className="text-5xl">🍽️</div>
                          <p className="text-lg font-semibold text-foreground">{t("cart.empty")}</p>
                          <p className="text-sm text-muted-foreground">
                            {t("cart.browseMenuHint")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsOpen(false)}
                          className={`${cartButtonClass} justify-center`}
                        >
                          {t("cart.browseMenu")}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="mb-4 space-y-4 py-2">
                          {items.map((cartItem) => {
                            if (isRewardCartLine(cartItem)) {
                              const reward = publicMenu?.rewards.find(
                                (entry) => entry.id === cartItem.rewardId,
                              );
                              const rewardMenuItem =
                                reward?.menuItemId != null
                                  ? menuItems.find((entry) => entry.id === reward.menuItemId)
                                  : null;

                              return (
                                <div
                                  key={guestCartLineId(cartItem)}
                                  className="border-b border-border/70 pb-6 last:border-b-0"
                                >
                                  <div className="flex items-center gap-3">
                                    {rewardMenuItem?.image ? (
                                      <img
                                        src={rewardMenuItem.image}
                                        alt={rewardMenuItem.name}
                                        className="h-16 w-16 shrink-0 rounded object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-orange-500/15 text-2xl">
                                        🎁
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-base font-semibold text-foreground">
                                        {cartItem.name}
                                      </p>
                                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-orange-600">
                                        {t("cart.reward")}
                                      </p>
                                      <p className="mt-1 text-sm font-medium text-muted-foreground">
                                        {formatMoney(0)}
                                      </p>
                                    </div>
                                    <div
                                      className={`menu-item-controls ${qtyWrapClass}`}
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => onRemoveFromCart(cartItem.id)}
                                        className={qtyButtonClass}
                                        aria-label={`${t("cart.remove")} ${cartItem.name}`}
                                      >
                                        <Trash2 className="h-4 w-4 text-current" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            const menuItem = menuItems.find((entry) => entry.id === cartItem.id);
                            if (!menuItem) return null;
                            const localizedName =
                              resolveCatalogText(
                                locale,
                                { name: menuItem.name, description: menuItem.description },
                                menuItem.i18n,
                              ).name || cartItem.name;
                            const pricedCartItem = {
                              ...cartItem,
                              promoKind: cartItem.promoKind ?? menuItem.promoKind,
                              compareAtPrice:
                                cartItem.compareAtPrice ?? menuItem.compareAtPrice,
                            };
                            const unitPrice = getGuestCartItemUnitPrice(
                              pricedCartItem,
                              customizationGroups,
                            );
                            const lineTotal = getGuestCartItemLineTotal(
                              pricedCartItem,
                              customizationGroups,
                            );
                            const compareAtLineTotal = getGuestCartItemCompareAtLineTotal(
                              pricedCartItem,
                              customizationGroups,
                            );
                            const showLineTotal =
                              cartItem.quantity > 1 &&
                              Math.abs(lineTotal - unitPrice) > 0.009;

                            return (
                              <div key={guestCartLineId(cartItem)} className="border-b border-border/70 pb-6 last:border-b-0">
                                <div
                                  className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-80"
                                  onClick={() => {
                                    onItemClick(cartItem, menuItem);
                                    setIsOpen(false);
                                  }}
                                >
                                  <img
                                    src={menuItem.image || "/placeholder.svg"}
                                    alt={localizedName}
                                    className="h-16 w-16 shrink-0 rounded object-cover"
                                  />

                                  <div className="flex min-w-0 flex-1 flex-col">
                                    <p className="text-base font-semibold text-foreground">
                                      {localizedName}
                                      <GuestDealBadge
                                        kind={guestDealKind({
                                          promoKind:
                                            cartItem.promoKind ?? menuItem.promoKind,
                                        })}
                                      />
                                    </p>

                                    {(cartItem.selectedOptions ||
                                      cartItem.sauceQuantities ||
                                      cartItem.specialInstructions) && (
                                      <div className="mt-1 space-y-1">
                                        <GuestCustomizationDisplayLines
                                          groups={customizationGroups}
                                          selectedOptions={cartItem.selectedOptions}
                                          textSizeClassName="text-sm"
                                        />
                                        {cartItem.sauceQuantities &&
                                          Object.entries(cartItem.sauceQuantities).map(
                                            ([sauceId, qty]) =>
                                              qty > 0 ? (
                                                <p key={sauceId} className="text-sm text-teal-700">
                                                  <span className="text-foreground/70">
                                                    Extra Sauce:
                                                  </span>{" "}
                                                  {sauceId} x{qty}
                                                </p>
                                              ) : null
                                          )}
                                        {cartItem.specialInstructions && (
                                          <p className="text-sm">
                                            <span className="text-foreground/70">
                                              {t("common.instructions")}
                                            </span>
                                            <span className="ml-1 italic text-amber-700/90">
                                              {cartItem.specialInstructions}
                                            </span>
                                          </p>
                                        )}
                                      </div>
                                    )}

                                    <p className="mt-1 text-sm font-medium text-foreground">
                                      {compareAtLineTotal != null ? (
                                        <PromoPrice
                                          price={lineTotal}
                                          compareAtPrice={compareAtLineTotal}
                                          formatMoney={formatMoney}
                                        />
                                      ) : showLineTotal ? (
                                        `${formatMoney(unitPrice)} · ${formatMoney(lineTotal)}`
                                      ) : (
                                        formatMoney(lineTotal)
                                      )}
                                    </p>
                                  </div>

                                  <div className={`menu-item-controls ${qtyWrapClass}`} onClick={(event) => event.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => onRemoveFromCart(guestCartLineId(cartItem))}
                                      className={qtyButtonClass}
                                      aria-label={`${t("cart.remove")} ${localizedName}`}
                                    >
                                      {cartItem.quantity === 1 ? (
                                        <Trash2 className="h-4 w-4 text-current" />
                                      ) : (
                                        <Minus className="h-4 w-4 text-current" />
                                      )}
                                    </button>
                                    <span className="w-4 text-center text-xs font-semibold text-current">
                                      {cartItem.quantity}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onAddToCart({ ...cartItem, quantity: 1 })
                                      }
                                      className={qtyButtonClass}
                                      aria-label={`Add ${localizedName}`}
                                    >
                                      <Plus className="h-4 w-4 text-current" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-2 space-y-2">
                          {taxRatePercent > 0 ? (
                            <>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-foreground">{t("common.subtotal")}</span>
                                <span className="text-base font-semibold text-foreground">
                                  {formatMoney(subtotal)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-foreground">{t("common.tax")}</span>
                                <span className="text-base font-semibold text-foreground">
                                  {formatMoney(tax)}
                                </span>
                              </div>
                            </>
                          ) : null}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-foreground">{t("common.total")}</span>
                            <span className="text-lg font-bold text-foreground">
                              {formatMoney(cartTotal)}
                            </span>
                          </div>

                          <button
                            type="button"
                            className={`${cartButtonClass} mt-3 justify-center`}
                            onClick={() => {
                              setIsOpen(false);
                              router.push(resolvedCheckoutPath);
                            }}
                          >
                            {parksUntilOpen
                              ? scheduledPickupAt
                                ? t("actions.checkoutAt", {
                                    time: formatPickupScheduleLabel(
                                      scheduledPickupAt,
                                      restaurant?.timezone,
                                    ),
                                  })
                                : t("closed.scheduleOrder")
                              : t("cart.proceedToCheckout")}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
