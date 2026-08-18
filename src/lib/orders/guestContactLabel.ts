export function formatGuestContactLabel(
  name?: string | null,
  phone?: string | null,
): string {
  const trimmedName = name?.trim() ?? "";
  const trimmedPhone = phone?.trim() ?? "";
  if (trimmedName && trimmedPhone) return `${trimmedName} · ${trimmedPhone}`;
  return trimmedName || trimmedPhone || "Guest";
}
