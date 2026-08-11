import type { GuestCustomizationGroup } from "@/lib/guest-menu/types";

/**
 * Whether a guest must configure the item before it can be quick-added
 * from a + button (required groups / min selections).
 * Secondary groups are ignored until their trigger is chosen in the detail sheet.
 */
export function itemNeedsCustomizationBeforeQuickAdd(
  groups: GuestCustomizationGroup[],
): boolean {
  return groups.some((group) => {
    if (group.isSecondary) return false;
    return group.isRequired || group.minSelections > 0;
  });
}
