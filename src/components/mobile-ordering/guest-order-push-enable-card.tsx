"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Share } from "lucide-react";
import { cn } from "@/lib/utils";
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

/**
 * Auto-enables closed-tab order alerts when the browser already allows
 * notifications (typically granted on Place Order). Only shows UI when the
 * guest still needs to act (iOS install, blocked permission, or retry).
 */
export function GuestOrderPushEnableCard({
  storeSlug,
  orderId,
}: GuestOrderPushEnableCardProps) {
  const [supported, setSupported] = useState(false);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [needsManualEnable, setNeedsManualEnable] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
          error instanceof Error ? error.message : "Could not enable alerts",
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
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

        // Place Order may still have the permission dialog open — wait briefly.
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

        // Permission still default/denied — show a one-tap fallback.
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

  // Happy path: alerts are on — no banner needed.
  if (subscribed && !iosNeedsInstall) return null;

  if (iosNeedsInstall) {
    return (
      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-50">
        <p className="font-semibold text-amber-100">Get order alerts</p>
        <p className="mt-0.5 text-xs text-amber-100/75">
          iPhone: Share → Add to Home Screen, open that app, then return here —
          alerts turn on automatically.
        </p>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-50">
          <Share className="h-3.5 w-3.5" />
          Add to Home Screen
        </span>
      </div>
    );
  }

  if (!needsManualEnable) return null;

  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-100">Turn on order alerts</p>
          <p className="mt-0.5 text-xs text-amber-100/75">
            Allow notifications so we can update you when the kitchen accepts,
            your order is ready, or it’s delayed — even if you leave this page.
          </p>
          {errorMessage ? (
            <p className="mt-2 text-xs font-medium text-red-200" role="alert">
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
            "inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-300/50 bg-amber-500 px-3 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50",
          )}
        >
          <Bell className="h-3.5 w-3.5" />
          {busy ? "…" : "Allow alerts"}
        </button>
      </div>
    </div>
  );
}
