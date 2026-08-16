import type { OpsLocale } from "../types";
import { arMessages } from "./ar";
import { enMessages, type OpsMessageKey } from "./en";

export type { OpsMessageKey };

const catalogs: Record<OpsLocale, Record<OpsMessageKey, string>> = {
  en: enMessages,
  ar: arMessages,
};

export function getOpsMessages(locale: OpsLocale): Record<OpsMessageKey, string> {
  return catalogs[locale] ?? enMessages;
}

export function translateOpsMessage(
  locale: OpsLocale,
  key: OpsMessageKey,
  vars?: Record<string, string | number>,
): string {
  const template = catalogs[locale]?.[key] ?? enMessages[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = vars[name];
    return value == null ? `{${name}}` : String(value);
  });
}
