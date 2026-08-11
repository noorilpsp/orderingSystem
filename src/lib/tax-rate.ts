/**
 * Coerce a location tax rate percent (e.g. 21 = 21%).
 * Preserves 0 — do not use `x || 21`, which treats 0 as missing.
 */
export function coerceTaxRatePercent(
  value: unknown,
  fallback = 21,
): number {
  if (value == null || value === "") return fallback;
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(0, parsed));
}
