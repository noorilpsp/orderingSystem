"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  DEFAULT_GUEST_PHONE_COUNTRY,
  guestPhoneCountry,
  listGuestPhoneCountries,
} from "@/lib/public-menu/guest-phone";

type PhoneCountrySelectProps = {
  value: string;
  onChange: (countryCode: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  locale?: string;
  className?: string;
  ariaLabel?: string;
  searchPlaceholder?: string;
  emptyText?: string;
};

export function PhoneCountrySelect({
  value,
  onChange,
  invalid = false,
  disabled = false,
  locale = "en",
  className,
  ariaLabel = "Country code",
  searchPlaceholder = "Search country",
  emptyText = "No country found.",
}: PhoneCountrySelectProps) {
  const [open, setOpen] = useState(false);
  const countries = useMemo(() => listGuestPhoneCountries(locale), [locale]);
  const selected =
    guestPhoneCountry(value, locale) ??
    guestPhoneCountry(DEFAULT_GUEST_PHONE_COUNTRY, locale);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "inline-flex h-9 w-[6.75rem] shrink-0 items-center justify-between gap-1 rounded-md border bg-background px-2 text-sm text-foreground focus:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
            invalid
              ? "border-destructive aria-invalid:border-destructive"
              : "border-input",
            className,
          )}
        >
          <span className="truncate">
            {selected?.flag} {selected?.dial}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-[80] w-72 p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {countries.map((country) => (
                <CommandItem
                  key={country.code}
                  value={`${country.name} ${country.dial} ${country.code}`}
                  onSelect={() => {
                    onChange(country.code);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {country.flag} {country.name}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{country.dial}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
