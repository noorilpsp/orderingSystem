"use client";

import { useEffect, useState } from "react";
import {
  phoneCountryFromStoreCountry,
  readStoredGuestPhoneCountry,
  writeStoredGuestPhoneCountry,
} from "@/lib/public-menu/guest-phone";
import {
  readGuestLastStoreSlug,
  restaurantCountryFromPublicMenuPayload,
  storeSlugFromGuestPath,
} from "@/lib/public-menu/guest-last-store";

export function useStorePhoneCountry(
  defaultPhoneCountry?: string | null,
  storeSlug?: string | null,
  returnTo?: string | null,
): string | null {
  const [storedPhoneCountry, setStoredPhoneCountry] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStoredGuestPhoneCountry();
    if (stored) setStoredPhoneCountry(stored);
    if (defaultPhoneCountry) {
      writeStoredGuestPhoneCountry(defaultPhoneCountry);
      return;
    }

    const slug =
      storeSlug ?? storeSlugFromGuestPath(returnTo) ?? readGuestLastStoreSlug();
    if (!slug) return;

    let cancelled = false;
    fetch(`/api/public/menu/${encodeURIComponent(slug)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled) return;
        const country = restaurantCountryFromPublicMenuPayload(payload);
        if (!country) return;
        writeStoredGuestPhoneCountry(country);
        setStoredPhoneCountry(phoneCountryFromStoreCountry(country));
      })
      .catch(() => {
        // Keep the stored/default country if the menu lookup fails.
      });

    return () => {
      cancelled = true;
    };
  }, [defaultPhoneCountry, returnTo, storeSlug]);

  return defaultPhoneCountry ?? storedPhoneCountry;
}
