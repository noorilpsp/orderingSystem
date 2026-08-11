"use client";

const SW_PATH = "/menu/sw-guest-orders-push.js?v=2";

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

export function isGuestOrderPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

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

export function isSafariOpenBlockedOnLocalHttp(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua);
  if (!isSafari) return false;
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  return isLocal && window.location.protocol === "http:";
}

/**
 * Ask for notification permission during a real user gesture (Place Order).
 * Browsers block permission prompts without a gesture; confirmation can then
 * auto-subscribe silently once permission is granted.
 */
export async function ensureGuestOrderPushPermission(): Promise<NotificationPermission | null> {
  if (!isGuestOrderPushSupported()) return null;
  if (isIosSafariWithoutStandalone()) return Notification.permission;
  try {
    if (Notification.permission === "granted" || Notification.permission === "denied") {
      return Notification.permission;
    }
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function waitForWorkerState(
  worker: ServiceWorker,
  timeoutMs: number,
): Promise<void> {
  if (worker.state === "activated" || worker.state === "installed") {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      worker.removeEventListener("statechange", onChange);
      reject(new Error("Service worker install timed out"));
    }, timeoutMs);
    const onChange = () => {
      if (worker.state === "activated" || worker.state === "installed") {
        window.clearTimeout(timer);
        worker.removeEventListener("statechange", onChange);
        resolve();
      } else if (worker.state === "redundant") {
        window.clearTimeout(timer);
        worker.removeEventListener("statechange", onChange);
        reject(new Error("Service worker failed to install"));
      }
    };
    worker.addEventListener("statechange", onChange);
  });
}

export async function registerGuestOrderPushServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!isGuestOrderPushSupported()) {
    throw new Error("Push is not supported in this browser");
  }
  // SW lives under /menu/ so default scope covers confirmation without header tricks.
  const registration = await navigator.serviceWorker.register(SW_PATH, {
    scope: "/menu/",
  });
  const pending = registration.installing ?? registration.waiting;
  if (pending) {
    await waitForWorkerState(pending, 12_000);
  }
  if (registration.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }
  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error("Service worker ready timed out")),
        12_000,
      );
    }),
  ]);
  await registration.update().catch(() => undefined);
  return registration;
}

export async function getGuestOrderPushStatus(
  storeSlug: string,
  orderId: string,
): Promise<boolean> {
  try {
    const params = new URLSearchParams({ storeSlug, orderId });
    const res = await fetch(`/api/public/orders/push/status?${params.toString()}`, {
      cache: "no-store",
    });
    const payload = await res.json().catch(() => null);
    return res.ok && payload?.ok === true && payload?.data?.subscribed === true;
  } catch {
    return false;
  }
}

export async function subscribeToGuestOrderPush(input: {
  storeSlug: string;
  orderId: string;
  confirmationUrl: string;
}): Promise<
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
      message: "On iPhone, add this menu to your Home Screen first, then enable alerts.",
    };
  }
  if (!isGuestOrderPushSupported()) {
    return {
      ok: false,
      code: "unsupported",
      message: "This browser does not support closed-tab order alerts.",
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
      message: "Notification permission was blocked. Allow notifications for this site in Safari settings.",
    };
  }

  const vapidRes = await fetch("/api/public/orders/push/vapid", { cache: "no-store" });
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
      message: "Push alerts are not configured on the server yet.",
    };
  }

  let registration: ServiceWorkerRegistration;
  try {
    registration = await registerGuestOrderPushServiceWorker();
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

  // Prefer an active worker for PushManager on Safari.
  const readyRegistration = await navigator.serviceWorker.ready.catch(() => registration);
  const pushRegistration = readyRegistration.scope.includes("/menu")
    ? readyRegistration
    : registration;

  const existing = await pushRegistration.pushManager.getSubscription();
  if (existing) {
    try {
      await existing.unsubscribe();
    } catch {
      // continue
    }
  }

  let subscription: PushSubscription;
  try {
    subscription = await pushRegistration.pushManager.subscribe({
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

  const res = await fetch("/api/public/orders/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeSlug: input.storeSlug,
      orderId: input.orderId,
      confirmationUrl: input.confirmationUrl,
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

export async function unsubscribeFromGuestOrderPush(orderId: string): Promise<boolean> {
  if (!isGuestOrderPushSupported()) return false;
  try {
    const registration = await registerGuestOrderPushServiceWorker().catch(() => null);
    const subscription = registration
      ? await registration.pushManager.getSubscription()
      : null;
    await fetch("/api/public/orders/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        endpoint: subscription?.endpoint,
      }),
    });
    if (subscription) {
      await subscription.unsubscribe();
    }
    return true;
  } catch {
    return false;
  }
}
