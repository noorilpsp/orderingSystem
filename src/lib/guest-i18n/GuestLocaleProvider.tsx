"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

type GuestLocaleContextValue = {
  locale: GuestLocale;
  dir: "ltr" | "rtl";
  setLocale: (locale: GuestLocale) => void;
  t: (key: EnMessageKey, vars?: Record<string, string | number>) => string;
};

const GuestLocaleContext = createContext<GuestLocaleContextValue | null>(null);

function dirForLocale(locale: GuestLocale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function GuestLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<GuestLocale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStoredGuestLocale();
    if (stored) setLocaleState(stored);
    setReady(true);
  }, []);

  const setLocale = useCallback((next: GuestLocale) => {
    if (!isGuestLocale(next)) return;
    setLocaleState(next);
    writeStoredGuestLocale(next);
  }, []);

  const t = useCallback(
    (key: EnMessageKey, vars?: Record<string, string | number>) =>
      translateGuestMessage(locale, key, vars),
    [locale],
  );

  const value = useMemo<GuestLocaleContextValue>(
    () => ({
      locale,
      dir: dirForLocale(locale),
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    const shell = document.querySelector(".mobile-ordering-root");
    root.lang = locale;
    root.dir = dirForLocale(locale);
    if (shell instanceof HTMLElement) {
      shell.dir = dirForLocale(locale);
      shell.lang = locale;
    }
    return () => {
      // Leave dir alone if other menus might use it — reset to ltr when leaving guest.
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
