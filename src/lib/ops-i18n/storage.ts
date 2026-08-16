import type { OpsLocale } from "./types";

export const OPS_LOCALE_STORAGE_KEY = "ops-locale";

export function isOpsLocale(value: unknown): value is OpsLocale {
  return value === "en" || value === "ar";
}

export function readStoredOpsLocale(): OpsLocale | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(OPS_LOCALE_STORAGE_KEY);
  return isOpsLocale(stored) ? stored : null;
}

export function writeStoredOpsLocale(locale: OpsLocale): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(OPS_LOCALE_STORAGE_KEY, locale);
}
