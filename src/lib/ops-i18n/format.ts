import { resolveCatalogText, type CatalogI18n } from "@/lib/catalog-i18n";
import type { OpsMessageKey } from "./messages/en";
import type { OpsLocale } from "./types";

export type OpsTranslate = (
  key: OpsMessageKey,
  vars?: Record<string, string | number>,
) => string;

export function resolveOpsCatalogName(
  locale: OpsLocale,
  name: string,
  i18n?: CatalogI18n | null,
): string {
  return resolveCatalogText(locale, { name }, i18n).name;
}

export function opsItemsCountLabel(t: OpsTranslate, count: number): string {
  return count === 1
    ? t("card.itemsOne", { count })
    : t("card.itemsOther", { count });
}

export function opsGuestCountLabel(t: OpsTranslate, guestLabel: string): string {
  const guests = guestLabel.match(/^(\d+)\s+guests?$/i);
  if (!guests) return guestLabel;
  const count = guests[1] ?? "0";
  return Number(count) === 1
    ? t("guests.one", { count })
    : t("guests.other", { count });
}

export function opsTableWithCodeLabel(t: OpsTranslate, code: string): string {
  if (!code || code === "?") return t("source.table");
  return t("source.tableWithCode", { code });
}

export function orderItemMatchesQuery(
  item: { name: string; i18n?: CatalogI18n | null },
  query: string,
): boolean {
  const q = query.trim();
  if (!q) return true;
  const lower = q.toLowerCase();
  if (item.name.toLowerCase().includes(lower)) return true;
  const arName = item.i18n?.ar?.name?.trim() ?? "";
  return arName.includes(q);
}

export function opsOrderMatchesQuery(
  order: {
    label: string;
    sectionLabel: string;
    guestLabel: string;
    items: Array<{ name: string; i18n?: CatalogI18n | null }>;
  },
  query: string,
): boolean {
  const q = query.trim();
  if (!q) return true;
  const lower = q.toLowerCase();
  if (
    order.label.toLowerCase().includes(lower) ||
    order.sectionLabel.toLowerCase().includes(lower) ||
    order.guestLabel.toLowerCase().includes(lower)
  ) {
    return true;
  }
  return order.items.some((item) => orderItemMatchesQuery(item, q));
}
