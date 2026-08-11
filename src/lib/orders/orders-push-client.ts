"use client";

const SW_PATH = "/sw-orders-push.js?v=6";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isOrdersPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iOS Safari only supports Web Push for Home Screen PWAs (iOS 16.4+). */
export function isIosSafariWithoutStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIOS) return false;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
  return !isStandalone;
}

/** macOS Safari: Add to Dock web apps get reliable cold-start notification opens. */
export function isMacSafariBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isMac = /Macintosh|Mac OS X/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches;
  return isMac && isSafari && !isStandalone;
}

/**
 * Safari ignores clients.openWindow() on plain http://localhost.
 * Notification "Show" will not open the site until you use HTTPS (dev:https or production).
 */
export function isSafariOpenBlockedOnLocalHttp(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua);
  if (!isSafari) return false;
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  return isLocal && window.location.protocol === "http:";
}

export async function registerOrdersPushServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!isOrdersPushSupported()) {
    throw new Error("Push is not supported in this browser");
  }
  // Drop older site-wide workers (scope "/") so WebKit cold-start uses /orders as root.
  const existing = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    existing.map(async (reg) => {
      const script = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";
      if (!script.includes("sw-orders-push")) return;
      const scopePath = (() => {
        try {
          return new URL(reg.scope).pathname;
        } catch {
          return reg.scope;
        }
      })();
      if (scopePath === "/" || scopePath === "") {
        await reg.unregister().catch(() => undefined);
      }
    }),
  );
  // Scope must be /orders: WebKit cold-starts to the SW/PWA scope root and
  // ignores the path passed to clients.openWindow().
  const registration = await navigator.serviceWorker.register(SW_PATH, {
    scope: "/orders",
  });
  // Ensure the worker is active before PushManager.subscribe (Safari is picky).
  if (registration.installing) {
    await new Promise<void>((resolve, reject) => {
      const worker = registration.installing;
      if (!worker) {
        resolve();
        return;
      }
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated" || worker.state === "installed") resolve();
        if (worker.state === "redundant") reject(new Error("Service worker failed to install"));
      });
    });
  }
  await registration.update().catch(() => undefined);
  return registration;
}

export async function getServerPushStatus(locationId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/orders/push/status?locationId=${encodeURIComponent(locationId)}`,
      { cache: "no-store" },
    );
    const payload = await res.json().catch(() => null);
    return res.ok && payload?.ok === true && payload?.data?.subscribed === true;
  } catch {
    return false;
  }
}

export async function subscribeToOrdersPush(locationId: string): Promise<
  | { ok: true }
  | {
      ok: false;
      code: "unsupported" | "denied" | "ios_install" | "config" | "network" | "subscribe";
      message: string;
    }
> {
  if (isIosSafariWithoutStandalone()) {
    return {
      ok: false,
      code: "ios_install",
      message: "On iPhone, add Orders to your Home Screen first, then enable alerts.",
    };
  }
  if (!isOrdersPushSupported()) {
    return {
      ok: false,
      code: "unsupported",
      message: "This browser does not support closed-tab push alerts.",
    };
  }

  let permission = Notification.permission;
  if (permission !== "granted") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    return {
      ok: false,
      code: "denied",
      message: "Notification permission was blocked in Safari settings.",
    };
  }

  const vapidRes = await fetch("/api/orders/push/vapid", { cache: "no-store" });
  const vapidPayload = await vapidRes.json().catch(() => null);
  const publicKey =
    vapidRes.ok &&
    vapidPayload?.ok === true &&
    typeof vapidPayload?.data?.publicKey === "string"
      ? vapidPayload.data.publicKey
      : null;
  if (!publicKey) {
    return {
      ok: false,
      code: "config",
      message: "Push alerts are not configured on the server yet (missing VAPID keys).",
    };
  }

  let registration: ServiceWorkerRegistration;
  try {
    registration = await registerOrdersPushServiceWorker();
  } catch (error) {
    return {
      ok: false,
      code: "subscribe",
      message:
        error instanceof Error
          ? `Service worker failed: ${error.message}`
          : "Service worker failed to register",
    };
  }

  // Always recreate the browser subscription so keys match the current VAPID pair.
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    try {
      await existing.unsubscribe();
    } catch {
      // continue and try a fresh subscribe
    }
  }

  let subscription: PushSubscription;
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  } catch (error) {
    return {
      ok: false,
      code: "subscribe",
      message:
        error instanceof Error
          ? `Browser push subscribe failed: ${error.message}`
          : "Browser push subscribe failed",
    };
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return {
      ok: false,
      code: "subscribe",
      message: "Browser returned an incomplete push subscription.",
    };
  }

  const res = await fetch("/api/orders/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locationId,
      subscription: json,
    }),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || payload?.ok !== true) {
    return {
      ok: false,
      code: "network",
      message:
        (payload?.error &&
          typeof payload.error === "object" &&
          typeof payload.error.message === "string" &&
          payload.error.message) ||
        `Failed to save push subscription (${res.status})`,
    };
  }
  return { ok: true };
}

export async function unsubscribeFromOrdersPush(locationId: string): Promise<boolean> {
  if (!isOrdersPushSupported()) return false;
  try {
    const registration = await registerOrdersPushServiceWorker().catch(() => null);
    const subscription = registration
      ? await registration.pushManager.getSubscription()
      : null;
    if (subscription) {
      await fetch("/api/orders/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    } else {
      await fetch("/api/orders/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function sendOrdersPushTest(locationId: string): Promise<
  | { ok: true }
  | { ok: false; message: string }
> {
  const res = await fetch("/api/orders/push/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locationId }),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || payload?.ok !== true) {
    return {
      ok: false,
      message:
        (payload?.error &&
          typeof payload.error === "object" &&
          typeof payload.error.message === "string" &&
          payload.error.message) ||
        "Test push failed",
    };
  }
  return { ok: true };
}
