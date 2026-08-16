"use client";

import { useCallback, useMemo } from "react";
import { useCurrentMerchant } from "@/lib/hooks/useCurrentMerchant";
import {
  formatMerchantDate,
  formatMerchantDateTime,
  formatMerchantMoney,
  formatMerchantNumber,
  normalizeMerchantLocalization,
  type MerchantLocalization,
} from "@/lib/merchant-localization";

export function useMerchantLocalization(): {
  localization: MerchantLocalization;
  formatMoney: (amount: number) => string;
  formatNumber: (value: number, fractionDigits?: number) => string;
  formatDate: (input: Date | string | number) => string;
  formatDateTime: (input: Date | string | number) => string;
} {
  const { merchant, membership } = useCurrentMerchant();

  const localization = useMemo(
    () =>
      normalizeMerchantLocalization({
        currency:
          merchant?.defaultCurrency ?? membership?.merchant?.defaultCurrency ?? null,
        defaultLanguage:
          merchant?.defaultLanguage ?? membership?.merchant?.defaultLanguage ?? null,
        dateFormat: merchant?.dateFormat ?? membership?.merchant?.dateFormat ?? null,
        numberFormat:
          merchant?.numberFormat ?? membership?.merchant?.numberFormat ?? null,
      }),
    [merchant, membership],
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
