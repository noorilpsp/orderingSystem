"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  composeGuestPhone,
  parseGuestPhoneParts,
  phoneCountryFromStoreCountry,
} from "@/lib/public-menu/guest-phone";
import { PhoneCountrySelect } from "@/components/shared/phone-country-select";

type PhoneNumberFieldProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: string | null;
  invalid?: boolean;
  placeholder?: string;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
  inputClassName?: string;
  triggerClassName?: string;
  locale?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  countryAriaLabel?: string;
  autoComplete?: string;
  maxLength?: number;
};

export function PhoneNumberField({
  id,
  name,
  value,
  onChange,
  defaultCountry,
  invalid = false,
  placeholder = "Mobile number",
  disabled = false,
  inputRef,
  className,
  inputClassName,
  triggerClassName,
  locale = "en",
  searchPlaceholder,
  emptyText,
  countryAriaLabel,
  autoComplete = "tel",
  maxLength = 50,
}: PhoneNumberFieldProps) {
  const fallbackCountry = phoneCountryFromStoreCountry(defaultCountry);
  const lastEmittedRef = useRef(value);
  const [countryCode, setCountryCode] = useState(() =>
    value.trim() ? parseGuestPhoneParts(value).countryCode : fallbackCountry,
  );
  const [national, setNational] = useState(() =>
    value.trim() ? parseGuestPhoneParts(value).national : "",
  );

  useEffect(() => {
    if (value === lastEmittedRef.current) {
      if (!value.trim()) {
        setCountryCode(phoneCountryFromStoreCountry(defaultCountry));
      }
      return;
    }
    lastEmittedRef.current = value;
    if (!value.trim()) {
      setCountryCode(phoneCountryFromStoreCountry(defaultCountry));
      setNational("");
      return;
    }
    const next = parseGuestPhoneParts(value);
    setCountryCode(next.countryCode);
    setNational(next.national);
  }, [value, defaultCountry]);

  function emit(nextCountry: string, nextNational: string) {
    const composed = nextNational.trim()
      ? composeGuestPhone(nextCountry, nextNational)
      : "";
    lastEmittedRef.current = composed;
    onChange(composed);
  }

  return (
    <div className={cn("flex gap-2", className)} dir="ltr">
      <PhoneCountrySelect
        value={countryCode}
        onChange={(code) => {
          setCountryCode(code);
          emit(code, national);
        }}
        invalid={invalid}
        disabled={disabled}
        locale={locale}
        className={triggerClassName}
        ariaLabel={countryAriaLabel}
        searchPlaceholder={searchPlaceholder}
        emptyText={emptyText}
      />
      <Input
        ref={inputRef}
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        value={national}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={invalid}
        className={cn("min-w-0 flex-1", inputClassName)}
        onChange={(event) => {
          const nextNational = event.target.value;
          setNational(nextNational);
          emit(countryCode, nextNational);
        }}
      />
    </div>
  );
}
