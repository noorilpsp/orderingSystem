"use client";

import { useCallback, useMemo } from "react";
import { usePublicMenuOptional } from "@/lib/contexts/PublicMenuContext";
import {
  formatMerchantDate,
  formatMerchantDateTime,
  formatMerchantMoney,
  formatMerchantNumber,
  normalizeMerchantLocalization,
  type MerchantLocalization,
} from "@/lib/merchant-localization";

export function useGuestLocalization(): {
  localization: MerchantLocalization;
  formatMoney: (amount: number) => string;
  formatNumber: (value: number, fractionDigits?: number) => string;
  formatDate: (input: Date | string | number) => string;
  formatDateTime: (input: Date | string | number) => string;
} {
  const restaurant = usePublicMenuOptional()?.restaurant ?? null;

  const localization = useMemo(
    () =>
      normalizeMerchantLocalization(
        restaurant
          ? {
              currency: restaurant.currency,
              defaultLanguage: restaurant.defaultLanguage,
              dateFormat: restaurant.dateFormat,
              numberFormat: restaurant.numberFormat,
            }
          : null,
      ),
    [restaurant],
  );

  const formatMoney = useCallback(
    (amount: number) =>
      formatMerchantMoney(amount, {
        currency: localization.currency,
        numberFormat: localization.numberFormat,
      }),
    [localization.currency, localization.numberFormat],
  );

  const formatNumber = useCallback(
    (value: number, fractionDigits?: number) =>
      formatMerchantNumber(value, localization.numberFormat, fractionDigits),
    [localization.numberFormat],
  );

  const formatDate = useCallback(
    (input: Date | string | number) =>
      formatMerchantDate(input, localization.dateFormat),
    [localization.dateFormat],
  );

  const formatDateTime = useCallback(
    (input: Date | string | number) =>
      formatMerchantDateTime(input, { dateFormat: localization.dateFormat }),
    [localization.dateFormat],
  );

  return { localization, formatMoney, formatNumber, formatDate, formatDateTime };
}
