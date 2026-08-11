import webpush from "web-push";

export type PushSubscriptionJSONLike = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export function getVapidPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

export function configureWebPush(): boolean {
  const publicKey = getVapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:hello@example.com";
  if (!publicKey || !privateKey) return false;
  // Apple Web Push rejects invalid mailto domains (e.g. *.local) with BadJwtToken.
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
