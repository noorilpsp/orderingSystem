"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Clock, Loader2, LogIn, MapPin, Phone, Sparkles, Store, User } from "lucide-react";
import { DeliveryAddressSection } from "@/components/mobile-ordering/checkout/delivery-address-section";
import { OrderTypeToggle } from "@/components/mobile-ordering/checkout/order-type-toggle";
import {
  PickupTimingPicker,
  type PickupTimingMode,
} from "@/components/mobile-ordering/checkout/pickup-timing-picker";
import {
  PaymentMethodSection,
  defaultGuestPaymentMethod,
  paymentMethodFooterHint,
  type GuestPaymentMethodId,
} from "@/components/mobile-ordering/checkout/payment-method-section";
import { usePublicMenu } from "@/lib/contexts/PublicMenuContext";
import { unlockGuestOrderReadyAudio } from "@/lib/mobile-ordering/guest-order-ready-sound";
import { ensureGuestOrderPushPermission } from "@/lib/public-menu/guest-orders-push-client";
import { formatPickupScheduleLabel } from "@/lib/public-menu/buildPickupScheduleSlots";
import { isGuestRestaurantOpenNow } from "@/lib/public-menu/resolveActiveMenu";
import { guestParksUntilOpen } from "@/lib/public-menu/guestParksUntilOpen";
import { resolveGuestSessionMode } from "@/lib/public-menu/guestSessionMode";
import {
  findRewardInCart,
  foodCartItems,
  isRewardCartLine,
  previewCatalogDiscount,
} from "@/lib/public-menu/guest-reward-cart";
import {
  getGuestCartItemCompareAtLineTotal,
  getGuestCartItemLineTotal,
  sumGuestCartItems,
} from "@/lib/public-menu/guest-cart-pricing";
import { guestCartLineId } from "@/lib/public-menu/guest-cart-lines";
import {
  isCompleteGuestDeliveryAddress,
  readLastGuestDeliveryAddress,
  type GuestDeliveryAddress,
} from "@/lib/public-menu/guest-delivery-address";
import {
  isValidGuestPhone,
  phoneCountryFromStoreCountry,
  readStoredGuestPhone,
  writeStoredGuestPhone,
} from "@/lib/public-menu/guest-phone";
import { useDisplayPhone } from "@/lib/public-menu/use-display-phone";
import { PhoneNumberField } from "@/components/shared/phone-number-field";
import { GuestCustomizationDisplayLines } from "@/components/shared/customization-display-lines";
import { PromoPrice } from "@/components/shared/promo-price";
import { useGuestT, useGuestLocale } from "@/lib/guest-i18n";
import { useGuestLocalization } from "@/lib/hooks/useGuestLocalization";
import { resolveCatalogText } from "@/lib/catalog-i18n";
import { GuestDealBadge, guestDealKind } from "@/components/mobile-ordering/guest-deal-badge";

