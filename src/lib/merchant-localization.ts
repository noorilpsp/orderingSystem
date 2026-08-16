import type { GuestLocale } from "@/lib/guest-i18n/types";

export type MerchantDateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
export type MerchantNumberFormat = "1,234.56" | "1.234,56";

export type MerchantLocalization = {
  currency: string;
  defaultLanguage: string;
  dateFormat: MerchantDateFormat | string | null;
  numberFormat: MerchantNumberFormat | string | null;
};

export const DEFAULT_MERCHANT_LOCALIZATION: MerchantLocalization = {
  currency: "",
  defaultLanguage: "en-US",
  dateFormat: "DD/MM/YYYY",
  numberFormat: "1.234,56",
};

/** Map merchant `defaultLanguage` → guest UI locale (`en` | `ar`). */
export function mapMerchantLanguageToGuestLocale(
  language: string | null | undefined,
): GuestLocale {
  const normalized = (language ?? "").trim().toLowerCase();
  if (normalized === "ar" || normalized.startsWith("ar-")) return "ar";
  return "en";
}

export const ALL_GUEST_LOCALES: GuestLocale[] = ["en", "ar"];

/** Normalize merchant available-language settings to guest locales. */
export function normalizeAvailableGuestLocales(
  value: unknown,
  _fallbackDefaultLanguage?: string | null,
): GuestLocale[] {
  const fromArray = Array.isArray(value)
    ? value.filter((entry): entry is GuestLocale => entry === "en" || entry === "ar")
    : [];
  const unique = Array.from(new Set(fromArray));
  if (unique.length > 0) {
    return unique.sort((a, b) => ALL_GUEST_LOCALES.indexOf(a) - ALL_GUEST_LOCALES.indexOf(b));
  }
  // Legacy / unset: offer both languages.
  return [...ALL_GUEST_LOCALES];
}

export function resolveGuestLocaleFromAvailable(
  preferred: GuestLocale | null | undefined,
  available: GuestLocale[],
  merchantDefaultLanguage?: string | null,
): GuestLocale {
  const enabled = available.length > 0 ? available : ALL_GUEST_LOCALES;
  if (preferred && enabled.includes(preferred)) return preferred;
  const merchantDefault = mapMerchantLanguageToGuestLocale(merchantDefaultLanguage);
  if (enabled.includes(merchantDefault)) return merchantDefault;
  return enabled[0] ?? "en";
}

function intlLocaleForNumberFormat(
  numberFormat: string | null | undefined,
  fallback: string = "en-US",
): string {
  if (numberFormat === "1.234,56") return "de-DE";
  if (numberFormat === "1,234.56") return "en-US";
  return fallback;
}

export function formatMerchantMoney(
  amount: number,
  options?: {
    currency?: string | null;
    numberFormat?: string | null;
    locale?: string | null;
  },
): string {
  const currency = (options?.currency ?? "").trim().toUpperCase();
  const locale =
    options?.locale?.trim() ||
    intlLocaleForNumberFormat(options?.numberFormat, "en-US");
  const safe = Number.isFinite(amount) ? amount : 0;

  if (!currency) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  }

  try {
    // LBP narrow symbol is "L£" — prefer the ISO code for clarity.
    const currencyDisplay = currency === "LBP" ? "code" : "narrowSymbol";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    // Invalid currency code — show code + amount (never invent another currency).
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
    return `${currency} ${formatted}`;
  }
}

export function formatMerchantNumber(
  value: number,
  numberFormat?: string | null,
  fractionDigits?: number,
): string {
  const locale = intlLocaleForNumberFormat(numberFormat, "en-US");
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(safe);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatMerchantDate(
  input: Date | string | number,
  dateFormat?: string | null,
): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";

  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = String(date.getFullYear());
  const format = dateFormat ?? "DD/MM/YYYY";

  switch (format) {
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    case "DD/MM/YYYY":
      return `${day}/${month}/${year}`;
    default:
      return `${day}/${month}/${year}`;
  }
}

export function formatMerchantDateTime(
  input: Date | string | number,
  options?: {
    dateFormat?: string | null;
    includeTime?: boolean;
  },
): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";

  const datePart = formatMerchantDate(date, options?.dateFormat);
  if (options?.includeTime === false) return datePart;

  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  return `${datePart} ${hours}:${minutes}`;
}

export function normalizeMerchantLocalization(
  partial?: Partial<MerchantLocalization> | null,
): MerchantLocalization {
  return {
    currency: (partial?.currency ?? "").trim().toUpperCase(),
    defaultLanguage:
      partial?.defaultLanguage?.trim() || DEFAULT_MERCHANT_LOCALIZATION.defaultLanguage,
    dateFormat: partial?.dateFormat ?? DEFAULT_MERCHANT_LOCALIZATION.dateFormat,
    numberFormat: partial?.numberFormat ?? DEFAULT_MERCHANT_LOCALIZATION.numberFormat,
  };
}
