"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bike, CheckCheck, ChevronLeft, CookingPot, Loader2, LogIn, MapPin, MessageSquare, Phone, Sparkles, Store } from "lucide-react";
import { usePublicMenu } from "@/lib/contexts/PublicMenuContext";
import { guestStorePath } from "@/lib/public-menu/guestMenuPaths";
import { createGuestOrderReadyPlayer, unlockGuestOrderReadyAudio } from "@/lib/mobile-ordering/guest-order-ready-sound";
import {
  clearGuestActiveOrder,
  writeGuestActiveOrder,
} from "@/lib/public-menu/guest-active-order-storage";
import {
  readGuestOrderPlacement,
  readGuestOrderClaimToken,
  resumeGuestOrderPlacementIfNeeded,
  type GuestOrderPlacementItem,
  type GuestOrderPlacementState,
} from "@/lib/public-menu/guest-order-placement";
import { formatPickupScheduleLabel } from "@/lib/public-menu/buildPickupScheduleSlots";
import { useDisplayPhone } from "@/lib/public-menu/use-display-phone";
import {
  parseDeliveryInstructionParts,
  parseLabeledBuildingApt,
  guestDeliveryDisplayLines,
  splitGuestDeliveryOrderNote,
} from "@/lib/public-menu/guest-delivery-address";
import { cn } from "@/lib/utils";
import type { GuestCustomizationGroup, GuestMenuItem } from "@/lib/guest-menu/types";
import type { GuestOrderTrackStatus } from "@/lib/public-menu/deriveGuestOrderTrackStatus";
import { previewCatalogDiscount } from "@/lib/public-menu/guest-reward-cart";
import type { PublicMenuReward } from "@/lib/public-menu/types";
import { GuestOrderPushEnableCard } from "@/components/mobile-ordering/guest-order-push-enable-card";
import { GuestMenuLink } from "@/components/mobile-ordering/guest-store-chrome";
import { useGuestT, useGuestLocale } from "@/lib/guest-i18n";
import type { EnMessageKey } from "@/lib/guest-i18n/messages/en";
import { useGuestLocalization } from "@/lib/hooks/useGuestLocalization";
import { resolveCatalogText } from "@/lib/catalog-i18n";
import { GuestDealBadge, guestDealKind } from "@/components/mobile-ordering/guest-deal-badge";
import { formatCounterOrderLabel } from "@/lib/orders/formatCounterOrderLabel";
import { GuestCustomizationDisplayLines, OpsCustomizationDisplayLines } from "@/components/shared/customization-display-lines";
import { resolveCustomizationOptionPrice } from "@/lib/public-menu/resolve-customization-option-price";
import type { PublicOrderStatusItem } from "@/lib/public-menu/getPublicOrderStatus";
import { groupGuestConfirmationItems } from "@/lib/public-menu/groupGuestConfirmationItems";
import { guestLineCompareAtTotal, lineTotalWithPromo } from "@/lib/promotions/pricing";
import { PromoPrice } from "@/components/shared/promo-price";

type OrderType = "on_site" | "pickup";

type LoyaltyClaimState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "skipped" }
  | { status: "error" }
  | { status: "claimed"; awarded: number };

type StatusStep = {
  id: "placed" | "preparing" | "ready";
  label: string;
  subtitle: string;
  icon: typeof CheckCheck;
};

const TRACK_STEPS: Omit<StatusStep, "label" | "subtitle">[] = [
  { id: "placed", icon: CheckCheck },
  { id: "preparing", icon: CookingPot },
  { id: "ready", icon: CheckCheck },
];

const POLL_INTERVAL_MS = 3000;

type PublicOrderStatusPayload = {
  trackStatus: GuestOrderTrackStatus;
  orderType?: string;
  orderNumber?: string;
  etaSecondsRemaining: number | null;
  scheduledPickupAt?: string | null;
  notes?: string | null;
  itemSummary: {
    total: number;
    pending: number;
    preparing: number;
    ready: number;
    served: number;
  };
  items?: PublicOrderStatusItem[];
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  total?: number;
  delivery?: {
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    postalCode: string | null;
    deliveryInstructions: string | null;
    deliveryFee: number;
  } | null;
};

type ConfirmationDelivery = {
  nickname: string | null;
  name: string | null;
  line1: string;
  building: string | null;
  line2: string | null;
  city: string | null;
  intercom: string | null;
  phone: string | null;
  instructions: string | null;
};

function guestFacingOrderNotes(notes: string | null | undefined): string | null {
  const { instructions } = splitGuestDeliveryOrderNote(notes);
  if (!instructions) return null;
  const kept = instructions
    .split("\n")
    .map((part) => part.trim())
    .filter((part) => part && !part.toLowerCase().startsWith("scheduled "));
  return kept.join("\n") || null;
}

function confirmationDeliveryFromPlacement(
  address:
    | {
        nickname?: string | null;
        line1?: string | null;
        building?: string | null;
        line2?: string | null;
        city?: string | null;
        intercom?: string | null;
        phone?: string | null;
        instructions?: string | null;
      }
    | null
    | undefined,
  guestName?: string | null,
): ConfirmationDelivery | null {
  const line1 = address?.line1?.trim() ?? "";
  if (!line1) return null;
  return {
    nickname: address?.nickname?.trim() || null,
    name: guestName?.trim() || null,
    line1,
    building: address?.building?.trim() || null,
    line2: address?.line2?.trim() || null,
    city: address?.city?.trim() || null,
    intercom: address?.intercom?.trim() || null,
    phone: address?.phone?.trim() || null,
    instructions: address?.instructions?.trim() || null,
  };
}

function lineAddOnsPerUnit(
  customizations: GuestOrderPlacementItem["customizations"],
  groups: GuestCustomizationGroup[],
): number {
  const selectedOptions = customizations.reduce<Record<string, string[]>>(
    (acc, customization) => {
      acc[customization.groupId] ??= [];
      acc[customization.groupId]!.push(customization.optionId);
      return acc;
    },
    {},
  );
  return customizations.reduce((sum, customization) => {
    const group = groups.find((entry) => entry.id === customization.groupId);
    const option = group?.options.find((entry) => entry.id === customization.optionId);
    if (!option) return sum;
    const unit = resolveCustomizationOptionPrice(option, selectedOptions, groups);
    return sum + unit * Math.max(1, customization.quantity);
  }, 0);
}

