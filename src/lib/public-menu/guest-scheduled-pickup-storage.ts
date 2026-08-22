const STORAGE_PREFIX = "guest-scheduled-pickup:";

function storageKey(storeSlug: string): string {
  return `${STORAGE_PREFIX}${storeSlug.trim().toLowerCase()}`;
}

export function readGuestScheduledPickupAt(storeSlug: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(storeSlug));
    if (!raw) return null;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

export function writeGuestScheduledPickupAt(
  storeSlug: string,
  iso: string | null,
): void {
  if (typeof window === "undefined") return;
  try {
    const key = storageKey(storeSlug);
    if (!iso) {
      window.localStorage.removeItem(key);
      return;
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, date.toISOString());
  } catch {
    // ignore quota / private mode
  }
}
