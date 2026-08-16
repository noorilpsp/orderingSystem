"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { EnMessageKey } from "./messages/en";
import { translateGuestMessage } from "./messages";
import {
  isGuestLocale,
  readStoredGuestLocale,
  writeStoredGuestLocale,
} from "./storage";
import type { GuestLocale } from "./types";
import {
  ALL_GUEST_LOCALES,
  resolveGuestLocaleFromAvailable,
} from "@/lib/merchant-localization";

type GuestLocaleContextValue = {
  locale: GuestLocale;
  dir: "ltr" | "rtl";
  availableLocales: GuestLocale[];
  setLocale: (locale: GuestLocale) => void;
  t: (key: EnMessageKey, vars?: Record<string, string | number>) => string;
};

const GuestLocaleContext = createContext<GuestLocaleContextValue | null>(null);

function dirForLocale(locale: GuestLocale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function GuestLocaleProvider({
  children,
  defaultLocale,
  availableLocales,
  storeSlug,
}: {
  children: ReactNode;
  /** Merchant Store → Localization default (en | ar). */
  defaultLocale?: GuestLocale | null;
  /** Languages this store offers on the guest menu. */
  availableLocales?: GuestLocale[] | null;
  /** Scopes guest language preference per public menu. */
  storeSlug?: string | null;
}) {
  const enabledLocales = useMemo(() => {
    const list = (availableLocales ?? []).filter(isGuestLocale);
    return list.length > 0 ? list : [...ALL_GUEST_LOCALES];
  }, [availableLocales]);

  const merchantDefault = defaultLocale ?? "en";

  const [locale, setLocaleState] = useState<GuestLocale>(() =>
    resolveGuestLocaleFromAvailable(null, enabledLocales, merchantDefault),
  );
  const [ready, setReady] = useState(false);
  const hasUserChoiceRef = useRef(false);

  useEffect(() => {
    const stored = readStoredGuestLocale(storeSlug);
    const next = resolveGuestLocaleFromAvailable(
      stored,
      enabledLocales,
      merchantDefault,
    );
    hasUserChoiceRef.current = Boolean(stored && enabledLocales.includes(stored));
    setLocaleState(next);
    setReady(true);
  }, [storeSlug, enabledLocales, merchantDefault]);

  const setLocale = useCallback(
    (next: GuestLocale) => {
      if (!isGuestLocale(next) || !enabledLocales.includes(next)) return;
      hasUserChoiceRef.current = true;
      setLocaleState(next);
      writeStoredGuestLocale(next, storeSlug);
    },
    [enabledLocales, storeSlug],
  );

  const t = useCallback(
    (key: EnMessageKey, vars?: Record<string, string | number>) =>
      translateGuestMessage(locale, key, vars),
    [locale],
  );

  const value = useMemo<GuestLocaleContextValue>(
    () => ({
      locale,
      dir: dirForLocale(locale),
      availableLocales: enabledLocales,
      setLocale,
      t,
    }),
    [locale, enabledLocales, setLocale, t],
  );

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    const shell = document.querySelector(".mobile-ordering-root");
    const dir = dirForLocale(locale);
    root.lang = locale;
    root.dir = dir;
    if (shell instanceof HTMLElement) {
      shell.dir = dir;
      shell.lang = locale;
    }
    return () => {
      root.lang = "en";
      root.dir = "ltr";
    };
  }, [locale, ready]);

  return (
    <GuestLocaleContext.Provider value={value}>{children}</GuestLocaleContext.Provider>
  );
}

export function useGuestLocale(): GuestLocaleContextValue {
  const ctx = useContext(GuestLocaleContext);
  if (!ctx) {
    throw new Error("useGuestLocale must be used within GuestLocaleProvider");
  }
  return ctx;
}

export function useGuestT() {
  return useGuestLocale().t;
}
