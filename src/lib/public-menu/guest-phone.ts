export const GUEST_PHONE_STORAGE_KEY = "guest-checkout-phone";

export function isValidGuestPhone(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length >= 7 &&
    trimmed.length <= 50 &&
    trimmed.replace(/\D/g, "").length >= 7
  );
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
