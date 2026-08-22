"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Share } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGuestT } from "@/lib/guest-i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getGuestOrderPushStatus,
  isGuestOrderPushSupported,
  isIosSafariWithoutStandalone,
  subscribeToGuestOrderPush,
} from "@/lib/public-menu/guest-orders-push-client";

type GuestOrderPushEnableCardProps = {
  storeSlug: string;
  orderId: string | null;
};

const cardClassName =
  "rounded-2xl border border-amber-500/40 bg-amber-50 px-3.5 py-3 text-sm text-amber-950 shadow-sm dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-50";

/**
 * Auto-enables closed-tab order alerts when the browser already allows
 * notifications (typically granted on Place Order). Only shows UI when the
 * guest still needs to act (iOS install, blocked permission, or retry).
 */
export function GuestOrderPushEnableCard({
  storeSlug,
  orderId,
}: GuestOrderPushEnableCardProps) {
  const t = useGuestT();
  const [supported, setSupported] = useState(false);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [needsManualEnable, setNeedsManualEnable] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [howToOpen, setHowToOpen] = useState(false);
  const autoTriedRef = useRef<string | null>(null);

  const trySubscribe = useCallback(
    async (slug: string, id: string, opts?: { silent?: boolean }) => {
      setBusy(true);
      setErrorMessage(null);
      try {
        const result = await subscribeToGuestOrderPush({
          storeSlug: slug,
          orderId: id,
          confirmationUrl: window.location.href,
        });
        if (!result.ok) {
          if (result.code === "ios_install") {
            setIosNeedsInstall(true);
            setNeedsManualEnable(false);
            return false;
          }
          if (result.code === "denied") {
            setNeedsManualEnable(true);
            if (!opts?.silent) setErrorMessage(result.message);
            return false;
          }
          setNeedsManualEnable(true);
          setErrorMessage(result.message);
          return false;
        }
        setSubscribed(true);
        setNeedsManualEnable(false);
        setIosNeedsInstall(false);
        return true;
      } catch (error) {
        setNeedsManualEnable(true);
        setErrorMessage(
          error instanceof Error ? error.message : t("confirm.alertsCouldNotEnable"),
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  useEffect(() => {
    setSupported(isGuestOrderPushSupported());
    setIosNeedsInstall(isIosSafariWithoutStandalone());
    if (!orderId || !storeSlug) {
      setReady(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const already = await getGuestOrderPushStatus(storeSlug, orderId);
        if (cancelled) return;
        if (already) {
          setSubscribed(true);
          setNeedsManualEnable(false);
          return;
        }

        if (isIosSafariWithoutStandalone()) {
          setIosNeedsInstall(true);
          return;
        }

        if (!isGuestOrderPushSupported()) return;

        // Place Order may still have the permission dialog open - wait briefly.
        if (Notification.permission === "default") {
          const started = Date.now();
          while (
            Notification.permission === "default" &&
            Date.now() - started < 10_000
          ) {
            await new Promise((resolve) => window.setTimeout(resolve, 400));
            if (cancelled) return;
          }
        }

        // Auto-enable once per order when permission is granted.
        if (
          Notification.permission === "granted" &&
          autoTriedRef.current !== orderId
        ) {
          autoTriedRef.current = orderId;
          const ok = await trySubscribe(storeSlug, orderId, { silent: true });
          if (cancelled) return;
          if (!ok) setNeedsManualEnable(true);
          return;
        }

        // Permission still default/denied - show a one-tap fallback.
        setNeedsManualEnable(true);
      } catch {
        if (!cancelled) setNeedsManualEnable(true);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, storeSlug, trySubscribe]);

  if (!ready || !orderId) return null;
  if (!supported && !iosNeedsInstall) return null;

  // Happy path: alerts are on - no banner needed.
  if (subscribed && !iosNeedsInstall) return null;

  if (iosNeedsInstall) {
    return (
      <>
        <div className={cardClassName}>
          <p className="font-semibold text-amber-950 dark:text-amber-50">
            {t("confirm.alertsTitle")}
          </p>
          <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-100/80">
            {t("confirm.alertsIosHint")}
          </p>
          <button
            type="button"
            onClick={() => setHowToOpen(true)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
          >
            <Share className="h-3.5 w-3.5" />
            {t("confirm.alertsAddToHome")}
          </button>
        </div>
        <Dialog open={howToOpen} onOpenChange={setHowToOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("confirm.alertsHowTitle")}</DialogTitle>
              <DialogDescription>{t("confirm.alertsHowIntro")}</DialogDescription>
            </DialogHeader>
            <ol className="space-y-3 text-sm text-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">
                  1
                </span>
                <span>{t("confirm.alertsStep1")}</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">
                  2
                </span>
                <span>{t("confirm.alertsStep2")}</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">
                  3
                </span>
                <span>{t("confirm.alertsStep3")}</span>
              </li>
            </ol>
            <DialogFooter>
              <Button type="button" onClick={() => setHowToOpen(false)}>
                {t("confirm.gotIt")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (!needsManualEnable) return null;

  return (
    <div className={cardClassName}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-950 dark:text-amber-50">
            {t("confirm.alertsTurnOnTitle")}
          </p>
          <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-100/80">
            {t("confirm.alertsTurnOnHint")}
          </p>
          {errorMessage ? (
            <p className="mt-2 text-xs font-medium text-red-700 dark:text-red-200" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void trySubscribe(storeSlug, orderId);
          }}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full bg-amber-600 px-3 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400",
          )}
        >
          <Bell className="h-3.5 w-3.5" />
          {busy ? "…" : t("confirm.alertsAllow")}
        </button>
      </div>
    </div>
  );
}
