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

/** Reads ?table=&mode= after mount - kept in a tiny Suspense boundary so the shell hydrates cleanly. */
function GuestMenuSearchParamsSync() {
  const searchParams = useSearchParams();
  const publicMenu = usePublicMenuOptional();
  const setTableNumber = publicMenu?.setTableNumber;
  const lockTableFromQr = publicMenu?.lockTableFromQr;
  const setOrderType = publicMenu?.setOrderType;
  const tableLocked = publicMenu?.tableLocked ?? false;

  useEffect(() => {
    if (!setTableNumber || !setOrderType) return;

    const tableNumber = searchParams.get("table") ?? "";
    const mode = searchParams.get("mode");
    // Table QR URLs imply dine-in, but an explicit mode always wins - otherwise
    // Switch to Pickup (table stays in the URL) gets snapped back to dine-in.
    const orderType =
      mode === "pickup"
        ? "pickup"
        : mode === "delivery"
          ? "delivery"
          : mode === "dine-in" || mode === "on_site"
            ? "dine-in"
            : tableNumber.trim()
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
    // Only re-read when the URL changes. Seat/lock updates must not re-apply a
    // stale ?mode=dine-in over a user switch to pickup.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [searchParams, setTableNumber, lockTableFromQr, setOrderType]);

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
