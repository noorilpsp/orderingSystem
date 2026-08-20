/** Canonical IANA timezone for each country this product supports. */
const COUNTRY_TIMEZONES: Record<string, string> = {
  belgium: "Europe/Brussels",
  be: "Europe/Brussels",
  france: "Europe/Paris",
  fr: "Europe/Paris",
  netherlands: "Europe/Amsterdam",
  "the netherlands": "Europe/Amsterdam",
  nl: "Europe/Amsterdam",
  germany: "Europe/Berlin",
  de: "Europe/Berlin",
  "united kingdom": "Europe/London",
  uk: "Europe/London",
  gb: "Europe/London",
  spain: "Europe/Madrid",
  es: "Europe/Madrid",
  italy: "Europe/Rome",
  it: "Europe/Rome",
  lebanon: "Asia/Beirut",
  lb: "Asia/Beirut",
  "united states": "America/New_York",
  usa: "America/New_York",
  us: "America/New_York",
  canada: "America/Toronto",
  ca: "America/Toronto",
};

export const DEFAULT_STORE_TIMEZONE = "Europe/Brussels";

export function timezoneFromCountry(
  country: string | null | undefined,
): string {
  const key = country?.trim().toLowerCase() ?? "";
  if (!key) return DEFAULT_STORE_TIMEZONE;
  return COUNTRY_TIMEZONES[key] ?? DEFAULT_STORE_TIMEZONE;
}

/** Guest/menu clock: country wins so hours follow the store, not a hidden default. */
export function resolveStoreTimezone(options: {
  country?: string | null;
  locationTimezone?: string | null;
  merchantTimezone?: string | null;
}): string {
  if (options.country?.trim()) {
    return timezoneFromCountry(options.country);
  }
  return (
    options.locationTimezone?.trim() ||
    options.merchantTimezone?.trim() ||
    DEFAULT_STORE_TIMEZONE
  );
}
