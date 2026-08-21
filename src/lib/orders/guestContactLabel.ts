import { formatPhoneForDisplay } from "@/lib/public-menu/guest-phone";

export function formatGuestContactLabel(
  name?: string | null,
  phone?: string | null,
  storeCountry?: string | null,
): string {
  const trimmedName = name?.trim() ?? "";
  const trimmedPhone = formatPhoneForDisplay(phone, storeCountry);
  if (trimmedName && trimmedPhone) return `${trimmedName} · ${trimmedPhone}`;
  return trimmedName || trimmedPhone || "Guest";
}
