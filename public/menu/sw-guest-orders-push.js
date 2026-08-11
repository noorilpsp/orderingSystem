/* eslint-disable no-undef */
/**
 * Guest order-confirmation push service worker.
 * Version: 1
 */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function resolveClientUrl(pathOrUrl) {
  const fallback = "/";
  try {
    const base =
      self.registration?.scope ||
      (self.location && self.location.origin
        ? `${self.location.origin}/`
        : undefined);
    if (!base) return pathOrUrl || fallback;
    return new URL(pathOrUrl || fallback, base).href;
  } catch {
    return pathOrUrl || fallback;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sameOrigin(clientUrl, targetUrl) {
  try {
    return new URL(clientUrl).origin === new URL(targetUrl).origin;
  } catch {
    return false;
  }
}

async function focusOrOpen(targetUrl) {
  let opened = null;
  if (self.clients.openWindow) {
    try {
      opened = await self.clients.openWindow(targetUrl);
    } catch {
      opened = null;
    }
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const windows = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    const client =
      opened ||
      windows.find((c) => sameOrigin(c.url, targetUrl)) ||
      windows[0] ||
      null;

    if (client) {
      try {
        if ("navigate" in client) {
          await client.navigate(targetUrl);
        }
      } catch {
        // ignore
      }
      try {
        if ("focus" in client) {
          await client.focus();
        }
      } catch {
        // ignore
      }
      return;
    }
    opened = null;
    await sleep(200 * (attempt + 1));
  }
}

self.addEventListener("push", (event) => {
  let payload = {
    title: "Order update",
    body: "Your order status changed",
    url: "/",
    orderId: null,
    orderNumber: null,
    eventType: null,
  };

  try {
    if (event.data) {
      const data = event.data.json();
      payload = { ...payload, ...data };
    }
  } catch {
    try {
      const text = event.data?.text();
      if (text) payload.body = text;
    } catch {
      // keep defaults
    }
  }

  const targetUrl = resolveClientUrl(payload.url || "/");
  const title = payload.title || "Order update";
  const options = {
    body: payload.body || "Your order status changed",
    tag: payload.orderId
      ? `guest-order-${payload.orderId}-${payload.eventType || "update"}`
      : "guest-order-update",
    renotify: true,
    requireInteraction: true,
    data: {
      url: targetUrl,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      eventType: payload.eventType,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  const targetUrl = resolveClientUrl(
    (event.notification.data && event.notification.data.url) || "/",
  );

  event.waitUntil(
    (async () => {
      try {
        event.notification.close();
      } catch {
        // ignore
      }
      await focusOrOpen(targetUrl);
    })(),
  );
});
