"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Bell,
  ClipboardList,
  CreditCard,
  Droplets,
  FileText,
  GripHorizontal,
  Minus,
  Plus,
  ShoppingCart,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { useGuestT } from "@/lib/guest-i18n";

type OrderType = "dine-in" | "pickup";
type ToastType = "success" | "warning";

interface SmartBottomBarProps {
  orderType: OrderType;
  cartCount: number;
  total: number;
  waiterCooldownSeconds: number;
  checkRequested: boolean;
  onCallWaiter: () => void;
  onRequestCheck: () => void | Promise<void>;
  onViewCart: () => void;
  onToast: (message: string, type?: ToastType) => void;
  activeOrderPath?: string | null;
  activeOrderNumber?: string | null;
}

function formatEuro(value: number) {
  return `€${value.toFixed(2)}`;
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
  const [mounted, setMounted] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [requestCheckOpen, setRequestCheckOpen] = useState(false);
  const [requestCheckPending, setRequestCheckPending] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const [specialOpen, setSpecialOpen] = useState(false);
  const [specialRequest, setSpecialRequest] = useState("");
  const [waterOpen, setWaterOpen] = useState(false);

  const handleRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  const perPerson = useMemo(() => {
    if (splitCount <= 0) return 0;
    return total / splitCount;
  }, [splitCount, total]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (trayOpen) {
      const timeout = setTimeout(() => firstActionRef.current?.focus(), 120);
      return () => clearTimeout(timeout);
    }
    if (orderType === "dine-in") {
      handleRef.current?.focus();
    }
  }, [trayOpen, orderType]);

  useEffect(() => {
    if (!trayOpen) {
      setSpecialOpen(false);
      setWaterOpen(false);
    }
  }, [trayOpen]);

  useEffect(() => {
    if (orderType !== "dine-in") {
      setTrayOpen(false);
      setSpecialOpen(false);
      setWaterOpen(false);
    }
  }, [orderType]);

  const handleTouchEnd = (touchY: number) => {
    if (orderType !== "dine-in") return;
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
      className={`w-full min-h-14 rounded-xl px-3 py-3 text-left transition-colors ${
        className ?? (destructive ? "hover:bg-rose-500/10" : "hover:bg-emerald-500/10")
      }`}
      onClick={onClick}
      aria-label={ariaLabel ?? title}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 ${destructive ? "text-rose-500" : "text-muted-foreground"}`}>{icon}</span>
        <div>
          <p className={`text-sm font-semibold ${destructive ? "text-rose-500" : "text-foreground"}`}>{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </button>
  );

  if (!mounted) return null;

  const portalTarget = document.body;
  const isDineIn = orderType === "dine-in";
  const showTray = isDineIn && trayOpen;
  const showBottomBar = cartCount > 0 || Boolean(activeOrderPath) || isDineIn;

  return createPortal(
    <>
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
              <div className="animate-in slide-in-from-bottom-6 fade-in-0 max-h-[360px] overflow-y-auto px-2 pb-2 pt-2 duration-300">
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
                    onCallWaiter();
                    setTrayOpen(false);
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
                <Separator className="bg-border/70" />

                <div>
                  <ActionRow
                    icon={<Droplets className="h-4 w-4" />}
                    title={t("actions.orderWater")}
                    subtitle={t("actions.orderWaterSubtitle")}
                    onClick={() => setWaterOpen((prev) => !prev)}
                  />
                  {waterOpen && (
                    <div className="animate-in slide-in-from-bottom-2 fade-in-0 mb-2 flex gap-2 px-3">
                      {[
                        { id: "still", label: t("actions.still"), icon: "💧" },
                        { id: "sparkling", label: t("actions.sparkling"), icon: "✨" },
                        { id: "tap", label: t("actions.tap"), icon: "🚰" },
                      ].map((option) => (
                        <Button
                          key={option.id}
                          type="button"
                          className="h-9 rounded-full border border-border bg-card text-foreground hover:bg-primary hover:text-primary-foreground"
                          onClick={() => {
                            onToast(t("actions.waterOnWay", { type: option.label }));
                            setWaterOpen(false);
                            setTrayOpen(false);
                          }}
                        >
                          <span>{option.icon}</span>
                          <span>{option.label}</span>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                <Separator className="bg-border/70" />

                <div>
                  <ActionRow
                    icon={<FileText className="h-4 w-4" />}
                    title={t("actions.specialRequest")}
                    subtitle={t("actions.specialRequestSubtitle")}
                    onClick={() => setSpecialOpen((prev) => !prev)}
                  />
                  {specialOpen && (
                    <div className="animate-in slide-in-from-bottom-2 fade-in-0 space-y-2 px-3 pb-2">
                      <Textarea
                        value={specialRequest}
                        onChange={(event) => setSpecialRequest(event.target.value)}
                        maxLength={150}
                        placeholder={t("actions.specialRequestPlaceholder")}
                        className="min-h-20 border-input bg-background text-foreground"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{specialRequest.length}/150</span>
                        <Button
                          type="button"
                          className="sheen-overlay relative h-9 border border-white/26 bg-black/78 text-white backdrop-blur-2xl shadow-[0_10px_24px_rgba(0,0,0,0.4)] ring-1 ring-white/10 hover:bg-black/84 dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:backdrop-blur-xl dark:hover:bg-blue-900/70 vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:backdrop-blur-xl vivid:hover:bg-white/84"
                          onClick={() => {
                            if (!specialRequest.trim()) return;
                            onToast(t("actions.requestSent"));
                            setSpecialRequest("");
                            setSpecialOpen(false);
                            setTrayOpen(false);
                          }}
                        >
                          {t("actions.send")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <Separator className="my-2 h-px bg-border/80" />
              </div>
            ) : null}

            {isDineIn ? (
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
                  aria-label={`View cart, ${cartCount} items, ${formatEuro(total)}`}
                  className="sheen-overlay relative flex min-h-[52px] w-full items-center justify-between rounded-xl border border-white/26 bg-black/78 px-4 py-3 text-white backdrop-blur-2xl shadow-[0_14px_30px_rgba(0,0,0,0.42)] ring-1 ring-white/10 transition-transform duration-200 hover:bg-black/84 active:scale-[0.99] dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:backdrop-blur-xl dark:hover:bg-blue-900/70 vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:backdrop-blur-xl vivid:hover:bg-white/84"
                  onClick={onViewCart}
                >
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    <span className="text-sm font-semibold">{t("actions.viewCartCount", { count: cartCount })}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold">{formatEuro(total)}</span>
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
              ) : orderType === "dine-in" ? (
                <button
                  type="button"
                  className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
                  onClick={onCallWaiter}
                >
                  <Bell className="bell-wobble h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  <span className="text-sm">{t("actions.needWaiter")}</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      ) : null}

      <Dialog open={requestCheckOpen} onOpenChange={setRequestCheckOpen}>
        <DialogContent
          showCloseButton={false}
          className="bottom-0 top-auto max-w-[calc(100%-1rem)] translate-x-[-50%] translate-y-0 rounded-t-2xl border-border bg-card text-foreground"
        >
          <DialogHeader>
            <DialogTitle>{t("actions.requestCheckTitle")}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("actions.requestCheckDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" className="text-muted-foreground" onClick={() => setRequestCheckOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              className="bg-amber-500 text-black hover:bg-amber-400"
              disabled={requestCheckPending}
              onClick={async () => {
                setRequestCheckPending(true);
                try {
                  await onRequestCheck();
                  setRequestCheckOpen(false);
                  setTrayOpen(false);
                } finally {
                  setRequestCheckPending(false);
                }
              }}
            >
              {requestCheckPending ? t("common.sending") : t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={splitOpen} onOpenChange={setSplitOpen}>
        <DialogContent
          showCloseButton={false}
          className="bottom-0 top-auto max-w-[calc(100%-1rem)] translate-x-[-50%] translate-y-0 rounded-t-2xl border-border bg-card text-foreground"
        >
          <DialogHeader>
            <DialogTitle>{t("actions.splitBillTitle")}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("actions.splitBillDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border bg-background/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{t("actions.splitEqually")}</p>
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">{t("common.available")}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-2">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => setSplitCount((prev) => Math.max(2, prev - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold">{t("actions.peopleCount", { count: splitCount })}</span>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => setSplitCount((prev) => Math.min(8, prev + 1))}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t("actions.perPerson", { amount: formatEuro(perPerson) })}</p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-border bg-background/50 px-3 py-2 text-left"
              onClick={() => onToast(t("actions.splitByItems"), "warning")}
            >
              <span className="text-sm text-muted-foreground">{t("actions.splitByItems")}</span>
              <span className="text-xs text-muted-foreground">{t("common.comingSoon")}</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-border bg-background/50 px-3 py-2 text-left"
              onClick={() => onToast(t("actions.payMyShare"), "warning")}
            >
              <span className="text-sm text-muted-foreground">{t("actions.payMyShare")}</span>
              <span className="text-xs text-muted-foreground">{t("common.comingSoon")}</span>
            </button>
          </div>

          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" className="text-muted-foreground" onClick={() => setSplitOpen(false)}>
              {t("common.close")}
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={() => {
                onToast(t("actions.splitEquallyApplied", { count: splitCount }));
                setSplitOpen(false);
                setTrayOpen(false);
              }}
            >
              {t("common.apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>,
    portalTarget
  );
}
