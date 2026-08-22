const STORAGE_PREFIX = "guest-closed-sheet-seen:";

function storageKey(storeSlug: string): string {
  return `${STORAGE_PREFIX}${storeSlug.trim().toLowerCase()}`;
}

/** True after the guest taps Schedule or Browse on the closed landing sheet. */
export function hasSeenGuestClosedSheet(storeSlug: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const key = storageKey(storeSlug);
    if (window.localStorage.getItem(key) === "1") return true;
    if (window.sessionStorage.getItem(key) === "1") {
      window.localStorage.setItem(key, "1");
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

export function markGuestClosedSheetSeen(storeSlug: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(storeSlug), "1");
  } catch {
    // ignore quota / private mode
  }
}
