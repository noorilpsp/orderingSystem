"use client";

import { resolveCatalogText, type CatalogI18n } from "@/lib/catalog-i18n";
import { useGuestLocale } from "@/lib/guest-i18n";

export function useLocalizedCatalogText(
  base: { name: string; description?: string | null },
  i18n?: CatalogI18n | null,
): { name: string; description: string } {
  const { locale } = useGuestLocale();
  return resolveCatalogText(locale, base, i18n);
}
