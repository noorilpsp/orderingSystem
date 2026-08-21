import {
  DEFAULT_GUEST_PHONE_COUNTRY,
  GUEST_PHONE_CALLING_CODES,
  guestPhoneCountry,
  listGuestPhoneCountries,
  phoneCountryFromStoreCountry,
  type GuestPhoneCountry,
} from "@/lib/public-menu/guest-phone-countries";

export const GUEST_PHONE_STORAGE_KEY = "guest-checkout-phone";
export const GUEST_PHONE_COUNTRY_STORAGE_KEY = "guest-phone-default-country";

export type { GuestPhoneCountry };
export {
  DEFAULT_GUEST_PHONE_COUNTRY,
  listGuestPhoneCountries,
  guestPhoneCountry,
  phoneCountryFromStoreCountry,
};

const PREFERRED_COUNTRY_FOR_CALLING_CODE: Record<string, string> = {
  "1": "US",
  "7": "RU",
  "39": "IT",
  "44": "GB",
  "47": "NO",
  "61": "AU",
  "212": "MA",
  "262": "RE",
  "358": "FI",
  "590": "GP",
};

const CALLING_CODES_BY_LENGTH = Array.from(
  new Set(Object.values(GUEST_PHONE_CALLING_CODES)),
).sort((a, b) => b.length - a.length);

export function parseGuestPhoneParts(value: string): {
  countryCode: string;
  national: string;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return { countryCode: DEFAULT_GUEST_PHONE_COUNTRY, national: "" };
  }
  const compact = trimmed.replace(/[\s-]/g, "");
  const numbered = compact.startsWith("+") ? compact.slice(1) : compact;
  for (const calling of CALLING_CODES_BY_LENGTH) {
    if (!numbered.startsWith(calling)) continue;
    const preferred = PREFERRED_COUNTRY_FOR_CALLING_CODE[calling];
    const countryCode =
      preferred && GUEST_PHONE_CALLING_CODES[preferred] === calling
        ? preferred
        : (Object.keys(GUEST_PHONE_CALLING_CODES).find(
            (code) => GUEST_PHONE_CALLING_CODES[code] === calling,
          ) ?? DEFAULT_GUEST_PHONE_COUNTRY);
    return { countryCode, national: numbered.slice(calling.length) };
  }
  return { countryCode: DEFAULT_GUEST_PHONE_COUNTRY, national: trimmed };
}

export function composeGuestPhone(countryCode: string, national: string): string {
  const country =
    guestPhoneCountry(countryCode) ?? guestPhoneCountry(DEFAULT_GUEST_PHONE_COUNTRY);
  const digits = national.replace(/\D/g, "").replace(/^0+/, "");
  return `${country?.dial ?? "+32"}${digits}`;
}

export function isValidGuestPhone(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length >= 7 &&
    trimmed.length <= 50 &&
    trimmed.replace(/\D/g, "").length >= 7
  );
}

/** View-only: hide the calling code when it matches the store country. */
export function formatPhoneForDisplay(
  phone: string | null | undefined,
  storeCountry: string | null | undefined,
): string {
  const trimmed = phone?.trim() ?? "";
  if (!trimmed) return "";
  if (!storeCountry?.trim()) return trimmed;

  const storeCalling = GUEST_PHONE_CALLING_CODES[phoneCountryFromStoreCountry(storeCountry)];
  if (!storeCalling) return trimmed;

  const compact = trimmed.replace(/[\s().-]/g, "");
  const digits = compact.startsWith("+")
    ? compact.slice(1)
    : compact.startsWith("00")
      ? compact.slice(2)
      : compact;
  if (!digits.startsWith(storeCalling) || digits.length <= storeCalling.length) {
    return trimmed;
  }

  const escaped = storeCalling.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const national = trimmed
    .replace(new RegExp(`^(?:\\+|00)?\\s*${escaped}\\s*`), "")
    .trim();
  return national || trimmed;
}

export function readStoredGuestPhone(): string {
  if (typeof window === "undefined") return "";
  try {
    return (window.localStorage.getItem(GUEST_PHONE_STORAGE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

export function writeStoredGuestPhone(phone: string): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = phone.trim();
    if (trimmed) {
      window.localStorage.setItem(GUEST_PHONE_STORAGE_KEY, trimmed);
      return;
    }
    window.localStorage.removeItem(GUEST_PHONE_STORAGE_KEY);
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function readStoredGuestPhoneCountry(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = (window.localStorage.getItem(GUEST_PHONE_COUNTRY_STORAGE_KEY) ?? "").trim();
    return stored ? phoneCountryFromStoreCountry(stored) : null;
  } catch {
    return null;
  }
}

export function writeStoredGuestPhoneCountry(country: string | null | undefined): void {
  if (typeof window === "undefined") return;
  const trimmed = country?.trim() ?? "";
  if (!trimmed) return;
  try {
    window.localStorage.setItem(
      GUEST_PHONE_COUNTRY_STORAGE_KEY,
      phoneCountryFromStoreCountry(trimmed),
    );
  } catch {
    // Ignore quota / private-mode failures.
  }
}
