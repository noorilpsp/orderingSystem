const STORAGE_PREFIX = "guest-welcome-seen:";

export function guestWelcomeStorageKey(storeSlug: string): string {
  return `${STORAGE_PREFIX}${storeSlug.trim().toLowerCase()}`;
}

/** True once the guest has tapped Sign in or Continue as guest for this store. */
export function hasSeenGuestWelcome(storeSlug: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(guestWelcomeStorageKey(storeSlug)) === "1";
  } catch {
    return true;
  }
}

export function markGuestWelcomeSeen(storeSlug: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(guestWelcomeStorageKey(storeSlug), "1");
  } catch {
    // ignore quota / private mode
  }
}
