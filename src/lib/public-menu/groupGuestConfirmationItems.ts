export type GuestGroupableCustomization = {
  groupId?: string | null;
  optionId?: string | null;
  optionName?: string | null;
  groupName?: string | null;
  quantity: number;
};

export type GuestGroupableLine = {
  itemId: string | null;
  itemName?: string;
  quantity: number;
  lineTotal: number;
  notes: string | null;
  customizations?: GuestGroupableCustomization[];
  seatNumber?: number | null;
  status?: string;
  compareAtTotal?: number | null;
};

function customizationKey(
  customizations: GuestGroupableCustomization[] | undefined,
): string {
  return [...(customizations ?? [])]
    .map((entry) => {
      const option = (entry.optionId ?? entry.optionName ?? "").trim().toLowerCase();
      if (!option) return null;
      const qty = Math.max(1, Math.floor(Number(entry.quantity) || 1));
      return `${option}:${qty}`;
    })
    .filter((part): part is string => part != null)
    .sort()
    .join(",");
}

export function guestIdenticalLineKey(line: GuestGroupableLine): string {
  const catalog =
    (line.itemId ?? "").trim() || (line.itemName ?? "").trim().toLowerCase();
  const notes = (line.notes ?? "").trim();
  const seat = line.seatNumber != null && line.seatNumber > 0 ? String(line.seatNumber) : "";
  const status = (line.status ?? "").trim();
  return `${catalog}\u0000${notes}\u0000${customizationKey(line.customizations)}\u0000${seat}\u0000${status}`;
}

/**
 * Kitchen/POS stores dine-in units as qty-1 rows. Guests should see 2× Item.
 * Lines stay separate if add-ons or notes differ.
 */
export function groupIdenticalGuestLines<T extends GuestGroupableLine>(
  lines: T[],
  keepSeparate?: (line: T) => boolean,
): T[] {
  const grouped: T[] = [];
  const indexByKey = new Map<string, number>();

  for (const line of lines) {
    if (keepSeparate?.(line)) {
      grouped.push({
        ...line,
        customizations: line.customizations ? [...line.customizations] : line.customizations,
      });
      continue;
    }

    const key = guestIdenticalLineKey(line);
    const existingIndex = indexByKey.get(key);
    if (existingIndex == null) {
      indexByKey.set(key, grouped.length);
      grouped.push({
        ...line,
        customizations: line.customizations ? [...line.customizations] : line.customizations,
      });
      continue;
    }

    const existing = grouped[existingIndex];
    if (!existing) continue;
    existing.quantity += line.quantity;
    existing.lineTotal += line.lineTotal;
    if (line.compareAtTotal != null || existing.compareAtTotal != null) {
      existing.compareAtTotal =
        (Number(existing.compareAtTotal) || 0) + (Number(line.compareAtTotal) || 0);
    }
  }

  return grouped;
}

export const groupGuestConfirmationItems = groupIdenticalGuestLines;
