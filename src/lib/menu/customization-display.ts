export type CustomizationDisplayIntent = "removal" | "paid" | "neutral";

export type CustomizationDisplaySurface = "guest" | "ops";

const REMOVAL_OPTION_RE = /^(no|hold|without|w\/o)\b/i;
const REMOVAL_GROUP_RE = /\b(remove|leave\s*off|hold)\b/i;

export function getCustomizationDisplayIntent(input: {
  optionName: string;
  groupName?: string | null;
  price?: number | null;
}): CustomizationDisplayIntent {
  const price = Number(input.price ?? 0);
  if (!Number.isFinite(price)) return "neutral";
  if (price < 0) return "removal";

  const optionName = input.optionName.trim();
  if (REMOVAL_OPTION_RE.test(optionName)) return "removal";

  const groupName = input.groupName?.trim() ?? "";
  if (groupName && REMOVAL_GROUP_RE.test(groupName) && price <= 0) {
    return "removal";
  }

  if (price > 0) return "paid";
  return "neutral";
}

export function customizationIntentTextClass(
  intent: CustomizationDisplayIntent,
  surface: CustomizationDisplaySurface = "guest",
): string {
  switch (intent) {
    case "removal":
      return surface === "ops" ? "text-rose-300/90" : "text-rose-700 dark:text-rose-300";
    case "paid":
      return surface === "ops" ? "text-teal-300/90" : "text-teal-800 dark:text-teal-300";
    case "neutral":
      return surface === "ops" ? "text-white/55" : "text-foreground/80";
    default: {
      const _exhaustive: never = intent;
      return _exhaustive;
    }
  }
}

/**
 * Prefer add-on delta for display. Absolute size menus (e.g. 12/14/18)
 * become deltas vs the cheapest option so size itself isn't always "paid".
 */
export function resolveCustomizationDisplayPrice(
  optionPrice: number,
  siblingOptionPrices: number[],
): number {
  const price = Number(optionPrice);
  if (!Number.isFinite(price)) return 0;
  if (siblingOptionPrices.length === 0) return price;

  const finiteSiblings = siblingOptionPrices.filter((value) => Number.isFinite(value));
  if (finiteSiblings.length === 0) return price;

  const min = Math.min(...finiteSiblings);
  // Absolute-price size menus usually sit well above typical add-on deltas.
  if (min >= 5 && finiteSiblings.every((value) => value >= 5)) {
    return Math.max(0, price - min);
  }
  return price;
}

export function formatCustomizationOptionLabel(input: {
  optionName: string;
  quantity?: number;
  optionPrice?: number;
  showPrice?: boolean;
  /** When provided, used instead of a hardcoded currency symbol. */
  formatMoney?: (amount: number) => string;
}): string {
  const qty =
    typeof input.quantity === "number" && input.quantity > 1
      ? `${input.quantity}× `
      : "";
  const priceValue = Number(input.optionPrice ?? 0);
  const price =
    input.showPrice && Number.isFinite(priceValue) && priceValue > 0
      ? input.formatMoney
        ? ` (+${input.formatMoney(priceValue)})`
        : ` (+${priceValue.toFixed(2)})`
      : "";
  return `${qty}${input.optionName}${price}`;
}
