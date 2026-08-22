"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Bell,
  ClipboardList,
  CreditCard,
  GripHorizontal,
  ShoppingCart,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { GuestBillSplitDialog, type GuestSplitMode, type SplitBillData } from "@/components/mobile-ordering/menu/guest-bill-split-dialog";
import { usePublicMenuOptional } from "@/lib/contexts/PublicMenuContext";
import { useGuestLocale, useGuestT } from "@/lib/guest-i18n";
import { useGuestLocalization } from "@/lib/hooks/useGuestLocalization";
import {
  readDismissedProposalId,
  writeDismissedProposalId,
} from "@/lib/public-menu/guest-split-proposal-storage";
import type { GuestSplitProposalRecord } from "@/lib/db/schema/guest-table-splits";
import { toUserFacingErrorMessage } from "@/lib/db/withDbRetry";
import { resolveGuestSessionMode } from "@/lib/public-menu/guestSessionMode";
import { guestParksUntilOpen } from "@/lib/public-menu/guestParksUntilOpen";
import { isGuestRestaurantOpenNow } from "@/lib/public-menu/resolveActiveMenu";
import { formatPickupScheduleLabel } from "@/lib/public-menu/buildPickupScheduleSlots";

type OrderType = "dine-in" | "pickup" | "delivery";
type ToastType = "success" | "warning";
type ServiceActionResult = { ok: boolean; message: string };

interface SmartBottomBarProps {
  orderType: OrderType;
  cartCount: number;
  total: number;
  waiterCooldownSeconds: number;
  checkRequested: boolean;
  onCallWaiter: (options?: { tableNumber?: string }) => void | Promise<void | ServiceActionResult>;
  onRequestCheck: (options?: { tableNumber?: string }) => void | Promise<void | ServiceActionResult>;
  onViewCart: () => void;
  onToast: (message: string, type?: ToastType) => void;
  activeOrderPath?: string | null;
  activeOrderNumber?: string | null;
}

function normalizeServiceResult(
  result: void | ServiceActionResult,
  fallbackMessage: string,
): ServiceActionResult {
  if (result && typeof result === "object" && "ok" in result) {
    return {
      ok: Boolean(result.ok),
      message: result.message?.trim() || fallbackMessage,
    };
  }
  return { ok: true, message: fallbackMessage };
}

