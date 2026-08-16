import type { CatalogI18n } from "@/lib/catalog-i18n";
import { groupIdenticalGuestLines } from "@/lib/public-menu/groupGuestConfirmationItems";

type OpsDisplayItem = {
  id: string;
  name: string;
  itemId?: string | null;
  i18n?: CatalogI18n | null;
  qty: number;
  price?: number;
  notes?: string | null;
  status?: string;
  seatNumber?: number | null;
  customizations?: Array<{
    groupName: string;
    optionName: string;
    optionPrice: number;
    quantity: number;
    groupId?: string | null;
    optionId?: string | null;
    groupI18n?: CatalogI18n | null;
    optionI18n?: CatalogI18n | null;
  }>;
};

/**
 * Kitchen stores dine-in units as qty-1 rows. Group identical display lines (same
 * item, add-ons, notes, seat, and status) so staff see 2× Caesar instead of two 1×.
 * Group on catalog ids / English snapshots; never on the displayed locale name.
 */
export function groupOpsOrderItems<T extends OpsDisplayItem>(items: T[]): T[] {
  const grouped = groupIdenticalGuestLines(
    items.map((item) => ({
      ...item,
      itemId: item.itemId ?? null,
      itemName: item.name,
      quantity: item.qty,
      lineTotal: Number(item.price) || 0,
      notes: item.notes ?? null,
      customizations: (item.customizations ?? []).map((entry) => ({
        ...entry,
        optionName: entry.optionName,
        groupName: entry.groupName,
        optionId: entry.optionId ?? null,
        groupId: entry.groupId ?? null,
        quantity: entry.quantity,
      })),
    })),
  );

  return grouped.map((item) => ({
    ...item,
    qty: item.quantity,
    price: item.lineTotal,
  }));
}
