import type { GuestLocale } from "./types";

export const GUEST_LOCALE_STORAGE_KEY = "guest-locale";

/** Legacy key used by the old EN/NL toggle. */
const LEGACY_LOCALE_STORAGE_KEY = "locale";

export function isGuestLocale(value: unknown): value is GuestLocale {
  return value === "en" || value === "ar";
}

function scopedLocaleKey(storeSlug: string): string {
  return `${GUEST_LOCALE_STORAGE_KEY}:${storeSlug.trim()}`;
}

/**
 * Read guest language preference.
 * When `storeSlug` is set, only a per-store choice counts (so the merchant
 * default language can apply for first visits to that menu).
 */
export function readStoredGuestLocale(storeSlug?: string | null): GuestLocale | null {
  if (typeof window === "undefined") return null;

  const slug = storeSlug?.trim();
  if (slug) {
    const scoped = localStorage.getItem(scopedLocaleKey(slug));
    if (isGuestLocale(scoped)) return scoped;
    return null;
  }

  const next = localStorage.getItem(GUEST_LOCALE_STORAGE_KEY);
  if (isGuestLocale(next)) return next;

  const legacy = localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY);
  if (legacy === "en") return "en";
  // Old NL choice maps to English until we add Dutch UI.
  if (legacy === "nl") return "en";
  return null;
}

export function writeStoredGuestLocale(
  locale: GuestLocale,
  storeSlug?: string | null,
): void {
  if (typeof window === "undefined") return;
  const slug = storeSlug?.trim();
  if (slug) {
    localStorage.setItem(scopedLocaleKey(slug), locale);
  }
  localStorage.setItem(GUEST_LOCALE_STORAGE_KEY, locale);
  localStorage.setItem(LEGACY_LOCALE_STORAGE_KEY, locale);
}