function storedLineAddOnsPerUnit(
  customizations: PublicOrderStatusItem["customizations"],
): number {
  return customizations.reduce(
    (sum, entry) => sum + (Number(entry.optionPrice) || 0) * Math.max(1, entry.quantity),
    0,
  );
}

function buildOrderedLinesPricing(
  lines: GuestOrderPlacementItem[],
  menuItems: GuestMenuItem[],
  groups: GuestCustomizationGroup[],
  reward: PublicMenuReward | null,
) {
  let freeItemApplied = false;
  return lines.map((line) => {
    const menuItem = menuItems.find((entry) => entry.id === line.itemId);
    const quantity = Math.max(1, line.quantity);
    const addOnsPerUnit = lineAddOnsPerUnit(line.customizations, groups);
    const isFreeRewardLine =
      reward?.kind === "free_item" &&
      reward.menuItemId === line.itemId &&
      !freeItemApplied;
    if (isFreeRewardLine) freeItemApplied = true;
    const lineTotal = isFreeRewardLine
      ? 0
      : lineTotalWithPromo({
          kind: menuItem?.promoKind,
          unitBasePrice: menuItem?.price ?? 0,
          addOnsTotalPerUnit: addOnsPerUnit,
          quantity,
        });
    const compareAtTotal = isFreeRewardLine
      ? null
      : guestLineCompareAtTotal({
          promoKind: menuItem?.promoKind,
          chargedTotal: lineTotal,
          quantity,
          unitBasePrice: menuItem?.price ?? 0,
          compareAtPrice: menuItem?.compareAtPrice,
          addOnsTotalPerUnit: addOnsPerUnit,
        });
    return {
      line,
      menuItem,
      lineTotal,
      compareAtTotal,
      isReward: isFreeRewardLine,
    };
  });
}

