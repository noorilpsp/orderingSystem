"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function isMobileOrderingPath(pathname: string | null): boolean {
  return !!pathname?.startsWith("/mobile") || !!pathname?.startsWith("/menu/");
}

/** Applies the guest-menu page class after mount so the layout shell can stay a server component. */
export function LiquidGlassPageClass() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    if (isMobileOrderingPath(pathname)) {
      root.classList.add("liquid-glass-page");
    } else {
      root.classList.remove("liquid-glass-page");
    }
    return () => root.classList.remove("liquid-glass-page");
  }, [pathname]);

  return null;
}
