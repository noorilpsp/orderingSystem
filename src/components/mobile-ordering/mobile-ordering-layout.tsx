"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function isMobileOrderingPath(pathname: string | null): boolean {
  return !!pathname?.startsWith("/mobile") || !!pathname?.startsWith("/menu/");
}

export function MobileOrderingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  // Fonts come from the root layout (GeistSans / GeistMono CSS variables on <body>).
  // Do not load next/font here — Client Components get undefined `.variable` and hydrate poorly.
  return (
    <div
      className="mobile-ordering-root font-sans antialiased min-h-full"
      suppressHydrationWarning
    >
      {children}
    </div>
  );
}
