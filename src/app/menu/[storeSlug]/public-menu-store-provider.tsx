"use client";

import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PublicMenuProvider } from "@/lib/contexts/PublicMenuContext";
import { GuestLocaleProvider } from "@/lib/guest-i18n";

function PublicMenuProviderInner({
  storeSlug,
  children,
}: {
  storeSlug: string;
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const tableNumber = searchParams.get("table") ?? "";
  const mode = searchParams.get("mode");
  const initialOrderType =
    mode === "pickup"
      ? "pickup"
      : mode === "dine-in" || mode === "on_site"
        ? "dine-in"
        : tableNumber.trim()
          ? "dine-in"
          : "pickup";

  return (
    <PublicMenuProvider
      storeSlug={storeSlug}
      initialTableNumber={tableNumber}
      initialOrderType={initialOrderType}
    >
      {children}
    </PublicMenuProvider>
  );
}

export function PublicMenuStoreProvider({
  storeSlug,
  children,
}: {
  storeSlug: string;
  children: ReactNode;
}) {
  return (
    <GuestLocaleProvider>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <PublicMenuProviderInner storeSlug={storeSlug}>{children}</PublicMenuProviderInner>
      </Suspense>
    </GuestLocaleProvider>
  );
}
