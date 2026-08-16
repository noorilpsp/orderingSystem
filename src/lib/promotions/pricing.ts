export type PromotionKind = "sale_price" | "bogo";

export type AppliedItemPromo = {
  promotionId: string;
  kind: PromotionKind;
  price: number;
  compareAtPrice: number | null;
};

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function bogoPaidQuantity(quantity: number): number {
  const qty = Math.max(0, Math.floor(quantity));
  return qty - Math.floor(qty / 2);
}

export function applyCatalogPromo(
  catalogPrice: number,
  promo: {
    promotionId: string;
    kind: PromotionKind;
    salePrice: number | null;
  } | null,
): AppliedItemPromo | null {
  const catalog = roundMoney(Number(catalogPrice) || 0);
  if (!promo) return null;

  switch (promo.kind) {
    case "sale_price": {
      const salePrice = roundMoney(Number(promo.salePrice) || 0);
      if (salePrice <= 0 || salePrice >= catalog) return null;
      return {
        promotionId: promo.promotionId,
        kind: "sale_price",
        price: salePrice,
        compareAtPrice: catalog,
      };
    }
    case "bogo":
      return {
        promotionId: promo.promotionId,
        kind: "bogo",
        price: catalog,
        compareAtPrice: null,
      };
    default: {
      const _exhaustive: never = promo.kind;
      return _exhaustive;
    }
  }
}

/** Undiscounted line total when a promo is on; null if there is nothing to strike through. */
export function guestLineCompareAtTotal(input: {
  promoKind?: PromotionKind | null;
  chargedTotal: number;
  quantity: number;
  unitBasePrice: number;
  compareAtPrice?: number | null;
  addOnsTotalPerUnit?: number;
}): number | null {
  const qty = Math.max(1, Math.floor(input.quantity));
  const addOns = Math.max(0, Number(input.addOnsTotalPerUnit) || 0);
  const charged = roundMoney(input.chargedTotal);
  if (!(charged > 0.009)) return null;
  const kind = input.promoKind ?? null;

  switch (kind) {
    case "sale_price": {
      const original = Number(input.compareAtPrice);
      if (!Number.isFinite(original) || original <= (Number(input.unitBasePrice) || 0)) {
        return null;
      }
      const full = roundMoney(qty * (original + addOns));
      return full > charged + 0.009 ? full : null;
    }
    case "bogo": {
      const full = roundMoney(qty * (Math.max(0, Number(input.unitBasePrice) || 0) + addOns));
      return full > charged + 0.009 ? full : null;
    }
    case null:
      return null;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** Base item is BOGO; add-ons stay charged on every unit. */
export function lineTotalWithPromo(input: {
  kind: PromotionKind | null | undefined;
  unitBasePrice: number;
  addOnsTotalPerUnit?: number;
  customizationsTotal?: number;
  quantity: number;
}): number {
  const qty = Math.max(1, Math.floor(input.quantity));
  const base = Math.max(0, Number(input.unitBasePrice) || 0);
  const addOnsPerUnit = Math.max(0, Number(input.addOnsTotalPerUnit) || 0);
  const customizationsTotal = Math.max(0, Number(input.customizationsTotal) || 0);
  const addOns =
    customizationsTotal > 0 ? customizationsTotal : addOnsPerUnit * qty;

  if (input.kind === "bogo") {
    return roundMoney(bogoPaidQuantity(qty) * base + addOns);
  }
  return roundMoney(qty * base + addOns);
}

export function assignBogoPaidQuantities(
  lines: Array<{ id: string; quantity: number }>,
): Map<string, number> {
  const paidById = new Map<string, number>();
  let unitIndex = 0;
  for (const line of lines) {
    const qty = Math.max(1, Math.floor(line.quantity));
    let paid = 0;
    for (let i = 0; i < qty; i += 1) {
      if (unitIndex % 2 === 0) paid += 1;
      unitIndex += 1;
    }
    paidById.set(line.id, paid);
  }
  return paidById;
}

export function applyPromosToBuiltLines<
  T extends {
    itemId: string | null;
    quantity: number;
    itemPrice: string;
    customizationsTotal: string;
    lineTotal: string;
  },
>(lines: T[], promoByItem: Map<string, AppliedItemPromo>): T[] {
  const withSale = lines.map((line) => {
    if (!line.itemId) return line;
    const promo = promoByItem.get(line.itemId);
    if (!promo) return line;
    return { ...line, itemPrice: promo.price.toFixed(2) };
  });

  const indexesByItem = new Map<string, number[]>();
  withSale.forEach((line, index) => {
    if (!line.itemId) return;
    const list = indexesByItem.get(line.itemId) ?? [];
    list.push(index);
    indexesByItem.set(line.itemId, list);
  });

  return withSale.map((line, index) => {
    const promo = line.itemId ? promoByItem.get(line.itemId) : undefined;
    const customizations = Number(line.customizationsTotal) || 0;
    const unitPrice = Number(line.itemPrice) || 0;
    const qty = Math.max(1, Math.floor(line.quantity));

    if (promo?.kind === "bogo" && line.itemId) {
      const group = indexesByItem.get(line.itemId) ?? [];
      const paidByKey = assignBogoPaidQuantities(
        group.map((groupIndex) => ({
          id: String(groupIndex),
          quantity: withSale[groupIndex]?.quantity ?? 1,
        })),
      );
      const paidQty = paidByKey.get(String(index)) ?? qty;
      return {
        ...line,
        lineTotal: roundMoney(paidQty * unitPrice + customizations).toFixed(2),
      };
    }

    return {
      ...line,
      lineTotal: roundMoney(qty * unitPrice + customizations).toFixed(2),
    };
  });
}
