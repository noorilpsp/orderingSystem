import type { GuestLocale } from "../types";
import { arMessages } from "./ar";
import { enMessages, type EnMessageKey } from "./en";

export type { EnMessageKey };

const catalogs: Record<GuestLocale, Record<EnMessageKey, string>> = {
  en: enMessages,
  ar: arMessages,
};

export function getGuestMessages(locale: GuestLocale): Record<EnMessageKey, string> {
  return catalogs[locale] ?? enMessages;
}

export function translateGuestMessage(
  locale: GuestLocale,
  key: EnMessageKey,
  vars?: Record<string, string | number>,
): string {
  const template = catalogs[locale]?.[key] ?? enMessages[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = vars[name];
    return value == null ? `{${name}}` : String(value);
  });
}
