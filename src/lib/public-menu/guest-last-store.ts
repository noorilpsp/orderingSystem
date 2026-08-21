export const GUEST_LAST_STORE_COOKIE = "guest-last-store";
export const GUEST_LAST_STORE_STORAGE_KEY = "guest-last-store";

/** Store slug from a guest return path such as `/menu/bunnco?mode=pickup`. */
export function storeSlugFromGuestPath(
  path: string | null | undefined,
): string | null {
  const raw = path?.trim() ?? "";
  if (!raw.startsWith("/")) return null;
  const [pathname, query = ""] = raw.split("?");
  const match = pathname.match(/^\/menu\/([^/]+)/i);
  const slugFromPath = match?.[1]?.trim();
  if (slugFromPath) {
    try {
      return decodeURIComponent(slugFromPath).trim().toLowerCase() || null;
    } catch {
      return slugFromPath.toLowerCase() || null;
    }
  }
  const fromQuery = new URLSearchParams(query).get("store")?.trim();
  return fromQuery ? fromQuery.toLowerCase() : null;
}

export function readGuestLastStoreCookieValue(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${GUEST_LAST_STORE_COOKIE}=([^;]*)`),
  );
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]).trim().toLowerCase() || null;
  } catch {
    return match[1].trim().toLowerCase() || null;
  }
}

export function readGuestLastStoreSlug(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = (window.localStorage.getItem(GUEST_LAST_STORE_STORAGE_KEY) ?? "")
      .trim()
      .toLowerCase();
    if (stored) return stored;
  } catch {
    // Ignore private-mode failures.
  }
  const fromCookie = readGuestLastStoreCookieValue(document.cookie);
  if (fromCookie) return fromCookie;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith("guest-cart:")) continue;
      const slug = key.slice("guest-cart:".length).trim().toLowerCase();
      if (slug) return slug;
    }
  } catch {
    // Ignore private-mode failures.
  }
  return null;
}

export function writeGuestLastStore(storeSlug: string): void {
  if (typeof window === "undefined") return;
  const slug = storeSlug.trim().toLowerCase();
  if (!slug) return;
  document.cookie = `${GUEST_LAST_STORE_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=2592000; SameSite=Lax`;
  try {
    window.localStorage.setItem(GUEST_LAST_STORE_STORAGE_KEY, slug);
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function restaurantCountryFromPublicMenuPayload(
  payload: unknown,
): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const data = record.ok === true ? record.data : payload;
  if (!data || typeof data !== "object") return null;
  const restaurant = (data as { restaurant?: { country?: string | null } }).restaurant;
  const country = restaurant?.country?.trim();
  return country || null;
}
