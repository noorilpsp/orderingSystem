/* eslint-disable no-undef */
/**
 * Staff incoming-order push service worker.
 * Serves closed-tab / background alerts for /orders.
 *
 * Version: 6 — do not preventDefault on Safari Show (it cancels the only open path
 * when openWindow is flaky); openWindow must be the first waitUntil work.
 */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function ordersUrl() {
  try {
    if (self.registration?.scope) {
      return new URL(self.registration.scope).href;
    }
  } catch {
    // fall through
  }
  try {
    return new URL("/orders", self.location.origin).href;
  } catch {
    return "/orders";
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

function isOrdersUrl(clientUrl) {
  try {
    const path = new URL(clientUrl).pathname;
    return path === "/orders" || path.startsWith("/orders/");
  } catch {
    return false;
  }
}

/**
 * Safari macOS "Show" fires notificationclick with an empty action.
 * Keep this path minimal: openWindow first, then retry navigate/focus.
 */
async function focusOrOpenOrders(targetUrl) {
  let opened = null;
  if (self.clients.openWindow) {
    try {
      opened = await self.clients.openWindow(targetUrl);
    } catch {
      opened = null;
    }
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const windows = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    const client =
      opened ||
      windows.find((c) => isOrdersUrl(c.url)) ||
      windows.find((c) => sameOrigin(c.url, targetUrl)) ||
      windows[0] ||
      null;

    if (client) {
      try {
        if ("navigate" in client && !isOrdersUrl(client.url)) {
          await client.navigate(targetUrl);
        }
      } catch {
        // WebKit may throw while the shell is still launching
      }
      try {
        if ("focus" in client) {
          await client.focus();
        }
      } catch {
        // ignore
      }
      if (isOrdersUrl(client.url)) return;
    }

    opened = null;
    await sleep(200 * (attempt + 1));
  }
}

self.addEventListener("push", (event) => {
  let payload = {
    title: "New order",
    body: "A new order is waiting",
    orderId: null,
    orderNumber: null,
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

  const targetUrl = ordersUrl();
  const title = payload.title || "New order";
  const options = {
    body: payload.body || "A new order is waiting",
    // Keep a stable collapse key; URL lives in data (and duplicated below for Safari).
    tag: payload.orderId ? `incoming-order-${payload.orderId}` : "incoming-order",
    renotify: true,
    requireInteraction: true,
    data: {
      url: targetUrl,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  // Do NOT call preventDefault(). On Safari, "Show" relies on the default path
  // when clients.openWindow() is ignored (common on localhost / cold start).
  // preventDefault() + failed openWindow = notification does nothing.

  const targetUrl =
    (event.notification.data && event.notification.data.url) || ordersUrl();

  event.waitUntil(
    (async () => {
      // Close after starting open so we don't lose the user gesture.
      const openPromise = focusOrOpenOrders(targetUrl);
      try {
        event.notification.close();
      } catch {
        // ignore
      }
      await openPromise;
    })(),
  );
});
