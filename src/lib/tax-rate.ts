/**
 * Coerce a location tax rate percent (e.g. 21 = 21%).
 * Preserves 0 — do not use `x || fallback`, which treats 0 as missing.
 * Missing/invalid values default to 0%.
 */
export function coerceTaxRatePercent(
  value: unknown,
  fallback = 0,
): number {
  if (value == null || value === "") return fallback;
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(0, parsed));
}
