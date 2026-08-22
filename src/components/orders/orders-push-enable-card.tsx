"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Share, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getServerPushStatus,
  isIosSafariWithoutStandalone,
  isMacSafariBrowser,
  isOrdersPushSupported,
  isSafariOpenBlockedOnLocalHttp,
  sendOrdersPushTest,
  subscribeToOrdersPush,
  unsubscribeFromOrdersPush,
} from "@/lib/orders/orders-push-client";

type OrdersPushEnableCardProps = {
  locationId: string | null;
};

export function OrdersPushEnableCard({ locationId }: OrdersPushEnableCardProps) {
  const [supported, setSupported] = useState(false);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);
  const [macNeedsDock, setMacNeedsDock] = useState(false);
  const [safariLocalHttpBlock, setSafariLocalHttpBlock] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const refreshStatus = useCallback(async (locId: string) => {
    const serverSubscribed = await getServerPushStatus(locId);
    setSubscribed(serverSubscribed);
  }, []);

  useEffect(() => {
    setSupported(isOrdersPushSupported());
    setIosNeedsInstall(isIosSafariWithoutStandalone());
    setMacNeedsDock(isMacSafariBrowser());
    setSafariLocalHttpBlock(isSafariOpenBlockedOnLocalHttp());
    if (!locationId) {
      setReady(true);
      return;
    }
    void (async () => {
      try {
        await refreshStatus(locationId);
      } catch {
        setSubscribed(false);
      } finally {
        setReady(true);
      }
    })();
  }, [locationId, refreshStatus]);

  const handleEnable = useCallback(async () => {
    if (!locationId || busy) return;
    setBusy(true);
    try {
      const result = await subscribeToOrdersPush(locationId);
      if (!result.ok) {
        if (result.code === "ios_install") {
          setIosNeedsInstall(true);
        }
        toast.error(result.message);
        return;
      }
      await refreshStatus(locationId);
      toast.success("Closed-tab alerts enabled - try Send test");
    } finally {
      setBusy(false);
    }
  }, [busy, locationId, refreshStatus]);

  const handleDisable = useCallback(async () => {
    if (!locationId || busy) return;
    setBusy(true);
    try {
      await unsubscribeFromOrdersPush(locationId);
      setSubscribed(false);
      toast.success("Closed-tab alerts turned off");
    } finally {
      setBusy(false);
    }
  }, [busy, locationId]);

  const handleTest = useCallback(async () => {
    if (!locationId || busy) return;
    setBusy(true);
    try {
      const result = await sendOrdersPushTest(locationId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (isSafariOpenBlockedOnLocalHttp()) {
        toast.success(
          "Test push sent - Show won’t open on http://localhost in Safari. Use npm run dev:https, then re-enable alerts.",
        );
        return;
      }
      toast.success("Test push sent - check your Notification Center");
    } finally {
      setBusy(false);
    }
  }, [busy, locationId]);

  if (!ready || !locationId) return null;
  if (!supported && !iosNeedsInstall) return null;

  const helpText = safariLocalHttpBlock
    ? "Safari will deliver the alert, but Show cannot open the site on http://localhost. Stop the server, run npm run dev:https, open https://localhost:3000/orders, accept the cert, then Disable → Enable alerts again."
    : iosNeedsInstall
      ? "iPhone: Share → Add to Home Screen, open that app, then enable alerts."
      : macNeedsDock && !subscribed
        ? "Mac: File → Add to Dock, open Orders from the Dock, then enable alerts."
        : macNeedsDock && subscribed
          ? "Quit the Orders Dock app, Send test, then click Show."
          : subscribed
            ? "Close the app/tab and tap Send test to verify it still notifies you."
            : "The sound/banner on reload is different. Tap Enable alerts for push when the app is closed.";

  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-amber-100">
            {safariLocalHttpBlock
              ? "Show won’t open on localhost HTTP"
              : subscribed
                ? "Closed-tab alerts on"
                : "Enable closed-tab alerts (required once)"}
          </p>
          <p className="mt-0.5 text-xs text-amber-100/75">{helpText}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {iosNeedsInstall && !subscribed ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-50">
              <Share className="h-3.5 w-3.5" />
              Add to Home Screen
            </span>
          ) : (
            <>
              {subscribed ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void handleTest();
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-300/50 bg-amber-500 px-3 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {busy ? "…" : "Send test"}
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy || !locationId}
                onClick={() => {
                  void (subscribed ? handleDisable() : handleEnable());
                }}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold disabled:opacity-50",
                  subscribed
                    ? "border border-white/20 bg-white/10 text-white hover:bg-white/15"
                    : "border border-amber-300/50 bg-amber-500 text-slate-950 hover:bg-amber-400",
                )}
              >
                {subscribed ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                {busy ? "…" : subscribed ? "Disable" : "Enable alerts"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
