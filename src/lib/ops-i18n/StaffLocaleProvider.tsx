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
import type { OpsMessageKey } from "./messages/en";
import { translateOpsMessage } from "./messages";
import { isOpsLocale, readStoredOpsLocale, writeStoredOpsLocale } from "./storage";
import type { OpsLocale } from "./types";

export type StaffLocaleContextValue = {
  locale: OpsLocale;
  dir: "ltr" | "rtl";
  setLocale: (locale: OpsLocale) => void;
  t: (key: OpsMessageKey, vars?: Record<string, string | number>) => string;
};

const StaffLocaleContext = createContext<StaffLocaleContextValue | null>(null);

function dirForLocale(locale: OpsLocale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function StaffLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<OpsLocale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStoredOpsLocale();
    if (stored) setLocaleState(stored);
    setReady(true);
  }, []);

  const setLocale = useCallback((next: OpsLocale) => {
    if (!isOpsLocale(next)) return;
    setLocaleState(next);
    writeStoredOpsLocale(next);
  }, []);

  const t = useCallback(
    (key: OpsMessageKey, vars?: Record<string, string | number>) =>
      translateOpsMessage(locale, key, vars),
    [locale],
  );

  const dir = dirForLocale(locale);

  const value = useMemo<StaffLocaleContextValue>(
    () => ({
      locale,
      dir,
      setLocale,
      t,
    }),
    [locale, dir, setLocale, t],
  );

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    const shell = document.querySelector(".ops-tables-root");
    root.lang = locale;
    root.dir = dir;
    if (shell instanceof HTMLElement) {
      shell.dir = dir;
      shell.lang = locale;
    }
    return () => {
      root.lang = "en";
      root.dir = "ltr";
      if (shell instanceof HTMLElement) {
        shell.dir = "ltr";
        shell.lang = "en";
      }
    };
  }, [locale, dir, ready]);

  return (
    <StaffLocaleContext.Provider value={value}>{children}</StaffLocaleContext.Provider>
  );
}

export function useStaffLocale(): StaffLocaleContextValue {
  const ctx = useContext(StaffLocaleContext);
  if (!ctx) {
    throw new Error("useStaffLocale must be used within StaffLocaleProvider");
  }
  return ctx;
}

export function useStaffLocaleOptional(): StaffLocaleContextValue | null {
  return useContext(StaffLocaleContext);
}

export function useStaffT() {
  return useStaffLocale().t;
}
