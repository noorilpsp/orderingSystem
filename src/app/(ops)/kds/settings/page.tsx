"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentLocationId } from "@/app/actions/location";
import { DisplayModeProvider } from "@/components/kds/DisplayModeContext";
import { StationSettingsPanel } from "@/components/kds/station-settings-panel";
import { useMerchantKdsEnabled } from "@/lib/hooks/useMerchantKdsEnabled";

function StationSettingsContent() {
  const [locationId, setLocationId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentLocationId().then(setLocationId);
  }, []);

  return (
    <StationSettingsPanel
      locationId={locationId}
      backHref="/kds"
      backAriaLabel="Back to KDS"
    />
  );
}

export default function KdsStationSettingsPage() {
  const router = useRouter();
  const { kdsEnabled, loading } = useMerchantKdsEnabled();

  useEffect(() => {
    if (!loading && !kdsEnabled) {
      router.replace("/orders");
    }
  }, [kdsEnabled, loading, router]);

  if (loading || !kdsEnabled) {
    return null;
  }

  return (
    <DisplayModeProvider>
      <div className="min-h-screen">
        <StationSettingsContent />
      </div>
    </DisplayModeProvider>
  );
}
