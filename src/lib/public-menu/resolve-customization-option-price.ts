import type { GuestCustomizationGroup } from "@/lib/guest-menu/types";

export type ConditionalPriceLookup = {
  baseGroupId: string;
  prices: Array<{ baseOptionId: string; price: number }>;
};

function collectSelectedOptionIds(
  selectedOptions: Record<string, string[]>,
): Set<string> {
  const ids = new Set<string>();
  for (const optionIds of Object.values(selectedOptions)) {
    for (const optionId of optionIds) ids.add(optionId);
  }
  return ids;
}

function findOptionName(
  groups: GuestCustomizationGroup[] | undefined,
  optionId: string,
): string | null {
  if (!groups) return null;
  for (const group of groups) {
    const option = group.options.find((entry) => entry.id === optionId);
    if (option) return option.name;
  }
  return null;
}

/**
 * Resolve an option's displayed/charge price, preferring a conditional row
 * when its base group selection is present (e.g. topping priced by pizza size).
 */
export function resolveCustomizationOptionPrice(
  option: {
    price: number;
    conditionalPrices?: ConditionalPriceLookup | null;
  },
  selectedOptions: Record<string, string[]> | null | undefined,
  groups?: GuestCustomizationGroup[],
): number {
  const fallback = Number(option.price) || 0;
  const conditional = option.conditionalPrices;
  if (!conditional?.prices?.length || !selectedOptions) return fallback;

  const baseSelected =
    selectedOptions[conditional.baseGroupId]?.[0] ??
    (conditional.baseGroupId === "size"
      ? selectedOptions.size?.[0]
      : undefined);

  if (baseSelected) {
    const match = conditional.prices.find(
      (entry) => entry.baseOptionId === baseSelected,
    );
    if (match) return Number(match.price) || 0;
  }

  // Prefer any selected option id that appears in the conditional matrix
  // (same strategy as server order pricing).
  const selectedIds = collectSelectedOptionIds(selectedOptions);
  const byId = conditional.prices.find((entry) =>
    selectedIds.has(entry.baseOptionId),
  );
  if (byId) return Number(byId.price) || 0;

  // Last resort: match by size/base option name when duplicate size groups exist.
  if (groups && groups.length > 0) {
    const selectedNames = new Set<string>();
    for (const optionId of selectedIds) {
      const name = findOptionName(groups, optionId);
      if (name) selectedNames.add(name.toLowerCase());
    }
    for (const entry of conditional.prices) {
      const baseName = findOptionName(groups, entry.baseOptionId);
      if (baseName && selectedNames.has(baseName.toLowerCase())) {
        return Number(entry.price) || 0;
      }
    }
  }

  return fallback;
}

/**
 * Server-side helper: among selected option IDs on the same line, pick a
 * matching conditional base-option price when present.
 */
export function resolveOptionPriceFromSelectedOptionIds(
  basePrice: number,
  conditionalRows: Array<{ baseOptionId: string; price: string | number }>,
  selectedOptionIds: ReadonlySet<string>,
  optionNameById?: ReadonlyMap<string, string>,
): number {
  const fallback = Number(basePrice) || 0;
  if (!conditionalRows.length || selectedOptionIds.size === 0) return fallback;

  const match = conditionalRows.find((row) =>
    selectedOptionIds.has(row.baseOptionId),
  );
  if (match) return Number(match.price) || 0;

  if (optionNameById && optionNameById.size > 0) {
    const selectedNames = new Set<string>();
    for (const optionId of selectedOptionIds) {
      const name = optionNameById.get(optionId);
      if (name) selectedNames.add(name.toLowerCase());
    }
    for (const row of conditionalRows) {
      const baseName = optionNameById.get(row.baseOptionId);
      if (baseName && selectedNames.has(baseName.toLowerCase())) {
        return Number(row.price) || 0;
      }
    }
  }

  return fallback;
}