export function SmartBottomBar({
  orderType,
  cartCount,
  total,
  waiterCooldownSeconds,
  checkRequested,
  onCallWaiter,
  onRequestCheck,
  onViewCart,
  onToast,
  activeOrderPath = null,
  activeOrderNumber = null,
}: SmartBottomBarProps) {
  const t = useGuestT();
  const { dir, locale } = useGuestLocale();
  const { formatMoney } = useGuestLocalization();
  const publicMenu = usePublicMenuOptional();
  const linkedTableNumber = publicMenu?.tableNumber?.trim() ?? "";
  const storeSlug = publicMenu?.storeSlug ?? "";
  const guestSeat = publicMenu?.guestSeat ?? null;
  const guestDeviceId = publicMenu?.guestDeviceId ?? "";

  const [mounted, setMounted] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [callWaiterOpen, setCallWaiterOpen] = useState(false);
  const [callWaiterPending, setCallWaiterPending] = useState(false);
  const [callWaiterResult, setCallWaiterResult] = useState<ServiceActionResult | null>(null);
  const [requestCheckOpen, setRequestCheckOpen] = useState(false);
  const [requestCheckPending, setRequestCheckPending] = useState(false);
  const [requestCheckResult, setRequestCheckResult] = useState<ServiceActionResult | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitInitialMode, setSplitInitialMode] = useState<GuestSplitMode | null>(null);
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [splitData, setSplitData] = useState<SplitBillData | null>(null);
  const [proposalBanner, setProposalBanner] = useState<GuestSplitProposalRecord | null>(null);

  const showServiceTray =
    orderType === "dine-in" &&
    resolveGuestSessionMode(publicMenu?.orderModes) !== "self_service";
  const effectiveTableNumber = linkedTableNumber.trim();
  const parksUntilOpen = guestParksUntilOpen({
    storeOpenNow: isGuestRestaurantOpenNow(
      publicMenu?.restaurant?.hours,
      publicMenu?.restaurant?.timezone,
    ),
    orderType,
    orderModes: publicMenu?.orderModes,
  });
  const scheduledPickupAt = publicMenu?.scheduledPickupAt ?? null;
  const cartCtaLabel =
    parksUntilOpen && scheduledPickupAt
      ? t("actions.checkoutAt", {
          time: formatPickupScheduleLabel(
            scheduledPickupAt,
            publicMenu?.restaurant?.timezone,
          ),
        })
      : parksUntilOpen
        ? t("actions.scheduleCartCount", { count: cartCount })
        : t("actions.viewCartCount", { count: cartCount });

  const handleRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const splitFetchGenRef = useRef(0);
  const splitOpenRef = useRef(false);
  const proposalIdAtSplitOpenRef = useRef<string | null>(null);

  const loadSplitBill = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    const fetchGen = ++splitFetchGenRef.current;
    const table = linkedTableNumber.trim();
    if (!storeSlug || !table) {
      if (fetchGen !== splitFetchGenRef.current) return;
      setSplitData(null);
      setSplitError(t("actions.splitNoTable"));
      setProposalBanner(null);
      return;
    }
    if (!guestDeviceId || !guestSeat?.seatId) {
      if (fetchGen !== splitFetchGenRef.current) return;
      setSplitData(null);
      setSplitError(t("actions.payMyShareMissing"));
      setProposalBanner(null);
      return;
    }
    if (!silent) {
      setSplitLoading(true);
      setSplitError(null);
    }
    try {
      const params = new URLSearchParams({
        storeSlug,
        tableNumber: table,
        deviceId: guestDeviceId,
        seatId: guestSeat.seatId,
      });
      const response = await fetch(`/api/public/table-bill?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        data?: SplitBillData;
        error?: { message?: string };
      } | null;
      if (fetchGen !== splitFetchGenRef.current) return;
      if (!response.ok || payload?.ok === false || !payload?.data) {
        if (!silent) {
          setSplitData(null);
          setProposalBanner(null);
          setSplitError(
            toUserFacingErrorMessage(
              payload?.error?.message?.trim() ||
                (response.status === 403
                  ? t("actions.splitForbidden")
                  : response.status === 404
                    ? t("actions.splitEmpty")
                    : t("actions.requestFailed")),
              t("actions.requestFailed"),
            ),
          );
        }
        return;
      }
      setSplitData(payload.data);

      const proposal = payload.data.proposal ?? null;
      const sessionKey = payload.data.sessionId ?? `${storeSlug}:${table}`;
      if (proposal && readDismissedProposalId(sessionKey) !== proposal.id) {
        setProposalBanner(proposal);
        // A new confirm from another seat: close Split so the banner is visible.
        if (
          proposal.fromSeatId !== guestSeat.seatId &&
          splitOpenRef.current &&
          proposal.id !== proposalIdAtSplitOpenRef.current
        ) {
          setSplitOpen(false);
          setSplitInitialMode(null);
          setTrayOpen(false);
        }
      } else if (!proposal) {
        setProposalBanner(null);
      }
    } catch {
      if (fetchGen !== splitFetchGenRef.current) return;
      if (!silent) {
        setSplitData(null);
        setProposalBanner(null);
        setSplitError(t("actions.requestFailed"));
      }
    } finally {
      if (fetchGen === splitFetchGenRef.current && !silent) setSplitLoading(false);
    }
  }, [guestDeviceId, guestSeat?.seatId, linkedTableNumber, storeSlug, t]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (trayOpen) {
      const timeout = setTimeout(() => firstActionRef.current?.focus(), 120);
      return () => clearTimeout(timeout);
    }
  }, [trayOpen]);

  useEffect(() => {
    setTrayOpen(false);
  }, [orderType]);

  useEffect(() => {
    if (!trayOpen) return;
    void loadSplitBill({ silent: true });
    // Prefetch once when the table drawer opens - not when loadSplitBill identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [trayOpen]);

  useEffect(() => {
    splitOpenRef.current = splitOpen;
    if (splitOpen) {
      proposalIdAtSplitOpenRef.current = proposalBanner?.id ?? splitData?.proposal?.id ?? null;
    }
    // Snapshot the proposal that was already on screen when Split opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [splitOpen]);

  useEffect(() => {
    if (!splitOpen) return;
    void loadSplitBill();
    // Only reload when the dialog opens - not when loadSplitBill identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [splitOpen]);

  // Live-refresh claims / extra payers only while Split bill is open.
  // Do not poll on the menu - a seated table with no open check 404s every tick.
  useEffect(() => {
    if (!splitOpen) return;
    if (orderType !== "dine-in") return;
    if (!linkedTableNumber.trim() || !guestDeviceId || !guestSeat?.seatId) return;
    const id = window.setInterval(() => {
      void loadSplitBill({ silent: true });
    }, 2000);
    return () => window.clearInterval(id);
  }, [
    splitOpen,
    orderType,
    linkedTableNumber,
    guestDeviceId,
    guestSeat?.seatId,
    loadSplitBill,
  ]);

  const handleTouchEnd = (touchY: number) => {
    if (!showServiceTray) return;
    if (touchStartY === null) return;
    const diff = touchStartY - touchY;
    if (diff > 50) setTrayOpen(true);
    if (diff < -50) setTrayOpen(false);
    setTouchStartY(null);
  };

  const ActionRow = ({
    icon,
    title,
    subtitle,
    onClick,
    destructive,
    buttonRef,
    ariaLabel,
    className,
  }: {
    icon: ReactNode;
    title: string;
    subtitle: string;
    onClick: () => void;
    destructive?: boolean;
    buttonRef?: RefObject<HTMLButtonElement | null>;
    ariaLabel?: string;
    className?: string;
  }) => (
    <button
      ref={buttonRef}
      type="button"
      className={`w-full min-h-14 rounded-xl px-3 py-3 text-start transition-colors ${
        className ?? (destructive ? "hover:bg-rose-500/10" : "hover:bg-emerald-500/10")
      }`}
      onClick={onClick}
      aria-label={ariaLabel ?? title}
    >
      <div className="flex w-full items-start gap-3">
        <span className={`mt-0.5 shrink-0 ${destructive ? "text-rose-500" : "text-muted-foreground"}`}>{icon}</span>
        <div className="min-w-0 flex-1 text-start">
          <p className={`text-sm font-semibold ${destructive ? "text-rose-500" : "text-foreground"}`}>{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </button>
  );

  const TablePicker = () => {
    if (linkedTableNumber) {
      return (
        <p className="rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-sm text-foreground">
          {t("actions.tableForRequest", { number: linkedTableNumber })}
        </p>
      );
    }

    return (
      <p className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
        {t("actions.scanTableQrToContinue")}
      </p>
    );
  };

  if (!mounted) return null;

  const portalTarget = document.body;
  const showTray = showServiceTray && trayOpen;
  const showBottomBar = showServiceTray || cartCount > 0 || Boolean(activeOrderPath);
  const serviceConfirmOverlayClass = "z-[var(--z-modal-backdrop)]";
  const serviceConfirmContentClass =
    "bottom-[calc(var(--guest-tab-bar-height,0rem)+8.5rem)] top-auto z-[var(--z-modal-content)] max-w-[calc(100%-1rem)] translate-x-[-50%] translate-y-0 rounded-2xl border-border bg-card p-5 text-foreground shadow-2xl data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4 data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 sm:max-w-md";

  const proposalFromName =
    proposalBanner && splitData
      ? splitData.seats.find((seat) => seat.seatId === proposalBanner.fromSeatId)
          ?.guestName?.trim() || null
      : null;
  const proposalYouOwe =
    proposalBanner && guestSeat?.seatId
      ? proposalBanner.amounts.find((row) => row.seatId === guestSeat.seatId)?.amount ?? null
      : null;
  const proposalSessionKey =
    splitData?.sessionId ??
    `${storeSlug}:${linkedTableNumber.trim()}`;

  return createPortal(
    <>
      {proposalBanner && !splitOpen ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[var(--z-modal-content)] flex justify-center px-3"
          dir={dir}
          lang={locale}
        >
          <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-emerald-600/40 bg-card/95 p-3 text-start shadow-2xl backdrop-blur-xl md:max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
              {proposalFromName
                ? t("actions.splitProposalFromName", { name: proposalFromName })
                : t("actions.splitProposalTitle", {
                    number: proposalBanner.fromSeatNumber ?? "?",
                  })}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {proposalYouOwe != null
                ? t("actions.splitProposalYouOwe", {
                    amount: formatMoney(proposalYouOwe),
                  })
                : t("actions.splitSendToTable")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="h-8 bg-emerald-600 text-white hover:bg-emerald-500"
                onClick={() => {
                  const mode = proposalBanner.mode;
                  setSplitInitialMode(
                    mode === "one-bill" ||
                      mode === "by-seat" ||
                      mode === "equal" ||
                      mode === "item"
                      ? mode
                      : "by-seat",
                  );
                  setSplitOpen(true);
                  setTrayOpen(false);
                }}
              >
                {t("actions.splitProposalOpen")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 border-border text-foreground"
                onClick={() => {
                  writeDismissedProposalId(proposalSessionKey, proposalBanner.id);
                  setProposalBanner(null);
                }}
              >
                {t("actions.splitProposalGotIt")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showTray ? (
        <button
          type="button"
          className="fixed inset-0 z-[49] bg-black/35"
          onClick={() => setTrayOpen(false)}
          aria-label={t("actions.closeTray")}
        />
      ) : null}

      {showBottomBar ? (
      <div
        className="pointer-events-none fixed inset-x-0 z-[var(--z-bottom-bar)]"
        dir={dir}
        lang={locale}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: "var(--guest-tab-bar-height, 0rem)",
        }}
      >
        <div
          className="pointer-events-auto mx-auto w-full max-w-lg px-2 md:max-w-xl md:px-3"
          style={{ paddingBottom: "var(--guest-bottom-bar-safe-pad)" }}
        >
          <div
            className={`smart-bottom-bar liquid-glass rounded-t-2xl border-t backdrop-blur-xl ${
              showTray
                ? "border-border/90 bg-card/95 shadow-2xl shadow-black/45"
                : "border-border/70 bg-card/85 shadow-lg shadow-black/30"
            }`}
          >
            {showTray ? (
              <div
                className="animate-in slide-in-from-bottom-6 fade-in-0 max-h-[360px] overflow-y-auto px-2 pb-2 pt-2 duration-300"
                dir={dir}
              >
                <ActionRow
                  buttonRef={firstActionRef}
                  icon={<Bell className="h-4 w-4" />}
                  title={waiterCooldownSeconds > 0 ? t("actions.waiterCalled") : t("actions.callWaiter")}
                  subtitle={
                    waiterCooldownSeconds > 0
                      ? t("actions.waiterCalledAgo", { seconds: 60 - waiterCooldownSeconds })
                      : t("actions.tapToNotify")
                  }
                  ariaLabel={
                    waiterCooldownSeconds > 0
                      ? `Waiter already called, ${60 - waiterCooldownSeconds} seconds ago`
                      : "Call waiter"
                  }
                  onClick={() => {
                    if (waiterCooldownSeconds > 0) {
                      void onCallWaiter();
                      return;
                    }
                    setCallWaiterResult(null);
                    setTrayOpen(false);
                    setCallWaiterOpen(true);
                  }}
                />
                <Separator className="bg-border/70" />

                <ActionRow
                  icon={<CreditCard className="h-4 w-4" />}
                  title={checkRequested ? t("actions.checkRequested") : t("actions.requestCheck")}
                  subtitle={
                    checkRequested
                      ? t("actions.serverNotified")
                      : t("actions.askForBill")
                  }
                  ariaLabel={checkRequested ? "Check already requested" : "Request check"}
                  className={checkRequested ? "border-amber-400/35 bg-amber-500/10 text-amber-100" : undefined}
                  onClick={() => {
                    if (checkRequested) return;
                    setRequestCheckResult(null);
                    setTrayOpen(false);
                    setRequestCheckOpen(true);
                  }}
                />
                <Separator className="bg-border/70" />

                <ActionRow
                  icon={<Users className="h-4 w-4" />}
                  title={t("actions.splitBill")}
                  subtitle={t("actions.splitSubtitle")}
                  onClick={() => setSplitOpen(true)}
                />
              </div>
            ) : null}

            {showServiceTray ? (
              <button
                ref={handleRef}
                type="button"
                role="button"
                aria-label={t("actions.swipeUp")}
                className="smart-bottom-bar-grip flex h-8 w-full items-center justify-center"
                onClick={() => setTrayOpen((prev) => !prev)}
                onTouchStart={(event) => setTouchStartY(event.touches[0].clientY)}
                onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0].clientY)}
              >
                <GripHorizontal className="h-5 w-5 text-muted-foreground" />
              </button>
            ) : null}

            <div className="px-2 pb-1.5 pt-1 md:px-3">
              {cartCount > 0 ? (
                <button
                  type="button"
                  role="button"
                  aria-label={`${cartCtaLabel}, ${formatMoney(total)}`}
                  className="sheen-overlay relative flex min-h-[52px] w-full items-center justify-between rounded-xl border border-white/26 bg-black/78 px-4 py-3 text-white backdrop-blur-2xl shadow-[0_14px_30px_rgba(0,0,0,0.42)] ring-1 ring-white/10 transition-transform duration-200 hover:bg-black/84 active:scale-[0.99] dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:backdrop-blur-xl dark:hover:bg-blue-900/70 vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:backdrop-blur-xl vivid:hover:bg-white/84"
                  onClick={onViewCart}
                >
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    <span className="text-sm font-semibold">{cartCtaLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold">{formatMoney(total)}</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </button>
              ) : activeOrderPath ? (
                <Link
                  href={activeOrderPath}
                  aria-label={`Track your order${activeOrderNumber ? ` #${activeOrderNumber}` : ""}`}
                  className="sheen-overlay relative flex min-h-[52px] w-full items-center justify-between rounded-xl border border-white/26 bg-black/78 px-4 py-3 text-white backdrop-blur-2xl shadow-[0_14px_30px_rgba(0,0,0,0.42)] ring-1 ring-white/10 transition-transform duration-200 hover:bg-black/84 active:scale-[0.99] dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:backdrop-blur-xl dark:hover:bg-blue-900/70 vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:backdrop-blur-xl vivid:hover:bg-white/84"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <ClipboardList className="h-4 w-4 shrink-0" />
                    <span className="truncate text-sm font-semibold">
                      {t("actions.trackOrder")}
                      {activeOrderNumber ? ` #${activeOrderNumber}` : ""}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>
              ) : showServiceTray ? (
                <p className="pb-1 text-center text-[11px] text-muted-foreground">
                  {t("actions.needWaiter")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      ) : null}

      <Dialog
        open={callWaiterOpen}
        onOpenChange={(open) => {
          setCallWaiterOpen(open);
          if (!open) setCallWaiterResult(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          overlayClassName={serviceConfirmOverlayClass}
          className={serviceConfirmContentClass}
        >
          <DialogHeader>
            <DialogTitle>{t("actions.callWaiterTitle")}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("actions.callWaiterDesc")}
            </DialogDescription>
          </DialogHeader>
          <TablePicker />
          {callWaiterResult ? (
            <p
              className={`rounded-xl border px-3 py-2 text-sm ${
                callWaiterResult.ok
                  ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100"
                  : "border-amber-400/35 bg-amber-500/10 text-amber-100"
              }`}
            >
              {callWaiterResult.message}
            </p>
          ) : null}
          <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setCallWaiterOpen(false)}
            >
              {callWaiterResult?.ok ? t("common.close") : t("common.cancel")}
            </Button>
            {!callWaiterResult?.ok ? (
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-500"
                disabled={callWaiterPending || !effectiveTableNumber}
                onClick={async () => {
                  if (!effectiveTableNumber) {
                    setCallWaiterResult({
                      ok: false,
                      message: t("actions.scanTableQrToContinue"),
                    });
                    return;
                  }
                  setCallWaiterPending(true);
                  try {
                    const raw = await onCallWaiter({ tableNumber: effectiveTableNumber });
                    const result = normalizeServiceResult(
                      raw,
                      t("actions.waiterCalled"),
                    );
                    setCallWaiterResult(result);
                    if (result.ok) {
                      window.setTimeout(() => {
                        setCallWaiterOpen(false);
                        setTrayOpen(false);
                        setCallWaiterResult(null);
                      }, 900);
                    }
                  } catch {
                    setCallWaiterResult({
                      ok: false,
                      message: t("actions.requestFailed"),
                    });
                  } finally {
                    setCallWaiterPending(false);
                  }
                }}
              >
                {callWaiterPending ? t("common.sending") : t("common.confirm")}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={requestCheckOpen}
        onOpenChange={(open) => {
          setRequestCheckOpen(open);
          if (!open) setRequestCheckResult(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          overlayClassName={serviceConfirmOverlayClass}
          className={serviceConfirmContentClass}
        >
          <DialogHeader>
            <DialogTitle>{t("actions.requestCheckTitle")}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("actions.requestCheckDesc")}
            </DialogDescription>
          </DialogHeader>
          <TablePicker />
          {requestCheckResult ? (
            <p
              className={`rounded-xl border px-3 py-2 text-sm ${
                requestCheckResult.ok
                  ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100"
                  : "border-amber-400/35 bg-amber-500/10 text-amber-100"
              }`}
            >
              {requestCheckResult.message}
            </p>
          ) : null}
          <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setRequestCheckOpen(false)}
            >
              {requestCheckResult?.ok ? t("common.close") : t("common.cancel")}
            </Button>
            {!requestCheckResult?.ok ? (
              <Button
                className="bg-amber-500 text-black hover:bg-amber-400"
                disabled={requestCheckPending || !effectiveTableNumber}
                onClick={async () => {
                  if (!effectiveTableNumber) {
                    setRequestCheckResult({
                      ok: false,
                      message: t("actions.scanTableQrToContinue"),
                    });
                    return;
                  }
                  setRequestCheckPending(true);
                  try {
                    const raw = await onRequestCheck({ tableNumber: effectiveTableNumber });
                    const result = normalizeServiceResult(
                      raw,
                      t("actions.checkRequested"),
                    );
                    setRequestCheckResult(result);
                    if (result.ok) {
                      window.setTimeout(() => {
                        setRequestCheckOpen(false);
                        setTrayOpen(false);
                        setRequestCheckResult(null);
                      }, 900);
                    }
                  } catch {
                    setRequestCheckResult({
                      ok: false,
                      message: t("actions.requestFailed"),
                    });
                  } finally {
                    setRequestCheckPending(false);
                  }
                }}
              >
                {requestCheckPending ? t("common.sending") : t("common.confirm")}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GuestBillSplitDialog
        open={splitOpen}
        onOpenChange={(nextOpen) => {
          setSplitOpen(nextOpen);
          if (!nextOpen) setSplitInitialMode(null);
        }}
        overlayClassName={serviceConfirmOverlayClass}
        tableNumber={linkedTableNumber}
        storeSlug={storeSlug}
        deviceId={guestDeviceId}
        splitLoading={splitLoading}
        splitError={splitError}
        splitData={splitData}
        initialMode={splitInitialMode}
        onRefresh={(options) => void loadSplitBill({ silent: options?.silent ?? false })}
        onToast={onToast}
      />
    </>,
    portalTarget
  );
}
