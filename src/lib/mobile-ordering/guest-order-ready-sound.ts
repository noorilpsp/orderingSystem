/**
 * Guest order-ready alert for /menu/.../order-confirmation.
 *
 * Unlock during Place Order (user gesture). Reuse one shared Audio element so
 * playback can start later without another tap (Safari/Chrome autoplay policy).
 */

const UNLOCK_STORAGE_KEY = "guest-order-ready-audio-unlocked";
const READY_SRC = "/sounds/guest-order-ready.wav";

let sharedAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;

function getSharedAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (sharedAudio) return sharedAudio;
  const audio = new Audio(READY_SRC);
  audio.preload = "auto";
  audio.loop = false;
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
}

export function isGuestOrderReadyAudioUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  if (audioUnlocked) return true;
  try {
    return window.sessionStorage.getItem(UNLOCK_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Call from Place Order click so ready alert can autoplay later. */
export async function unlockGuestOrderReadyAudio(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const audio = getSharedAudio();
  if (!audio) return false;

  // Always touch the shared element during the user gesture — don't trust
  // sessionStorage alone (a new Audio() would still be blocked).
  try {
    audio.loop = false;
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
    if (isGuestOrderReadyAudioUnlocked()) {
      markUnlocked();
      return true;
    }
    return false;
  }
}

export type GuestOrderReadyPlayer = {
  start: () => Promise<boolean>;
  stop: () => void;
  isPlaying: () => boolean;
};

/** One player per confirmation page — stop is reliable across ready → served. */
export function createGuestOrderReadyPlayer(): GuestOrderReadyPlayer {
  let generation = 0;

  const stop = () => {
    generation += 1;
    const audio = sharedAudio;
    if (!audio) return;
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      // ignore
    }
  };

  const start = async (): Promise<boolean> => {
    const el = getSharedAudio();
    if (!el) return false;
    const requestId = ++generation;
    try {
      el.loop = true;
      el.muted = false;
      el.volume = 1;
      try {
        el.currentTime = 0;
      } catch {
        // ignore
      }
      const playPromise = el.play();
      if (playPromise) await playPromise;
      if (requestId !== generation) {
        el.pause();
        return false;
      }
      markUnlocked();
      return true;
    } catch {
      return false;
    }
  };

  return {
    start,
    stop,
    isPlaying: () => Boolean(sharedAudio && !sharedAudio.paused),
  };
}
