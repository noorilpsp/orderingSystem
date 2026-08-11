"use client";

import { useCurrentMerchant } from "@/lib/hooks/useCurrentMerchant";
import { normalizeMerchantFeatures } from "@/lib/db/schema/merchants";

/**
 * Whether the current merchant has Kitchen Display (KDS) enabled by platform admin.
 * While merchant data is loading, treats KDS as off to avoid flashing gated UI.
 */
export function useMerchantKdsEnabled() {
  const { merchant, loading, error } = useCurrentMerchant();
  const kdsEnabled = normalizeMerchantFeatures(merchant?.features).kds;
  return {
    kdsEnabled: !loading && kdsEnabled,
    loading,
    error,
  };
}