export function GuestCheckoutPage() {
  const router = useRouter();
  const t = useGuestT();
  const displayPhone = useDisplayPhone();
  const { locale } = useGuestLocale();
  const { formatMoney } = useGuestLocalization();
  const {
    storeSlug,
    cart,
    orderType,
    setOrderType,
    tableNumber,
    setTableNumber,
    restaurant,
    items,
    customizationGroups,
    clearCart,
    menuPath,
    orderModes,
    unavailableReason,
    placeGuestOrder,
    customer,
    checkoutPath,
    loyaltySettings,
    rewards,
    taxRate: taxRatePercent,
    guestSeat,
    guestDeviceId,
    claimGuestSeat,
    updateGuestSeatName,
    scheduledPickupAt,
    setScheduledPickupAt,
  } = usePublicMenu();

  const [pickupTimingMode, setPickupTimingMode] = useState<PickupTimingMode>("now");
  const [scheduleOpenNonce, setScheduleOpenNonce] = useState(0);
  const [orderNotes, setOrderNotes] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestPhoneError, setGuestPhoneError] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState<GuestDeliveryAddress | null>(null);
  const [deliveryAddressError, setDeliveryAddressError] = useState(false);
  const [deliveryAddressOpen, setDeliveryAddressOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<GuestPaymentMethodId>("pay_at_pickup");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const placingRef = useRef(false);
  const guestPhoneInputRef = useRef<HTMLInputElement>(null);
  const guestNameInputRef = useRef<HTMLInputElement>(null);
  const deliveryAddressButtonRef = useRef<HTMLButtonElement>(null);
  const didDefaultPickupRef = useRef(false);

  const pickupPrepMinutes = orderModes.pickup?.estimated_time_minutes ?? 15;
  const deliveryPrepMinutes =
    orderModes.delivery?.estimated_time_minutes ?? pickupPrepMinutes;

  useEffect(() => {
    if (customer) return;
    const stored = readStoredGuestPhone();
    if (stored) setGuestPhone(stored);
  }, [customer]);

  useEffect(() => {
    const last = readLastGuestDeliveryAddress();
    if (last) setDeliveryAddress(last);
  }, []);

  useEffect(() => {
    const fromSeat = guestSeat?.guestName?.trim();
    if (!fromSeat) return;
    setGuestName((prev) => (prev.trim() ? prev : fromSeat));
  }, [guestSeat?.guestName]);

  // Walk-in checkout starts on pickup once; table QR keeps dine-in; delivery stays delivery.
  useEffect(() => {
    if (didDefaultPickupRef.current) return;
    didDefaultPickupRef.current = true;
    if (!tableNumber.trim() && orderType === "dine-in") {
      setOrderType("pickup");
    }
  }, [orderType, setOrderType, tableNumber]);

  const rewardCartLine = findRewardInCart(cart);
  const selectedReward =
    rewardCartLine?.rewardId != null
      ? rewards.find((reward) => reward.id === rewardCartLine.rewardId) ?? null
      : null;
  const purchasableCart = foodCartItems(cart);
  const freeItemRewardOnly =
    purchasableCart.length === 0 &&
    selectedReward?.kind === "free_item" &&
    !!selectedReward.menuItemId;
  const canPlaceOrder =
    purchasableCart.length > 0 || freeItemRewardOnly;
  const foodSubtotal = sumGuestCartItems(purchasableCart, customizationGroups);
  const loyaltyDiscount =
    selectedReward != null ? previewCatalogDiscount(selectedReward, foodSubtotal) : 0;
  const loyaltyEarnSubtotal = Math.max(0, foodSubtotal - loyaltyDiscount);
  const estimatedEarnPoints =
    loyaltySettings?.enabled
      ? Math.floor(loyaltyEarnSubtotal * (loyaltySettings.pointsPerDollar ?? 0))
      : 0;
  const showGuestEarnTeaser = !customer && estimatedEarnPoints > 0;
  const checkoutLoginPath = `/login?returnTo=${encodeURIComponent(checkoutPath)}`;
  const dineInEnabled = orderModes.dine_in?.enabled !== false;
  const pickupEnabled = orderModes.pickup?.enabled !== false;
  const deliveryEnabled = orderModes.delivery?.enabled === true;
  const guestSessionMode = resolveGuestSessionMode(orderModes);
  const isSelfPickupMode = guestSessionMode === "self_service";
  const isDelivery = orderType === "delivery";
  const fulfillmentPrepMinutes = isDelivery ? deliveryPrepMinutes : pickupPrepMinutes;
  const storeOpenNow = isGuestRestaurantOpenNow(restaurant?.hours, restaurant?.timezone);
  const shouldParkUntilOpen = guestParksUntilOpen({
    storeOpenNow,
    orderType,
    orderModes,
  });
  const deliveryFee = isDelivery
    ? Math.max(0, Number(orderModes.delivery?.delivery_fee) || 0)
    : 0;
  const deliveryMinimum = isDelivery
    ? Math.max(0, Number(orderModes.delivery?.minimum_order) || 0)
    : 0;
  const meetsDeliveryMinimum = deliveryMinimum <= 0 || foodSubtotal + 1e-9 >= deliveryMinimum;
  const subtotal = foodSubtotal;
  const tax = subtotal * (taxRatePercent / 100);
  const total = Math.max(0, subtotal + tax - loyaltyDiscount + deliveryFee);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Same channels as the menu pill: dine-in (if this visit has a table or is self-pickup),
  // plus pickup / delivery when those modes are on.
  const checkoutDineInEnabled =
    dineInEnabled && (isSelfPickupMode || tableNumber.trim().length > 0);
  const showOrderTypeToggle =
    [checkoutDineInEnabled, pickupEnabled, deliveryEnabled].filter(Boolean).length >= 2;
  // Delivery-to-table needs a table. Self pickup dine-in is counter collect -
  // never bind checkout to a table (avoids sticky ?table= looking "auto-selected").
  const usesTableSession = orderType === "dine-in" && !isSelfPickupMode;
  const needsGuestPhone = !customer && !usesTableSession && !isDelivery;
  const needsDeliveryAddress = isDelivery;

  // Drop any leftover table when this store is self pickup.
  useEffect(() => {
    if (!isSelfPickupMode) return;
    if (!tableNumber.trim()) return;
    setTableNumber("");
  }, [isSelfPickupMode, setTableNumber, tableNumber]);

  useEffect(() => {
    if (usesTableSession) {
      setPickupTimingMode("now");
      setScheduledPickupAt(null);
      return;
    }
    if (shouldParkUntilOpen) {
      setPickupTimingMode("schedule");
      return;
    }
    if (scheduledPickupAt) {
      setPickupTimingMode("schedule");
      return;
    }
    if (orderType !== "pickup" && orderType !== "delivery") {
      setPickupTimingMode("now");
      setScheduledPickupAt(null);
    }
  }, [
    orderType,
    scheduledPickupAt,
    shouldParkUntilOpen,
    usesTableSession,
  ]);

  useEffect(() => {
    setPaymentMethod(
      defaultGuestPaymentMethod({
        orderType,
        usesTableSession,
        isSelfPickupMode,
      }),
    );
  }, [isSelfPickupMode, orderType, usesTableSession]);

  const apiOrderType = useMemo(() => {
    if (orderType === "delivery") return "delivery" as const;
    if (usesTableSession) return "dine_in" as const;
    // Self-pickup dine-in stays dine_in; API converts to counter pickup.
    if (orderType === "dine-in" && isSelfPickupMode) return "dine_in" as const;
    return "pickup" as const;
  }, [isSelfPickupMode, orderType, usesTableSession]);

  const readyExceptSchedule =
    canPlaceOrder &&
    !!paymentMethod &&
    meetsDeliveryMinimum &&
    (!usesTableSession || tableNumber.trim().length > 0);

  const scheduleOk = usesTableSession
    ? true
    : shouldParkUntilOpen
      ? !!scheduledPickupAt
      : orderType !== "pickup" && orderType !== "delivery"
        ? true
        : pickupTimingMode === "now" || !!scheduledPickupAt;

  const isFormComplete = readyExceptSchedule && scheduleOk;

  const cardClass =
    "rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm backdrop-blur-md";

  const handlePlaceOrder = () => {
    if (unavailableReason || placingRef.current) return;
    if (needsDeliveryAddress && !isCompleteGuestDeliveryAddress(deliveryAddress)) {
      setDeliveryAddressError(true);
      setDeliveryAddressOpen(true);
      deliveryAddressButtonRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }
    if (needsGuestPhone && !isValidGuestPhone(guestPhone)) {
      setGuestPhoneError(true);
      guestPhoneInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      guestPhoneInputRef.current?.focus();
      return;
    }
    if (
      !usesTableSession &&
      !scheduledPickupAt &&
      (shouldParkUntilOpen || pickupTimingMode === "schedule")
    ) {
      setScheduleOpenNonce((nonce) => nonce + 1);
      return;
    }
    if (!isFormComplete) return;
    placingRef.current = true;
    setIsSubmitting(true);

    void (async () => {
      // Unlock ready-alert audio in this click so confirmation can autoplay later.
      // Await so the shared Audio element is primed before we leave checkout.
      await unlockGuestOrderReadyAudio();
      // Same gesture: start the permission prompt (don't block placing on the dialog).
      void ensureGuestOrderPushPermission();

      // Free-item rewards can be ordered alone; include the linked menu item so the
      // API has a real line, then loyalty redemption zeros the price server-side.
      const items =
        purchasableCart.length > 0
          ? purchasableCart.map((item) => ({
              itemId: item.id,
              quantity: item.quantity,
              notes: item.specialInstructions ?? null,
              customizations: Object.entries(item.selectedOptions ?? {}).flatMap(
                ([groupId, optionIds]) =>
                  optionIds.map((optionId) => ({
                    groupId,
                    optionId,
                    quantity: 1,
                  })),
              ),
            }))
          : freeItemRewardOnly && selectedReward?.menuItemId
            ? [
                {
                  itemId: selectedReward.menuItemId,
                  quantity: 1,
                  notes: null,
                  customizations: [],
                },
              ]
            : [];

      const guestNotes = orderNotes.trim() || null;
      const tableGuestName = usesTableSession ? guestName.trim().slice(0, 255) || null : null;
      const deliveryPhone = isDelivery ? deliveryAddress?.phone.trim() || null : null;
      if (needsGuestPhone) {
        writeStoredGuestPhone(guestPhone);
      } else if (deliveryPhone) {
        writeStoredGuestPhone(deliveryPhone);
      }

      // Delivery-to-table: ensure this phone has a seat before placing (for split later).
      let seatId: string | null = guestSeat?.seatId ?? null;
      if (usesTableSession && guestDeviceId && !seatId) {
        const claimed = await claimGuestSeat();
        seatId = claimed?.seatId ?? null;
      }

      if (usesTableSession && tableGuestName) {
        void updateGuestSeatName(tableGuestName);
      }

      const placementKey = placeGuestOrder({
        storeSlug,
        orderType: apiOrderType,
        paymentTiming: "pay_later",
        tableNumber: usesTableSession ? tableNumber : null,
        seatId: usesTableSession ? seatId : null,
        deviceId: usesTableSession ? guestDeviceId || null : null,
        notes: guestNotes,
        scheduledPickupAt:
          usesTableSession
            ? null
            : shouldParkUntilOpen || pickupTimingMode === "schedule"
              ? scheduledPickupAt
              : null,
        rewardId: selectedReward?.id,
        phone: needsGuestPhone ? guestPhone.trim() : deliveryPhone,
        guestName: tableGuestName,
        deliveryAddress: isDelivery ? deliveryAddress : null,
        items,
      });

      clearCart();

      const params = new URLSearchParams();
      params.set("pending", "1");
      params.set("placementKey", placementKey);
      params.set(
        "mode",
        orderType === "pickup"
          ? "pickup"
          : orderType === "delivery"
            ? "delivery"
            : "on_site",
      );
      if (usesTableSession && tableNumber) params.set("table", tableNumber);
      params.set("eta", String(isDelivery ? deliveryPrepMinutes : pickupPrepMinutes));
      if (estimatedEarnPoints > 0) {
        params.set("earnPoints", String(estimatedEarnPoints));
      }
      if (scheduledPickupAt) params.set("scheduledFor", scheduledPickupAt);

      router.push(`/menu/${storeSlug}/order-confirmation?${params.toString()}`);
    })();
  };

  if (isSubmitting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <Loader2 className="h-7 w-7 animate-spin text-foreground" aria-hidden />
        <p className="text-lg font-semibold text-foreground">{t("checkout.placingOrder")}</p>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold text-foreground">{t("cart.empty")}</p>
        <Link href={menuPath} className="mt-4 text-sm font-medium text-primary underline">
          {t("common.backToMenu")}
        </Link>
      </div>
    );
  }

  if (!canPlaceOrder) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold text-foreground">{t("checkout.addMenuItem")}</p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {t("checkout.rewardNeedsItem")}
        </p>
        <Link href={menuPath} className="mt-4 text-sm font-medium text-primary underline">
          {t("common.backToMenu")}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28">
      <header className="checkout-header sticky top-0 z-30 border-b border-border/70 bg-card/80 px-2 backdrop-blur-xl lg:px-4">
        <div
          className="mx-auto flex w-full max-w-none items-center justify-start gap-2 px-1 py-1 lg:px-4"
          dir="ltr"
        >
          <Link
            href={menuPath}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-foreground/10"
            aria-label={t("common.backToMenu")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-foreground">{t("checkout.title")}</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4 lg:px-8">
        {showOrderTypeToggle ? (
          <OrderTypeToggle
            value={orderType}
            dineInEnabled={checkoutDineInEnabled}
            pickupEnabled={pickupEnabled}
            deliveryEnabled={deliveryEnabled}
            onChange={(next) => {
              setOrderType(next);
            }}
          />
        ) : null}

        <section className={cardClass}>
          <div className="flex flex-col gap-3">
            <div className="flex h-4 items-center gap-2">
              <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="m-0 text-sm font-semibold leading-none text-foreground">
                {restaurant?.name}
              </p>
            </div>
            {restaurant?.address ? (
              <div className="flex h-4 items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="m-0 text-sm leading-none text-muted-foreground">
                  {restaurant.address}
                </p>
              </div>
            ) : null}
            {restaurant?.phone ? (
              <div className="flex h-4 items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="m-0 text-sm leading-none text-muted-foreground">
                  {displayPhone(restaurant.phone)}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        {unavailableReason ? (
          <section className="rounded-2xl border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
            <p className="font-semibold">{t("checkout.orderingUnavailable")}</p>
            <p className="mt-1 opacity-90">{unavailableReason}</p>
          </section>
        ) : null}

        <section className={cardClass}>
          <div className="flex min-w-0 items-start gap-3">
            <User className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                {customer ? t("checkout.orderingAs") : t("checkout.guestCheckout")}
              </p>
              {customer ? (
                <>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{customer.name || customer.email}</span>
                  </p>
                  {customer.phone ? (
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{displayPhone(customer.phone)}</span>
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {showGuestEarnTeaser
                    ? t("checkout.signInToEarnOrder", {
                        points: estimatedEarnPoints.toLocaleString(),
                      })
                    : t("checkout.signInToSave")}
                </p>
              )}
            </div>
          </div>
          {!customer && usesTableSession ? (
            <label className="mt-4 block text-sm text-foreground">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {t("checkout.nameOptional")}
              </span>
              <input
                ref={guestNameInputRef}
                id="guest-checkout-name"
                type="text"
                autoComplete="name"
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder={t("checkout.namePlaceholder")}
                maxLength={255}
                className="mt-1.5 h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="mt-1.5 block text-xs text-muted-foreground">
                {t("checkout.nameHint")}
              </span>
            </label>
          ) : null}
          {!needsGuestPhone ? null : (
            <label className="mt-4 block text-sm text-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                {t("checkout.phone")}
              </span>
              <PhoneNumberField
                inputRef={guestPhoneInputRef}
                id="guest-checkout-phone"
                value={guestPhone}
                onChange={(next) => {
                  setGuestPhone(next);
                  if (guestPhoneError) setGuestPhoneError(false);
                }}
                defaultCountry={restaurant?.country}
                invalid={guestPhoneError}
                placeholder={t("checkout.phonePlaceholder")}
                locale={locale}
                countryAriaLabel={t("checkout.addressPhoneCountry")}
                searchPlaceholder={t("checkout.searchCountry")}
                emptyText={t("checkout.noCountryFound")}
                className="mt-1.5"
                triggerClassName="h-11 rounded-xl"
                inputClassName={`h-11 scroll-mt-24 rounded-xl border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground shadow-none focus-visible:ring-2 ${
                  guestPhoneError
                    ? "border-rose-500 focus-visible:border-rose-500 focus-visible:ring-rose-500/20"
                    : "border-border/70 focus-visible:border-primary focus-visible:ring-primary/20"
                }`}
              />
              <span
                className={`mt-1.5 block text-xs ${
                  guestPhoneError
                    ? "text-rose-600 dark:text-rose-300"
                    : "text-muted-foreground"
                }`}
              >
                {guestPhoneError ? t("checkout.phoneRequired") : t("checkout.phoneHint")}
              </span>
            </label>
          )}
          {needsDeliveryAddress ? (
            <DeliveryAddressSection
              selected={deliveryAddress}
              error={deliveryAddressError}
              open={deliveryAddressOpen}
              onOpenChange={setDeliveryAddressOpen}
              buttonRef={deliveryAddressButtonRef}
              onSelect={(address) => {
                setDeliveryAddress(address);
                if (address) {
                  setDeliveryAddressError(false);
                  if (address.phone) setGuestPhone(address.phone);
                }
              }}
              defaultCountry={phoneCountryFromStoreCountry(restaurant?.country)}
            />
          ) : null}
        </section>

        <section className={cardClass}>
          <p className="mb-3 text-base font-semibold text-foreground">{t("checkout.orderSummary")}</p>
          <div className="space-y-3">
            {cart.map((item) => {
              const catalogItem = items.find((menuItem) => menuItem.id === item.id);
              const displayName = catalogItem
                ? resolveCatalogText(
                    locale,
                    { name: catalogItem.name, description: catalogItem.description },
                    catalogItem.i18n,
                  ).name
                : item.name;
              const pricedItem = {
                ...item,
                promoKind: item.promoKind ?? catalogItem?.promoKind,
                compareAtPrice: item.compareAtPrice ?? catalogItem?.compareAtPrice,
              };
              const lineTotal = getGuestCartItemLineTotal(
                pricedItem,
                customizationGroups,
              );
              const compareAtLineTotal = isRewardCartLine(item)
                ? null
                : getGuestCartItemCompareAtLineTotal(
                    pricedItem,
                    customizationGroups,
                  );
              return (
              <div key={guestCartLineId(item)} className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.quantity}× {displayName}
                    <GuestDealBadge
                      kind={guestDealKind({
                        promoKind: pricedItem.promoKind,
                        isLoyaltyReward: isRewardCartLine(item),
                      })}
                    />
                  </p>
                  {Object.keys(item.selectedOptions ?? {}).length > 0 ? (
                    <div className="mt-0.5 space-y-0.5">
                      <GuestCustomizationDisplayLines
                        groups={customizationGroups}
                        selectedOptions={item.selectedOptions}
                      />
                    </div>
                  ) : null}
                  {item.specialInstructions ? (
                    <p className="text-xs">
                      <span className="text-foreground/70">{t("common.instructions")}</span>{" "}
                      <span className="italic text-amber-700/90">
                        {item.specialInstructions}
                      </span>
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 text-sm font-semibold text-foreground">
                  {compareAtLineTotal != null ? (
                    <PromoPrice
                      price={lineTotal}
                      compareAtPrice={compareAtLineTotal}
                      formatMoney={formatMoney}
                    />
                  ) : (
                    formatMoney(lineTotal)
                  )}
                </p>
              </div>
              );
            })}
          </div>
        </section>

        {usesTableSession && dineInEnabled ? (
          <section className={cardClass}>
            <p className="text-base font-semibold text-foreground">{t("context.table")}</p>
            <p className="text-sm text-muted-foreground">
              {tableNumber
                ? t("context.tableNumber", { number: tableNumber })
                : t("checkout.selectTableHint")}
            </p>
            {guestSeat ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Seat {guestSeat.seatNumber}
                {guestSeat.guestName ? ` · ${guestSeat.guestName}` : ""}
              </p>
            ) : null}
          </section>
        ) : null}

        {(orderType === "pickup" && pickupEnabled) ||
        (isDelivery && deliveryEnabled) ||
        (shouldParkUntilOpen && orderType === "dine-in" && isSelfPickupMode) ? (
          <PickupTimingPicker
            mode={pickupTimingMode}
            scheduledAt={scheduledPickupAt}
            hours={restaurant?.hours}
            prepMinutes={fulfillmentPrepMinutes}
            kind={isDelivery ? "delivery" : "pickup"}
            timeZone={restaurant?.timezone}
            forceScheduled={shouldParkUntilOpen}
            openRequestKey={scheduleOpenNonce}
            onModeChange={setPickupTimingMode}
            onScheduledAtChange={setScheduledPickupAt}
          />
        ) : null}

        <section className={cardClass}>
          <label htmlFor="order-notes" className="block text-base font-semibold text-foreground">
            {t("checkout.notes")}
          </label>
          <textarea
            id="order-notes"
            value={orderNotes}
            onChange={(event) => setOrderNotes(event.target.value)}
            placeholder={t("checkout.notesPlaceholder")}
            rows={3}
            maxLength={500}
            className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </section>

        <div className="space-y-2">
        <PaymentMethodSection
          orderType={orderType}
          usesTableSession={usesTableSession}
          isSelfPickupMode={isSelfPickupMode}
          selectedMethod={paymentMethod}
          onMethodChange={setPaymentMethod}
        />

        <section className={cardClass}>
          {taxRatePercent > 0 || loyaltyDiscount > 0 || isDelivery ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("common.subtotal")}</span>
              <span className="font-medium text-foreground">{formatMoney(subtotal)}</span>
            </div>
          ) : null}
          {taxRatePercent > 0 ? (
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("checkout.taxPercent", { percent: taxRatePercent })}</span>
              <span className="font-medium text-foreground">{formatMoney(tax)}</span>
            </div>
          ) : null}
          {loyaltyDiscount > 0 ? (
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("checkout.rewardDiscount")}</span>
              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                −{formatMoney(loyaltyDiscount)}
              </span>
            </div>
          ) : null}
          {isDelivery ? (
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("checkout.deliveryFee")}</span>
              <span className="font-medium text-foreground">{formatMoney(deliveryFee)}</span>
            </div>
          ) : null}
          {isDelivery && deliveryMinimum > 0 && !meetsDeliveryMinimum ? (
            <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">
              {t("checkout.deliveryMinimumHint", {
                amount: formatMoney(Math.max(0, deliveryMinimum - foodSubtotal)),
              })}
            </p>
          ) : null}
          {customer && estimatedEarnPoints > 0 ? (
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("checkout.youWillEarn")}</span>
              <span className="font-medium text-amber-700 dark:text-amber-300">
                {estimatedEarnPoints.toLocaleString()} {t("common.points")}
              </span>
            </div>
          ) : null}
          {showGuestEarnTeaser ? (
            <div className="mt-3 rounded-xl border border-amber-400/35 bg-amber-500/10 p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="inline-flex items-center gap-2 font-medium text-amber-900 dark:text-amber-100">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  {t("checkout.signInToEarnRow")}
                </span>
                <span className="shrink-0 font-semibold text-amber-800 dark:text-amber-200">
                  {estimatedEarnPoints.toLocaleString()} {t("common.points")}
                </span>
              </div>
              <Link
                href={checkoutLoginPath}
                className="mt-2.5 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
              >
                <LogIn className="h-4 w-4" />
                {t("account.signIn")}
              </Link>
            </div>
          ) : null}
          <div className="my-2 h-px bg-border/80" />
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-foreground">{t("common.total")}</span>
            <span className="text-2xl font-bold text-foreground">{formatMoney(total)}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {paymentMethodFooterHint(paymentMethod, t)}
          </p>
        </section>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto w-full max-w-3xl pb-[calc(env(safe-area-inset-bottom)+2px)] px-4 lg:px-8">
          <div className="item-modal-footer liquid-glass rounded-t-2xl border-t border-border/70 bg-card/85 px-4 pt-3 pb-3 shadow-lg shadow-black/30 backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between px-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {usesTableSession
                    ? t("checkout.footerTableTray", { number: tableNumber || "-" })
                    : scheduledPickupAt &&
                        (isDelivery || orderType === "pickup" || shouldParkUntilOpen)
                      ? t(
                          isDelivery
                            ? "checkout.footerDeliveryScheduled"
                            : "checkout.footerPickupScheduled",
                          {
                            time: formatPickupScheduleLabel(
                              scheduledPickupAt,
                              restaurant?.timezone,
                            ),
                          },
                        )
                    : shouldParkUntilOpen && !scheduledPickupAt
                      ? t("checkout.pickTime")
                      : isDelivery
                        ? t("checkout.footerDeliveryNow")
                        : orderType === "dine-in" && isSelfPickupMode
                          ? t("checkout.footerDineInCounter")
                          : t("checkout.footerPickupNow")}
                </span>
              </div>
              <span>{t("checkout.itemCount", { count: itemCount })}</span>
            </div>
            <button
              type="button"
              disabled={!readyExceptSchedule || !!unavailableReason}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-base font-semibold text-primary-foreground disabled:opacity-50"
              onClick={handlePlaceOrder}
            >
              {`${t("checkout.placeOrder")} • ${formatMoney(total)}`}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
