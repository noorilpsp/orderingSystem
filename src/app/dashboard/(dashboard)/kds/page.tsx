"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { useLocation } from "@/lib/contexts/LocationContext";
import { useMerchantKdsEnabled } from "@/lib/hooks/useMerchantKdsEnabled";
import { StationSettingsPanel } from "@/components/kds/station-settings-panel";
import { Button } from "@/components/ui/button";

export default function DashboardKdsSettingsPage() {
  const router = useRouter();
  const { currentLocationId, loading } = useLocation();
  const { kdsEnabled, loading: merchantLoading } = useMerchantKdsEnabled();

  useEffect(() => {
    if (!merchantLoading && !kdsEnabled) {
      router.replace("/dashboard");
    }
  }, [kdsEnabled, merchantLoading, router]);

  if (merchantLoading || !kdsEnabled) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Configure kitchen display stations and lanes for the selected location.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/kds" target="_blank" rel="noopener noreferrer">
            Open KDS
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
      <StationSettingsPanel locationId={currentLocationId} locationLoading={loading} />
    </div>
  );
}
