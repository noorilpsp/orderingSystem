import type { GuestLocale } from "./types";

export const GUEST_LOCALE_STORAGE_KEY = "guest-locale";

/** Legacy key used by the old EN/NL toggle. */
const LEGACY_LOCALE_STORAGE_KEY = "locale";

export function isGuestLocale(value: unknown): value is GuestLocale {
  return value === "en" || value === "ar";
}

export function readStoredGuestLocale(): GuestLocale | null {
  if (typeof window === "undefined") return null;
  const next = localStorage.getItem(GUEST_LOCALE_STORAGE_KEY);
  if (isGuestLocale(next)) return next;

  const legacy = localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY);
  if (legacy === "en") return "en";
  // Old NL choice maps to English until we add Dutch UI.
  if (legacy === "nl") return "en";
  return null;
}

export function writeStoredGuestLocale(locale: GuestLocale): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_LOCALE_STORAGE_KEY, locale);
  localStorage.setItem(LEGACY_LOCALE_STORAGE_KEY, locale);
}
