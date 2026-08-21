"use client";

import { PhoneCountrySelect } from "@/components/shared/phone-country-select";
import { useGuestLocale, useGuestT } from "@/lib/guest-i18n";

type GuestPhoneCountrySelectProps = {
  value: string;
  onChange: (countryCode: string) => void;
  invalid?: boolean;
};

export function GuestPhoneCountrySelect({
  value,
  onChange,
  invalid = false,
}: GuestPhoneCountrySelectProps) {
  const t = useGuestT();
  const { locale } = useGuestLocale();

  return (
    <PhoneCountrySelect
      value={value}
      onChange={onChange}
      invalid={invalid}
      locale={locale}
      className="h-11 rounded-xl"
      ariaLabel={t("checkout.addressPhoneCountry")}
      searchPlaceholder={t("checkout.searchCountry")}
      emptyText={t("checkout.noCountryFound")}
    />
  );
}