function counterStepIndex(status: GuestOrderTrackStatus): number {
  switch (status) {
    case "scheduled":
    case "cancelled":
    case "refunded":
      return -1;
    case "placed":
      return 0;
    case "preparing":
      return 1;
    case "ready":
    case "served":
      return 2;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

type TranslateFn = (key: EnMessageKey, vars?: Record<string, string | number>) => string;

function formatSoftWaitEstimate(
  seconds: number | null,
  trackStatus: GuestOrderTrackStatus,
  t: TranslateFn,
  scheduledPickupAt?: string | null,
  timeZone?: string | null,
): string {
  if (trackStatus === "served") return t("confirm.allDone");
  if (trackStatus === "cancelled") return t("confirm.cancelledSubtitle");
  if (trackStatus === "refunded") return t("confirm.refundedSubtitle");
  if (trackStatus === "ready") return t("confirm.readyNow");
  if (trackStatus === "scheduled") {
    if (scheduledPickupAt) return formatPickupScheduleLabel(scheduledPickupAt, timeZone);
    return t("confirm.scheduled");
  }
  if (trackStatus === "placed") return t("confirm.confirmShortly");
  if (seconds == null) return t("confirm.beingPrepared");

  const minutes = Math.ceil(seconds / 60);

  // Still within the staff quote from /orders accept.
  if (minutes > 0) {
    if (minutes <= 4) return t("confirm.fewMinutes");
    if (minutes <= 8) return t("confirm.about5to10");
    if (minutes <= 12) return t("confirm.about10to15");
    if (minutes <= 18) return t("confirm.about15to20");
    if (minutes <= 25) return t("confirm.about20to25");
    if (minutes <= 35) return t("confirm.about30");
    return t("confirm.about40plus");
  }

  // Quote elapsed, still preparing - automatic delay copy (no staff re-quote).
  const overdueMinutes = Math.max(0, Math.ceil(Math.abs(seconds) / 60));
  if (overdueMinutes <= 8) return t("confirm.takingLonger");
  if (overdueMinutes <= 20) return t("confirm.stillPreparing");
  return t("confirm.hangTight");
}

function waitEstimateLabel(trackStatus: GuestOrderTrackStatus, t: TranslateFn): string {
  switch (trackStatus) {
    case "scheduled":
      return t("confirm.pickupTime");
    case "placed":
      return t("confirm.status");
    case "preparing":
      return t("confirm.estimatedWait");
    case "ready":
      return t("confirm.status");
    case "served":
      return t("confirm.complete");
    case "cancelled":
      return t("confirm.cancelled");
    case "refunded":
      return t("confirm.refunded");
    default: {
      const _exhaustive: never = trackStatus;
      return _exhaustive;
    }
  }
}

function unwrapStatusResponse(payload: unknown): PublicOrderStatusPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const data =
    record.ok === true && record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : record;
  if (typeof data.trackStatus !== "string") return null;
  return data as PublicOrderStatusPayload;
}

export function GuestOrderConfirmationPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useGuestT();
  const displayPhone = useDisplayPhone();
  const { locale } = useGuestLocale();
  const { formatMoney } = useGuestLocalization();
  const {
    restaurant,
    menuPath,
    storeSlug,
    items,
    customizationGroups,
    rewards,
    guestSeat,
    guestOrderPlacement,
    syncGuestOrderPlacement,
    checkoutPath,
    refetchOrderHistory,
    refetchCustomer,
    taxRate: taxRatePercent,
    customer,
    customerLoading,
    loyaltySettings,
    orderModes,
  } = usePublicMenu();

  const placementKey = searchParams.get("placementKey") ?? "";
  const isPlacementPending = searchParams.get("pending") === "1";

  // sessionStorage is client-only - never read it during render or SSR hydration mismatches.
  const [storedPlacement, setStoredPlacement] = useState<GuestOrderPlacementState | null>(null);

  useEffect(() => {
    if (!placementKey) {
      setStoredPlacement(null);
      return;
    }
    setStoredPlacement(readGuestOrderPlacement(storeSlug, placementKey));
  }, [placementKey, storeSlug]);

  const resolvedPlacement = useMemo(() => {
    if (
      guestOrderPlacement &&
      (!placementKey || guestOrderPlacement.idempotencyKey === placementKey)
    ) {
      return guestOrderPlacement;
    }
    return storedPlacement;
  }, [guestOrderPlacement, placementKey, storedPlacement]);

  const orderNumberRaw =
    resolvedPlacement?.orderNumber ??
    searchParams.get("orderNumber") ??
    (isPlacementPending ? "..." : "-");
  const orderId =
    resolvedPlacement?.orderId ?? searchParams.get("orderId") ?? "";
  const placementError = resolvedPlacement?.status === "error" ? resolvedPlacement.error : null;
  const isSubmittingOrder =
    isPlacementPending &&
    (!resolvedPlacement || resolvedPlacement.status === "pending");
  const urlMode = searchParams.get("mode");
  const [liveIsDelivery, setLiveIsDelivery] = useState(false);
  const isDeliveryOrder =
    liveIsDelivery ||
    urlMode === "delivery" ||
    resolvedPlacement?.request?.orderType === "delivery";
  const urlOrderType: OrderType =
    urlMode === "pickup" || urlMode === "delivery" ? "pickup" : "on_site";
  const [liveOrderType, setLiveOrderType] = useState<OrderType | null>(null);
  // Prefer live status from the server - URL mode can be missing/wrong after refresh.
  const orderType: OrderType = liveOrderType ?? urlOrderType;
  const [liveOrderNumber, setLiveOrderNumber] = useState<string | null>(null);
  const orderNumber =
    orderNumberRaw === "..." || orderNumberRaw === "-"
      ? orderNumberRaw
      : formatCounterOrderLabel({
          orderNumber: liveOrderNumber ?? orderNumberRaw,
          orderType:
            isDeliveryOrder
              ? "delivery"
              : orderType === "pickup"
                ? "pickup"
                : "dine_in",
          orderId: orderId || null,
        });
  const tableNumber = searchParams.get("table") ?? "";
  const etaMinutes = Number(searchParams.get("eta") ?? 15);
  const initialScheduledFor = searchParams.get("scheduledFor");
  const estimatedEarnPoints = Math.max(0, Number(searchParams.get("earnPoints") ?? "0") || 0);
  const [loyaltyClaim, setLoyaltyClaim] = useState<LoyaltyClaimState>({ status: "idle" });
  const claimAttemptedRef = useRef(false);

  const [trackStatus, setTrackStatus] = useState<GuestOrderTrackStatus>(
    initialScheduledFor ? "scheduled" : "placed",
  );
  const [scheduledPickupAt, setScheduledPickupAt] = useState<string | null>(
    initialScheduledFor,
  );
  const [orderNotes, setOrderNotes] = useState<string | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [itemSummary, setItemSummary] = useState<PublicOrderStatusPayload["itemSummary"] | null>(
    null,
  );
  const [liveItems, setLiveItems] = useState<PublicOrderStatusItem[] | null>(null);
  const [liveMoney, setLiveMoney] = useState<{
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    total: number;
  } | null>(null);
  const [liveDelivery, setLiveDelivery] = useState<
    NonNullable<PublicOrderStatusPayload["delivery"]> | null
  >(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [soundMuted, setSoundMuted] = useState(false);
  const previousStatusRef = useRef<GuestOrderTrackStatus>("placed");
  const readyPlayerRef = useRef<ReturnType<typeof createGuestOrderReadyPlayer> | null>(null);
  const playReadySoundRef = useRef(false);

  const getReadyPlayer = useCallback(() => {
    if (!readyPlayerRef.current) {
      readyPlayerRef.current = createGuestOrderReadyPlayer();
    }
    return readyPlayerRef.current;
  }, []);

  const stopReadySound = useCallback(() => {
    readyPlayerRef.current?.stop();
  }, []);

  const startReadySound = useCallback(async () => {
    const player = getReadyPlayer();
    let started = await player.start();
    if (!playReadySoundRef.current) {
      player.stop();
      return false;
    }
    if (!started) {
      const unlocked = await unlockGuestOrderReadyAudio();
      if (!playReadySoundRef.current) {
        player.stop();
        return false;
      }
      if (unlocked) {
        started = await player.start();
      }
    }
    if (!playReadySoundRef.current) {
      player.stop();
      return false;
    }
    return started;
  }, [getReadyPlayer]);

  const statusSteps = useMemo<StatusStep[]>(() => {
    const isServed = trackStatus === "served";
    const readyLabel = isServed ? t("confirm.complete") : t("confirm.ready");
    const readySubtitle = isServed
      ? t("confirm.allDone")
      : isDeliveryOrder
        ? t("confirm.readyForDelivery")
        : orderType === "pickup"
          ? t("confirm.readyForPickup")
          : t("confirm.readyToServe");
    const stepCopy: Record<StatusStep["id"], { label: string; subtitle: string }> = {
      placed: { label: t("confirm.received"), subtitle: t("confirm.receivedSubtitle") },
      preparing: { label: t("confirm.preparing"), subtitle: t("confirm.preparingSubtitle") },
      ready: { label: readyLabel, subtitle: readySubtitle },
    };
    return TRACK_STEPS.map((step) => ({
      ...step,
      ...stepCopy[step.id],
    }));
  }, [isDeliveryOrder, orderType, t, trackStatus]);

  useEffect(() => {
    if (!placementKey || !isPlacementPending) return;
    resumeGuestOrderPlacementIfNeeded(storeSlug, placementKey, syncGuestOrderPlacement);
  }, [isPlacementPending, placementKey, storeSlug, syncGuestOrderPlacement]);

  const claimToken = useMemo(() => {
    const fromPlacement = resolvedPlacement?.claimToken?.trim();
    if (fromPlacement) return fromPlacement;
    if (!orderId) return null;
    return readGuestOrderClaimToken(storeSlug, orderId);
  }, [orderId, resolvedPlacement?.claimToken, storeSlug]);

  const confirmReturnTo = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const confirmLoginPath = `/login?returnTo=${encodeURIComponent(confirmReturnTo)}`;
  const confirmSignupPath = `/signup?returnTo=${encodeURIComponent(confirmReturnTo)}&store=${encodeURIComponent(storeSlug)}`;

  useEffect(() => {
    if (customerLoading) return;
    if (!customer || !orderId || !claimToken || isSubmittingOrder || placementError) {
      return;
    }
    if (claimAttemptedRef.current) return;
    claimAttemptedRef.current = true;

    let cancelled = false;
    setLoyaltyClaim({ status: "pending" });

    void (async () => {
      try {
        const response = await fetch("/api/public/orders/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeSlug, orderId, token: claimToken }),
        });
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          data?: { awarded?: number };
        } | null;
        if (cancelled) return;
        if (!response.ok || payload?.ok === false) {
          setLoyaltyClaim({ status: "error" });
          return;
        }
        const awarded = Math.max(0, Number(payload?.data?.awarded ?? 0) || 0);
        setLoyaltyClaim({ status: "claimed", awarded });
        void refetchOrderHistory();
        void refetchCustomer();
      } catch {
        if (!cancelled) setLoyaltyClaim({ status: "error" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    claimToken,
    customer,
    customerLoading,
    isSubmittingOrder,
    orderId,
    placementError,
    refetchCustomer,
    refetchOrderHistory,
    storeSlug,
  ]);

  useEffect(() => {
    if (resolvedPlacement?.status !== "success" || !resolvedPlacement.orderId) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("pending");
    params.set("orderId", resolvedPlacement.orderId);
    if (resolvedPlacement.orderNumber) {
      params.set("orderNumber", resolvedPlacement.orderNumber);
    }

    const next = `${guestStorePath(storeSlug, "/order-confirmation")}?${params.toString()}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== next) {
      router.replace(next);
    }
  }, [resolvedPlacement, router, searchParams, storeSlug]);

  // Keep ?mode= in sync with the real order type from the server (survives refresh).
  useEffect(() => {
    if (!liveOrderType || !orderId) return;
    const currentMode = searchParams.get("mode");
    const desired = liveOrderType === "pickup" ? "pickup" : "on_site";
    if (currentMode === desired) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", desired);
    if (liveOrderType === "pickup") {
      params.delete("table");
    }
    router.replace(`${guestStorePath(storeSlug, "/order-confirmation")}?${params.toString()}`);
  }, [liveOrderType, orderId, router, searchParams, storeSlug]);

  const fetchStatus = useCallback(async () => {
    if (!orderId || !storeSlug) return;

    try {
      const params = new URLSearchParams({
        storeSlug,
        eta: String(etaMinutes),
      });
      const response = await fetch(
        `/api/public/orders/${encodeURIComponent(orderId)}/status?${params.toString()}`,
        { cache: "no-store" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) {
        const message =
          (payload?.error &&
            typeof payload.error === "object" &&
            typeof payload.error.message === "string" &&
            payload.error.message) ||
          t("confirm.unableToLoadStatus");
        throw new Error(message);
      }

      const status = unwrapStatusResponse(payload);
      if (!status) {
        throw new Error("Invalid order status response");
      }

      // Stop alert the moment poll leaves ready - don't wait on effect timing.
      if (status.trackStatus !== "ready") {
        playReadySoundRef.current = false;
        stopReadySound();
      }

      setTrackStatus(status.trackStatus);
      if (typeof status.orderNumber === "string" && status.orderNumber) {
        setLiveOrderNumber(status.orderNumber);
      }
      if (typeof status.orderType === "string" && status.orderType) {
        setLiveIsDelivery(status.orderType === "delivery");
        setLiveOrderType(
          status.orderType === "pickup" || status.orderType === "delivery"
            ? "pickup"
            : "on_site",
        );
      }
      if (status.delivery && typeof status.delivery.addressLine1 === "string") {
        setLiveDelivery(status.delivery);
      } else if (status.delivery === null) {
        setLiveDelivery(null);
      }
      if (typeof status.scheduledPickupAt === "string" && status.scheduledPickupAt) {
        setScheduledPickupAt(status.scheduledPickupAt);
      }
      if (typeof status.notes === "string") {
        setOrderNotes(status.notes.trim() || null);
      } else if (status.notes === null) {
        setOrderNotes(null);
      }
      // Soft estimate only - no local second ticker. Allow staff quote updates.
      setEtaSeconds((prev) => {
        if (status.trackStatus === "placed") return null;
        if (
          status.trackStatus === "ready" ||
          status.trackStatus === "served" ||
          status.trackStatus === "cancelled" ||
          status.trackStatus === "refunded"
        ) {
          return 0;
        }
        const next = status.etaSecondsRemaining;
        if (next == null) return null;
        if (prev == null) return next;
        // Staff changed the /orders prep quote.
        if (Math.abs(next - prev) > 45) return next;
        // Prefer fresher server value for soft ranges (no stressful tick).
        return next;
      });
      setItemSummary(status.itemSummary);
      if (Array.isArray(status.items)) {
        setLiveItems(status.items);
      }
      if (
        typeof status.subtotal === "number" &&
        typeof status.taxAmount === "number" &&
        typeof status.total === "number"
      ) {
        setLiveMoney({
          subtotal: status.subtotal,
          taxAmount: status.taxAmount,
          discountAmount:
            typeof status.discountAmount === "number" ? status.discountAmount : 0,
          total: status.total,
        });
      }
      setFetchError(null);

      if (
        (status.trackStatus === "served" ||
          status.trackStatus === "cancelled" ||
          status.trackStatus === "refunded") &&
        previousStatusRef.current !== status.trackStatus
      ) {
        void refetchOrderHistory({ force: true });
      }

      if (
        previousStatusRef.current !== "ready" &&
        previousStatusRef.current !== "served" &&
        (status.trackStatus === "ready" || status.trackStatus === "served") &&
        typeof navigator !== "undefined" &&
        "vibrate" in navigator
      ) {
        navigator.vibrate([120, 60, 120]);
      }
      previousStatusRef.current = status.trackStatus;
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : t("confirm.unableToLoadStatus"));
    } finally {
      setLoading(false);
    }
  }, [etaMinutes, orderId, refetchOrderHistory, stopReadySound, storeSlug, t]);

  useEffect(() => {
    if (
      trackStatus === "served" ||
      trackStatus === "cancelled" ||
      trackStatus === "refunded"
    ) {
      clearGuestActiveOrder(storeSlug, orderId || undefined);
      return;
    }
    if (!orderId || !storeSlug) return;
    writeGuestActiveOrder(storeSlug, {
      orderId,
      orderNumber: typeof orderNumber === "string" && orderNumber !== "-" && orderNumber !== "..."
        ? orderNumber
        : orderId,
      mode: orderType === "pickup" ? "pickup" : "on_site",
      tableNumber: orderType === "on_site" && tableNumber ? tableNumber : null,
      etaMinutes,
      savedAt: Date.now(),
    });
  }, [etaMinutes, orderId, orderNumber, orderType, storeSlug, tableNumber, trackStatus]);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    void fetchStatus();
    const interval = window.setInterval(() => {
      void fetchStatus();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [fetchStatus, orderId]);

  const isOrderReady = trackStatus === "ready";
  const playReadySound = isOrderReady && !soundMuted;
  playReadySoundRef.current = playReadySound;

  useEffect(() => {
    // New ready cycle should alert again.
    if (!isOrderReady) {
      setSoundMuted(false);
    }
  }, [isOrderReady]);

  useEffect(() => {
    // Prime shared audio while waiting (checkout unlock should already have run).
    void unlockGuestOrderReadyAudio();
  }, []);

  useEffect(() => {
    if (!playReadySound) {
      stopReadySound();
      return;
    }

    let cancelled = false;

    const tryStart = async () => {
      if (cancelled || !playReadySoundRef.current) return;
      const started = await startReadySound();
      if (!started && !cancelled && playReadySoundRef.current) {
        // Retry in case the first attempt raced page navigation / load.
        window.setTimeout(() => {
          if (!cancelled && playReadySoundRef.current) {
            void startReadySound();
          }
        }, 400);
      }
    };

    void tryStart();
    const retryInterval = window.setInterval(() => {
      if (!playReadySoundRef.current) return;
      if (readyPlayerRef.current?.isPlaying()) return;
      void startReadySound();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(retryInterval);
      stopReadySound();
    };
  }, [playReadySound, startReadySound, stopReadySound]);

  useEffect(() => {
    return () => {
      stopReadySound();
    };
  }, [stopReadySound]);

  const handleAcknowledgeReady = useCallback(() => {
    setSoundMuted(true);
    playReadySoundRef.current = false;
    stopReadySound();
  }, [stopReadySound]);

  const currentStatusIndex = counterStepIndex(
    trackStatus === "served" ? "ready" : trackStatus,
  );
  const displayStatus: GuestOrderTrackStatus =
    trackStatus === "served" ? "ready" : trackStatus;
  const isTerminalClosed =
    trackStatus === "cancelled" || trackStatus === "refunded";

  const kitchenProgressLabel = itemSummary
    ? t("confirm.itemsReady", {
        ready: itemSummary.ready + itemSummary.served,
        total: itemSummary.total,
      })
    : null;
  const placementItems = resolvedPlacement?.request?.items ?? [];
  const placementNotes =
    resolvedPlacement?.request?.notes?.trim() || null;
  const deliveryView = useMemo(() => {
    const fromPlacement = confirmationDeliveryFromPlacement(
      resolvedPlacement?.request?.deliveryAddress,
      resolvedPlacement?.request?.guestName,
    );
    if (fromPlacement) return fromPlacement;
    if (!liveDelivery?.addressLine1) return null;
    const parsed = parseDeliveryInstructionParts(liveDelivery.deliveryInstructions);
    const buildingApt = parseLabeledBuildingApt(liveDelivery.addressLine2);
    return {
      nickname: null,
      name: resolvedPlacement?.request?.guestName?.trim() || null,
      line1: liveDelivery.addressLine1,
      building: buildingApt.building,
      line2: buildingApt.line2,
      city: liveDelivery.city,
      intercom: parsed.intercom,
      phone: parsed.phone,
      instructions: parsed.instructions,
    };
  }, [liveDelivery, resolvedPlacement]);
  const deliveryLines = deliveryView
    ? guestDeliveryDisplayLines(deliveryView, displayPhone)
    : null;
  const displayedOrderNotes = isDeliveryOrder
    ? (() => {
        const extra =
          placementNotes?.trim() || guestFacingOrderNotes(orderNotes);
        const onCard = deliveryLines?.instructions?.trim() || null;
        if (extra && onCard && extra === onCard) return null;
        return extra || null;
      })()
    : orderNotes ?? placementNotes;
  const selectedRewardId = resolvedPlacement?.request?.rewardId ?? null;
  const selectedReward =
    selectedRewardId != null
      ? rewards.find((reward) => reward.id === selectedRewardId) ?? null
      : null;
  const groupedLiveItems = useMemo(
    () =>
      groupGuestConfirmationItems(liveItems ?? [], (line) => {
        const catalogItem = line.itemId
          ? items.find((entry) => entry.id === line.itemId)
          : undefined;
        if (catalogItem?.promoKind === "bogo") return false;
        return (
          selectedReward?.kind === "free_item" &&
          selectedReward.menuItemId === line.itemId &&
          line.lineTotal === 0
        );
      }),
    [items, liveItems, selectedReward],
  );
  const pricedLines = groupGuestConfirmationItems(
    buildOrderedLinesPricing(
      placementItems,
      items,
      customizationGroups,
      selectedReward,
    ).map((entry) => ({
      ...entry,
      itemId: entry.line.itemId,
      itemName: entry.menuItem?.name,
      quantity: entry.line.quantity,
      notes: entry.line.notes,
      customizations: entry.line.customizations,
    })),
  );
  const useLiveItems = groupedLiveItems.length > 0;
  const showItemsSection = useLiveItems || pricedLines.length > 0;
  const placementSubtotal = pricedLines.reduce((sum, entry) => sum + entry.lineTotal, 0);
  const placementLoyaltyDiscount =
    selectedReward != null ? previewCatalogDiscount(selectedReward, placementSubtotal) : 0;
  const placementTax = placementSubtotal * (taxRatePercent / 100);
  const deliveryFee =
    liveDelivery?.deliveryFee ??
    (isDeliveryOrder ? Math.max(0, Number(orderModes.delivery?.delivery_fee) || 0) : 0);
  const placementTotal = Math.max(
    0,
    placementSubtotal + placementTax - placementLoyaltyDiscount + deliveryFee,
  );

  // Prefer live order money, but if the DB row was saved without tax, recompute
  // from the store rate so a refresh matches checkout.
  let subtotal = liveMoney?.subtotal ?? placementSubtotal;
  let tax = liveMoney?.taxAmount ?? placementTax;
  let loyaltyDiscount = liveMoney?.discountAmount ?? placementLoyaltyDiscount;
  let total = liveMoney?.total ?? placementTotal;
  if (liveMoney && tax <= 0 && taxRatePercent > 0 && subtotal > 0) {
    const exclusive = Math.max(0, subtotal - loyaltyDiscount);
    const looksTaxExclusive =
      Math.abs(total - exclusive) <= 0.02 ||
      Math.abs(total - subtotal) <= 0.02 ||
      (deliveryFee > 0 && Math.abs(total - (exclusive + deliveryFee)) <= 0.02);
    if (looksTaxExclusive) {
      tax = Math.round(subtotal * (taxRatePercent / 100) * 100) / 100;
      total = Math.max(
        0,
        Math.round((subtotal + tax - loyaltyDiscount + deliveryFee) * 100) / 100,
      );
    }
  }

  const showGuestClaimCta =
    !customerLoading &&
    !customer &&
    Boolean(claimToken) &&
    !isSubmittingOrder &&
    !placementError;
  const showGuestEarnCopy =
    Boolean(loyaltySettings?.enabled) && estimatedEarnPoints > 0;
  const claimedAwarded =
    loyaltyClaim.status === "claimed" ? loyaltyClaim.awarded : 0;
  const showYouWillEarn =
    Boolean(customer) &&
    estimatedEarnPoints > 0 &&
    claimedAwarded === 0 &&
    !placementError &&
    trackStatus !== "served" &&
    trackStatus !== "cancelled" &&
    trackStatus !== "refunded";
  const showYouEarned =
    estimatedEarnPoints > 0 &&
    (claimedAwarded > 0 ||
      (Boolean(customer) &&
        trackStatus === "served" &&
        (loyaltyClaim.status === "claimed" || !claimToken)));

  return (
    <div className="min-h-screen">
      <header className="checkout-header sticky top-0 z-30 border-b border-border/70 bg-card/80 px-2 backdrop-blur-xl lg:px-4">
        <div className="mx-auto flex w-full max-w-none items-center justify-between gap-2 px-1 py-1 lg:px-4">
          <div className="flex min-w-0 items-center gap-2" dir="ltr">
            <GuestMenuLink
              href={menuPath}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-foreground/10"
              aria-label={t("common.backToMenu")}
            >
              <ChevronLeft className="h-5 w-5" />
            </GuestMenuLink>
            <h1 className="text-lg font-bold text-foreground">{t("confirm.title")}</h1>
          </div>
          <Image
            src="/BerryTapSVG.svg"
            alt="BerryTap"
            width={140}
            height={36}
            className="h-6 w-auto shrink-0"
            priority
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-4 lg:px-8">
        <section className="rounded-2xl border border-border/70 bg-card/70 p-5 text-center shadow-sm backdrop-blur-md">
          <p className="text-sm text-muted-foreground">{t("confirm.orderNumber")}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {isSubmittingOrder ? (
              <span className="inline-flex items-center gap-2 text-lg">
                <Loader2 className="h-5 w-5 animate-spin" />
                {t("confirm.sendingOrder")}
              </span>
            ) : (
              orderNumber
            )}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {trackStatus === "scheduled" && scheduledPickupAt
              ? t(
                  isDeliveryOrder
                    ? "confirm.deliveryScheduled"
                    : "confirm.pickupScheduled",
                  {
                    time: formatPickupScheduleLabel(
                      scheduledPickupAt,
                      restaurant?.timezone,
                    ),
                  },
                )
              : orderType === "pickup"
                ? t(isDeliveryOrder ? "confirm.deliveryOrder" : "confirm.pickupOrder")
                : tableNumber
                  ? `${t("confirm.dineInTable", { number: tableNumber })}${
                      guestSeat ? ` · Seat ${guestSeat.seatNumber}` : ""
                    }${guestSeat?.guestName ? ` · ${guestSeat.guestName}` : ""}`
                  : t("context.dineIn")}
          </p>
        </section>

        {orderId && !isSubmittingOrder && !placementError ? (
          <GuestOrderPushEnableCard storeSlug={storeSlug} orderId={orderId} />
        ) : null}

        {placementError ? (
          <section className="rounded-2xl border border-red-300/40 bg-red-500/10 p-4 text-sm text-red-900 dark:text-red-100">
            <p className="font-semibold">{t("confirm.couldNotPlace")}</p>
            <p className="mt-1 opacity-90">{placementError}</p>
            <Link
              href={checkoutPath}
              className="mt-3 inline-block text-sm font-semibold underline"
            >
              {t("confirm.backToCheckout")}
            </Link>
          </section>
        ) : null}

        {showGuestClaimCta ? (
          <section className="rounded-2xl border border-amber-300/40 bg-amber-500/10 p-4 text-sm shadow-sm backdrop-blur-md dark:border-amber-200/20 dark:bg-amber-500/10">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-800 dark:text-amber-100" />
              <p className="font-semibold text-amber-900 dark:text-amber-100">
                {showGuestEarnCopy
                  ? t("confirm.signInToEarn", {
                      points: estimatedEarnPoints.toLocaleString(),
                    })
                  : t("confirm.signInToSaveOrder")}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href={confirmLoginPath}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
              >
                <LogIn className="h-4 w-4" />
                {t("account.signIn")}
              </Link>
              <Link
                href={confirmSignupPath}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border/70 bg-card/80 text-sm font-semibold text-foreground"
              >
                {t("account.createAccount")}
              </Link>
            </div>
          </section>
        ) : null}

        {showYouEarned ? (
          <section className="rounded-2xl border border-amber-300/40 bg-amber-500/10 p-4 text-sm shadow-sm backdrop-blur-md dark:border-amber-200/20 dark:bg-amber-500/10">
            <p className="font-semibold text-amber-900 dark:text-amber-100">
              {t("confirm.youEarned", {
                points: (claimedAwarded > 0 ? claimedAwarded : estimatedEarnPoints).toLocaleString(),
              })}
            </p>
          </section>
        ) : showYouWillEarn ? (
          <section className="rounded-2xl border border-amber-300/40 bg-amber-500/10 p-4 text-sm shadow-sm backdrop-blur-md dark:border-amber-200/20 dark:bg-amber-500/10">
            <p className="font-semibold text-amber-900 dark:text-amber-100">
              {t("confirm.youWillEarn", {
                points: estimatedEarnPoints.toLocaleString(),
              })}
            </p>
          </section>
        ) : null}

        <section
          className={cn(
            "rounded-2xl border p-5 shadow-sm backdrop-blur-md",
            trackStatus === "cancelled"
              ? "border-rose-300/40 bg-rose-500/10"
              : trackStatus === "refunded"
                ? "border-fuchsia-300/40 bg-fuchsia-500/10"
                : "border-border/70 bg-card/70",
          )}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="relative flex h-2 w-2 shrink-0">
                <span
                  className={cn(
                    "absolute inset-0 rounded-full",
                    isTerminalClosed
                      ? trackStatus === "refunded"
                        ? "bg-fuchsia-500/50"
                        : "bg-rose-500/50"
                      : "bg-emerald-500/50",
                    !isTerminalClosed &&
                      (trackStatus === "scheduled" ||
                        trackStatus === "placed" ||
                        trackStatus === "preparing") &&
                      "guest-order-live-dot",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "relative h-2 w-2 rounded-full",
                    isTerminalClosed
                      ? trackStatus === "refunded"
                        ? "bg-fuchsia-500"
                        : "bg-rose-500"
                      : "bg-emerald-500",
                  )}
                />
              </span>
              <span
                className={cn(
                  isTerminalClosed &&
                    (trackStatus === "refunded"
                      ? "font-semibold text-fuchsia-900 dark:text-fuchsia-100"
                      : "font-semibold text-rose-900 dark:text-rose-100"),
                )}
              >
                {waitEstimateLabel(trackStatus, t)}
              </span>
            </div>
            <span
              className={cn(
                "text-right text-base font-semibold text-foreground",
                trackStatus === "preparing" && "guest-order-estimate-alive",
                trackStatus === "cancelled" && "text-rose-900 dark:text-rose-100",
                trackStatus === "refunded" && "text-fuchsia-900 dark:text-fuchsia-100",
              )}
            >
              {loading ? (
                <Loader2 className="ml-auto h-5 w-5 animate-spin" />
              ) : (
                formatSoftWaitEstimate(
                  etaSeconds,
                  trackStatus,
                  t,
                  scheduledPickupAt,
                  restaurant?.timezone,
                )
              )}
            </span>
          </div>

          {!orderId && !isSubmittingOrder && (
            <p className="mb-3 text-xs text-muted-foreground">
              {t("confirm.liveTrackingUnavailable")}
            </p>
          )}

          {isSubmittingOrder && (
            <p className="mb-3 text-xs text-muted-foreground">
              {t("confirm.sendingToKitchen")}
            </p>
          )}

          {fetchError && (
            <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">{fetchError}</p>
          )}

          {kitchenProgressLabel && !isTerminalClosed ? (
            <p className="mb-3 text-xs text-muted-foreground">{kitchenProgressLabel}</p>
          ) : null}

          {isTerminalClosed ? null : (
          <div className="space-y-3">
            {statusSteps.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === displayStatus;
              const isComplete = currentStatusIndex >= index || trackStatus === "served";
              const showReadyRainbow = step.id === "ready" && isOrderReady;
              const showReceivedPulse = isActive && !showReadyRainbow && trackStatus === "placed";
              const showPreparingSweep = isActive && !showReadyRainbow && trackStatus === "preparing";
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2",
                    showReadyRainbow
                      ? "guest-order-ready-rainbow"
                      : showPreparingSweep
                        ? "guest-order-track-active"
                        : showReceivedPulse
                          ? "guest-order-track-pulse"
                          : isActive
                            ? "border-primary/40 bg-primary/10"
                            : isComplete
                              ? "border-border/60 bg-card/40"
                              : "border-border/40 opacity-60",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      showReadyRainbow && "guest-order-ready-rainbow-icon",
                      showPreparingSweep && "guest-order-track-icon-alive text-primary",
                      showReceivedPulse && "text-primary",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-semibold text-foreground",
                        showReadyRainbow && "guest-order-ready-rainbow-label",
                      )}
                    >
                      {step.label}
                    </p>
                    <p
                      className={cn(
                        "text-xs text-muted-foreground",
                        showReadyRainbow && "font-medium text-foreground/80",
                        (showReceivedPulse || showPreparingSweep) && "text-foreground/70",
                      )}
                    >
                      {step.subtitle}
                    </p>
                  </div>
                  {step.id === "ready" && playReadySound ? (
                    <button
                      type="button"
                      onClick={handleAcknowledgeReady}
                      className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-bold text-background"
                    >
                      {t("confirm.gotIt")}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
          )}
        </section>

        {showItemsSection ? (
          <section className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur-md">
            <p className="mb-3 text-base font-semibold text-foreground">{t("confirm.items")}</p>
            <div className="space-y-3">
              {useLiveItems
                ? groupedLiveItems.map((line) => {
                    const catalogItem = line.itemId
                      ? items.find((entry) => entry.id === line.itemId)
                      : undefined;
                    const displayName = catalogItem
                      ? resolveCatalogText(
                          locale,
                          {
                            name: catalogItem.name,
                            description: catalogItem.description,
                          },
                          catalogItem.i18n,
                        ).name
                      : line.itemName;
                    const isLoyaltyFree =
                      selectedReward?.kind === "free_item" &&
                      selectedReward.menuItemId === line.itemId &&
                      line.lineTotal === 0;
                    const compareAtTotal = isLoyaltyFree
                      ? null
                      : guestLineCompareAtTotal({
                          promoKind: catalogItem?.promoKind,
                          chargedTotal: line.lineTotal,
                          quantity: line.quantity,
                          unitBasePrice: catalogItem?.price ?? 0,
                          compareAtPrice: catalogItem?.compareAtPrice,
                          addOnsTotalPerUnit: storedLineAddOnsPerUnit(
                            line.customizations,
                          ),
                        });
                    return (
                    <div
                      key={line.id}
                      className="flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {line.quantity}× {displayName}
                          <GuestDealBadge
                            kind={guestDealKind({
                              promoKind: catalogItem?.promoKind,
                              isLoyaltyReward: isLoyaltyFree,
                            })}
                          />
                        </p>
                        {line.customizations.length > 0 ? (
                          <div className="mt-0.5">
                            <OpsCustomizationDisplayLines
                              customizations={line.customizations}
                              surface="guest"
                              textSizeClassName="text-xs"
                            />
                          </div>
                        ) : null}
                        {line.notes ? (
                          <p className="text-xs">
                            <span className="text-foreground/70">{t("common.instructions")}</span>{" "}
                            <span className="italic text-amber-700/90">{line.notes}</span>
                          </p>
                        ) : null}
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-foreground">
                        {compareAtTotal != null ? (
                          <PromoPrice
                            price={line.lineTotal}
                            compareAtPrice={compareAtTotal}
                            formatMoney={formatMoney}
                          />
                        ) : (
                          formatMoney(line.lineTotal)
                        )}
                      </p>
                    </div>
                    );
                  })
                : pricedLines.map(({ line, menuItem, lineTotal, compareAtTotal, isReward, quantity }, index) => {
                    const groupedOptions = line.customizations.reduce<Record<string, string[]>>(
                      (acc, entry) => {
                        acc[entry.groupId] ??= [];
                        acc[entry.groupId]!.push(entry.optionId);
                        return acc;
                      },
                      {},
                    );

                    return (
                      <div
                        key={`${line.itemId}-${index}`}
                        className="flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                          {quantity}×{" "}
                            {menuItem
                              ? resolveCatalogText(
                                  locale,
                                  {
                                    name: menuItem.name,
                                    description: menuItem.description,
                                  },
                                  menuItem.i18n,
                                ).name
                              : line.itemId}
                            <GuestDealBadge
                              kind={guestDealKind({
                                promoKind: menuItem?.promoKind,
                                isLoyaltyReward: isReward,
                              })}
                            />
                          </p>
                          {Object.keys(groupedOptions).length > 0 ? (
                            <div className="mt-0.5 space-y-0.5">
                              <GuestCustomizationDisplayLines
                                groups={customizationGroups}
                                selectedOptions={groupedOptions}
                              />
                            </div>
                          ) : null}
                          {line.notes ? (
                            <p className="text-xs">
                              <span className="text-foreground/70">{t("common.instructions")}</span>{" "}
                              <span className="italic text-amber-700/90">{line.notes}</span>
                            </p>
                          ) : null}
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-foreground">
                          {compareAtTotal != null ? (
                            <PromoPrice
                              price={lineTotal}
                              compareAtPrice={compareAtTotal}
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
            {displayedOrderNotes ? (
              <p className="mt-3 text-xs">
                <span className="text-foreground/70">{t("common.instructions")}</span>{" "}
                <span className="italic text-amber-700/90">{displayedOrderNotes}</span>
              </p>
            ) : null}
            <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
              {tax > 0 || loyaltyDiscount > 0 || deliveryFee > 0 ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("common.subtotal")}</span>
                  <span className="font-medium text-foreground">{formatMoney(subtotal)}</span>
                </div>
              ) : null}
              {tax > 0 ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {liveMoney ? t("common.tax") : t("checkout.taxPercent", { percent: taxRatePercent })}
                  </span>
                  <span className="font-medium text-foreground">{formatMoney(tax)}</span>
                </div>
              ) : null}
              {loyaltyDiscount > 0 ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("checkout.rewardDiscount")}</span>
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">
                    −{formatMoney(loyaltyDiscount)}
                  </span>
                </div>
              ) : null}
              {deliveryFee > 0 ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("checkout.deliveryFee")}</span>
                  <span className="font-medium text-foreground">{formatMoney(deliveryFee)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-foreground">{t("common.total")}</span>
                <span className="text-lg font-bold text-foreground">{formatMoney(total)}</span>
              </div>
            </div>
          </section>
        ) : null}

        {isDeliveryOrder && deliveryView ? (
          <section className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Bike className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-base font-semibold text-foreground">
                {t("confirm.deliverTo")}
              </p>
            </div>
            <div className="mt-3 space-y-2 text-sm text-foreground">
              {deliveryLines?.place ? (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{deliveryLines.place}</span>
                </div>
              ) : null}
              {deliveryLines?.contact ? (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{deliveryLines.contact}</span>
                </div>
              ) : null}
              {deliveryLines?.instructions ? (
                <div className="flex items-start gap-2">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-xs italic text-amber-700/90">
                    {deliveryLines.instructions}
                  </span>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-base font-semibold text-foreground">{restaurant?.name}</p>
          </div>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            {restaurant?.address ? (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{restaurant.address}</span>
              </div>
            ) : null}
            {restaurant?.phone ? (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{displayPhone(restaurant.phone)}</span>
              </div>
            ) : null}
          </div>
        </section>

        <GuestMenuLink
          href={menuPath}
          className="flex h-12 w-full items-center justify-center rounded-xl border border-border/70 bg-card/70 text-sm font-semibold text-foreground"
        >
          {t("confirm.orderMore")}
        </GuestMenuLink>
      </main>
    </div>
  );
}
