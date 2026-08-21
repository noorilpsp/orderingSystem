"use client";

import { useCallback } from "react";
import { useLocationOptional } from "@/lib/contexts/LocationContext";
import { usePublicMenuOptional } from "@/lib/contexts/PublicMenuContext";
import { formatPhoneForDisplay } from "@/lib/public-menu/guest-phone";

export function useDisplayPhone() {
  const menu = usePublicMenuOptional();
  const location = useLocationOptional();
  const storeCountry =
    menu?.restaurant?.country ?? location?.getCurrentLocation()?.country ?? null;

  return useCallback(
    (phone: string | null | undefined) => formatPhoneForDisplay(phone, storeCountry),
    [storeCountry],
  );
}
