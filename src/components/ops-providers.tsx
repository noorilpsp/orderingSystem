"use client";

import { useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PermissionsProvider, usePermissionsContext } from "@/lib/contexts/PermissionsContext";
import { TenantProvider } from "@/lib/contexts/TenantContext";
import { LocationProvider } from "@/lib/contexts/LocationContext";
import { LocationMenuProvider } from "@/lib/contexts/LocationMenuContext";
import { RestaurantHydrationRunner } from "@/components/restaurant-hydration-runner";
import { TablePageSkeleton } from "@/components/table-detail/TablePageSkeleton";
import { primeIncomingOrderAlertAudio } from "@/lib/orders/incoming-order-alert-sound";

/** Shared full-screen loading UI for ops routes. Use for initial load to keep experience continuous. */
export function OpsLoadingFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950">
      <span className="text-zinc-400">Loading...</span>
    </div>
  );
}

function OpsProvidersInner({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { sessionPermissions, loading } = usePermissionsContext();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Unlock /orders alert audio (and notification permission) on any ops gesture.
    return primeIncomingOrderAlertAudio();
  }, []);

  const LoadingUI = pathname.startsWith("/table/") ? TablePageSkeleton : OpsLoadingFallback;

  if (!mounted) {
    return <LoadingUI />;
  }

  if (loading || !sessionPermissions) {
    return <LoadingUI />;
  }

  const merchantMemberships = sessionPermissions.merchantMemberships.map((m) => ({
    merchantId: m.merchantId,
    merchantName: m.merchantName,
    role: m.role,
    isActive: m.isActive,
    membershipCreatedAt: m.membershipCreatedAt,
  }));
  const userId = sessionPermissions.userId;

  if (merchantMemberships.length === 0) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950">
        <span className="text-zinc-400">No merchants found.</span>
      </div>
    );
  }

  return (
    <TenantProvider initialMerchants={merchantMemberships} userId={userId}>
      <LocationProvider>
        <LocationMenuProvider>
          <RestaurantHydrationRunner />
          {children}
        </LocationMenuProvider>
      </LocationProvider>
    </TenantProvider>
  );
}

export function OpsProviders({ children }: { children: ReactNode }) {
  return (
    <PermissionsProvider>
      <OpsProvidersInner>{children}</OpsProvidersInner>
    </PermissionsProvider>
  );
}
