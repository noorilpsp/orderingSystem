/**
 * Incoming-order alert sound for /orders.
 *
 * Unlock during staff login / ops navigation gestures. Reuse one shared Audio
 * element so later alerts can autoplay. If HTML audio is blocked on a cold
 * /orders load, fall back to an OS notification sound (works when permission
 * was granted earlier - no click required).
 */

type IncomingAlertSoundHandle = {
  unlock: () => Promise<boolean>;
  start: () => Promise<boolean>;
  stop: () => void;
  isPlaying: () => boolean;
};

const UNLOCK_STORAGE_KEY = "orders-incoming-alert-audio-unlocked";
const NOTIFY_PERMISSION_KEY = "orders-incoming-alert-notify-asked";
const ALERT_SRC = "/sounds/incoming-order-alert.wav";

let sharedAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;
let playRequestId = 0;
const unlockedListeners = new Set<() => void>();

function getSharedAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (sharedAudio) return sharedAudio;
  const audio = new Audio(ALERT_SRC);
  audio.preload = "auto";
  audio.loop = true;
  audio.volume = 1;
  sharedAudio = audio;
  return audio;
}

function markUnlocked(): void {
  if (audioUnlocked) return;
  audioUnlocked = true;
  try {
    window.sessionStorage.setItem(UNLOCK_STORAGE_KEY, "1");
  } catch {
    // ignore
  }
  unlockedListeners.forEach((listener) => listener());
}

export function isIncomingAlertAudioUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  if (audioUnlocked) return true;
  try {
    return window.sessionStorage.getItem(UNLOCK_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function subscribeIncomingAlertAudioUnlocked(listener: () => void): () => void {
  unlockedListeners.add(listener);
  return () => {
    unlockedListeners.delete(listener);
  };
}

/** Ask for notification permission during a user gesture (login / nav click). */
export async function ensureIncomingOrderNotificationPermission(): Promise<NotificationPermission | null> {
  if (typeof window === "undefined" || typeof Notification === "undefined") return null;
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    window.sessionStorage.setItem(NOTIFY_PERMISSION_KEY, "1");
  } catch {
    // ignore
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * OS notification fallback when HTML audio can't autoplay.
 * Works without a fresh gesture if permission was already granted.
 */
export function notifyIncomingOrderAlert(input: {
  orderLabel: string;
  guestLabel?: string;
  itemCount?: number;
}): boolean {
  if (typeof window === "undefined" || typeof Notification === "undefined") return false;
  if (Notification.permission !== "granted") return false;

  const bodyParts = [
    input.guestLabel,
    typeof input.itemCount === "number"
      ? `${input.itemCount} ${input.itemCount === 1 ? "item" : "items"}`
      : null,
  ].filter(Boolean);

  try {
    const notification = new Notification(`New order ${input.orderLabel}`, {
      body: bodyParts.length > 0 ? bodyParts.join(" · ") : "Tap to review on Orders",
      tag: "incoming-order-alert",
      requireInteraction: true,
      silent: false,
    });
    notification.onclick = () => {
      try {
        window.focus();
        if (!window.location.pathname.startsWith("/orders")) {
          window.location.assign("/orders");
        }
      } catch {
        // ignore
      }
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}

/** Call from staff login / ops nav click so /orders alerts can autoplay later. */
export async function unlockIncomingOrderAlertAudio(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // Request notification permission in the same gesture for cold-load fallback.
  void ensureIncomingOrderNotificationPermission();

  const audio = getSharedAudio();
  if (!audio) return false;

  try {
    audio.loop = true;
    audio.muted = false;
    audio.volume = 0.001;
    try {
      audio.currentTime = 0;
    } catch {
      // ignore
    }
    const playPromise = audio.play();
    if (playPromise) await playPromise;
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      // ignore
    }
    audio.volume = 1;
    markUnlocked();
    return true;
  } catch {
    if (isIncomingAlertAudioUnlocked()) {
      markUnlocked();
      return true;
    }
    return false;
  }
}

/**
 * Warm the shared element. Silent gesture listeners are a backup if the page
 * was cold-loaded with an existing session (no login / nav tap yet).
 */
export function primeIncomingOrderAlertAudio(): () => void {
  if (typeof window === "undefined") return () => {};

  try {
    if (window.sessionStorage.getItem(UNLOCK_STORAGE_KEY) === "1") {
      audioUnlocked = true;
    }
  } catch {
    // ignore
  }

  getSharedAudio();

  if (audioUnlocked) {
    void unlockIncomingOrderAlertAudio();
  }

  const onGesture = () => {
    void unlockIncomingOrderAlertAudio().then((ok) => {
      if (!ok) return;
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("keydown", onGesture, true);
    });
  };

  window.addEventListener("pointerdown", onGesture, true);
  window.addEventListener("keydown", onGesture, true);

  return () => {
    window.removeEventListener("pointerdown", onGesture, true);
    window.removeEventListener("keydown", onGesture, true);
  };
}

export function createIncomingOrderAlertSound(): IncomingAlertSoundHandle {
  const stop = () => {
    playRequestId += 1;
    const audio = sharedAudio;
    if (!audio) return;
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      // ignore seek errors while loading
    }
  };

  const unlock = async (): Promise<boolean> => unlockIncomingOrderAlertAudio();

  const start = async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    const audio = getSharedAudio();
    if (!audio) return false;

    const requestId = ++playRequestId;
    try {
      audio.loop = true;
      audio.muted = false;
      audio.volume = 1;
      if (audio.paused) {
        try {
          audio.currentTime = 0;
        } catch {
          // ignore
        }
      }
      const playPromise = audio.play();
      if (playPromise) await playPromise;
      if (requestId !== playRequestId) {
        audio.pause();
        return false;
      }
      markUnlocked();
      return true;
    } catch {
      return false;
    }
  };

  return {
    unlock,
    start,
    stop,
    isPlaying: () => Boolean(sharedAudio && !sharedAudio.paused),
  };
}
