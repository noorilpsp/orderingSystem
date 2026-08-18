"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { PublicMenuProvider, usePublicMenuOptional } from "@/lib/contexts/PublicMenuContext";
import { GuestLocaleProvider } from "@/lib/guest-i18n";
import { mapMerchantLanguageToGuestLocale } from "@/lib/merchant-localization";
import type { PublicMenuView } from "@/lib/public-menu/types";

function GuestLocaleFromMerchant({ children }: { children: ReactNode }) {
  const publicMenu = usePublicMenuOptional();
  const restaurant = publicMenu?.restaurant ?? null;
  const storeSlug = publicMenu?.storeSlug ?? null;
  const defaultLocale = restaurant
    ? mapMerchantLanguageToGuestLocale(restaurant.defaultLanguage)
    : null;
  const availableLocales = restaurant?.availableLanguages ?? null;

  return (
    <GuestLocaleProvider
      defaultLocale={defaultLocale}
      availableLocales={availableLocales}
      storeSlug={storeSlug}
    >
      {children}
    </GuestLocaleProvider>
  );
}

/** Reads ?table=&mode= after mount — kept in a tiny Suspense boundary so the shell hydrates cleanly. */
function GuestMenuSearchParamsSync() {
  const searchParams = useSearchParams();
  const publicMenu = usePublicMenuOptional();
  const setTableNumber = publicMenu?.setTableNumber;
  const lockTableFromQr = publicMenu?.lockTableFromQr;
  const setOrderType = publicMenu?.setOrderType;
  const tableLocked = publicMenu?.tableLocked ?? false;
  const currentTable = publicMenu?.tableNumber ?? "";

  useEffect(() => {
    if (!setTableNumber || !setOrderType) return;

    const tableNumber = searchParams.get("table") ?? "";
    const mode = searchParams.get("mode");
    const orderType =
      mode === "pickup"
        ? "pickup"
        : mode === "dine-in" || mode === "on_site"
          ? "dine-in"
          : tableNumber.trim() || (tableLocked && currentTable.trim())
            ? "dine-in"
            : "pickup";

    if (tableNumber.trim() && lockTableFromQr) {
      lockTableFromQr(tableNumber);
    } else if (tableNumber.trim()) {
      setTableNumber(tableNumber);
    } else if (!tableLocked) {
      setTableNumber("");
    }
    setOrderType(orderType);
  }, [
    searchParams,
    setTableNumber,
    lockTableFromQr,
    setOrderType,
    tableLocked,
    currentTable,
  ]);

  return null;
}

export function PublicMenuStoreProvider({
  storeSlug,
  initialView,
  children,
}: {
  storeSlug: string;
  initialView?: PublicMenuView | null;
  children: ReactNode;
}) {
  return (
    <PublicMenuProvider
      storeSlug={storeSlug}
      initialView={initialView}
      initialTableNumber=""
      initialOrderType="pickup"
    >
      <GuestLocaleFromMerchant>
        {children}
        <Suspense fallback={null}>
          <GuestMenuSearchParamsSync />
        </Suspense>
      </GuestLocaleFromMerchant>
    </PublicMenuProvider>
  );
}
