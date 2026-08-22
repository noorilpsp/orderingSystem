"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_LOYALTY_SETTINGS,
  normalizeLoyaltySettings,
} from "@/lib/db/schema/merchants";
import { useTenant } from "@/lib/contexts/TenantContext";
import { toast } from "sonner";

export function LoyaltyProgramSettingsCard() {
  const { currentMerchantId, loading: tenantLoading } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [enabled, setEnabled] = useState(DEFAULT_LOYALTY_SETTINGS.enabled);
  const [pointsPerDollar, setPointsPerDollar] = useState(
    String(DEFAULT_LOYALTY_SETTINGS.pointsPerDollar),
  );
  const [redeemPointsPerDollarOff, setRedeemPointsPerDollarOff] = useState(
    String(DEFAULT_LOYALTY_SETTINGS.redeemPointsPerDollarOff),
  );
  const [allowOpenWalletRedeem, setAllowOpenWalletRedeem] = useState(
    DEFAULT_LOYALTY_SETTINGS.allowOpenWalletRedeem,
  );
  const [pointsExpirationMonths, setPointsExpirationMonths] = useState(
    String(DEFAULT_LOYALTY_SETTINGS.pointsExpirationMonths),
  );

  const applySettings = useCallback((loyaltySettings: unknown) => {
    const normalized = normalizeLoyaltySettings(
      loyaltySettings as Parameters<typeof normalizeLoyaltySettings>[0],
    );
    setEnabled(normalized.enabled);
    setPointsPerDollar(String(normalized.pointsPerDollar));
    setRedeemPointsPerDollarOff(String(normalized.redeemPointsPerDollarOff));
    setAllowOpenWalletRedeem(normalized.allowOpenWalletRedeem);
    setPointsExpirationMonths(String(normalized.pointsExpirationMonths));
    setDirty(false);
  }, []);

  useEffect(() => {
    if (!currentMerchantId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const response = await fetch(`/api/merchants/${encodeURIComponent(currentMerchantId)}`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to load loyalty settings");
        const merchant = await response.json();
        if (!cancelled) applySettings(merchant.loyaltySettings);
      } catch (error) {
        console.error("[LoyaltyProgramSettingsCard]", error);
        if (!cancelled) toast.error("Could not load loyalty program settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySettings, currentMerchantId]);

  const handleSave = async () => {
    if (!currentMerchantId) {
      toast.error("No merchant selected");
      return;
    }
    const earnRate = Math.floor(Number(pointsPerDollar));
    const redeemRate = Math.floor(Number(redeemPointsPerDollarOff));
    const expirationMonths = Math.floor(Number(pointsExpirationMonths));
    if (!Number.isFinite(earnRate) || earnRate < 1) {
      toast.error("Earn rate must be at least 1 point per dollar");
      return;
    }
    if (!Number.isFinite(redeemRate) || redeemRate < 1) {
      toast.error("Redeem rate must be at least 1 point per dollar off");
      return;
    }
    if (!Number.isFinite(expirationMonths) || expirationMonths < 0) {
      toast.error("Expiration must be 0 or more months");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/merchants/${encodeURIComponent(currentMerchantId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          loyaltySettings: {
            enabled,
            pointsScope: "location",
            pointsPerDollar: earnRate,
            redeemPointsPerDollarOff: redeemRate,
            allowOpenWalletRedeem,
            pointsExpirationMonths: expirationMonths,
          },
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to save loyalty settings");
      }
      const merchant = await response.json();
      applySettings(merchant.loyaltySettings);
      toast.success("Loyalty program settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-orange-600" />
          <CardTitle>Program settings</CardTitle>
        </div>
        <CardDescription>
          Earn and redeem settings for this store.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {tenantLoading || loading ? (
          <Skeleton className="h-32 w-full" />
        ) : !currentMerchantId ? (
          <p className="text-sm text-muted-foreground">Select a merchant to configure loyalty.</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="loyalty-program-enabled" className="text-base">
                  Enable loyalty points
                </Label>
                <p className="text-sm text-muted-foreground">
                  Signed-in guests earn points when orders are completed.
                </p>
              </div>
              <Switch
                id="loyalty-program-enabled"
                checked={enabled}
                onCheckedChange={(checked) => {
                  setEnabled(checked);
                  setDirty(true);
                }}
              />
            </div>

            {enabled ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="loyalty-earn-rate">Earn rate</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="loyalty-earn-rate"
                        type="number"
                        min={1}
                        step={1}
                        value={pointsPerDollar}
                        onChange={(event) => {
                          setPointsPerDollar(event.target.value);
                          setDirty(true);
                        }}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">points per $1 spent</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loyalty-redeem-rate">Redeem rate</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="loyalty-redeem-rate"
                        type="number"
                        min={1}
                        step={1}
                        value={redeemPointsPerDollarOff}
                        onChange={(event) => {
                          setRedeemPointsPerDollarOff(event.target.value);
                          setDirty(true);
                        }}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">points = $1 off</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border p-4">
                  <Label htmlFor="loyalty-expiration-months">Points expiration</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="loyalty-expiration-months"
                      type="number"
                      min={0}
                      step={1}
                      value={pointsExpirationMonths}
                      onChange={(event) => {
                        setPointsExpirationMonths(event.target.value);
                        setDirty(true);
                      }}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">
                      months after earning (0 = never expire)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Oldest points are spent first when guests redeem. Expired points are removed
                    automatically.
                  </p>
                </div>
                <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <Label htmlFor="loyalty-wallet-redeem" className="text-base">
                      Allow open points → $ off
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      When on, guests can spend any amount of points at the redeem rate above.
                      When off, only catalog rewards apply.
                    </p>
                  </div>
                  <Switch
                    id="loyalty-wallet-redeem"
                    checked={allowOpenWalletRedeem}
                    onCheckedChange={(checked) => {
                      setAllowOpenWalletRedeem(checked);
                      setDirty(true);
                    }}
                  />
                </div>

                <p className="text-sm text-muted-foreground">
                  Guests apply points or rewards at checkout when signed in (pickup, delivery, and
                  counter orders).
                </p>
              </>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleSave} disabled={!dirty || saving} className="gap-2">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Save program settings
                  </>
                )}
              </Button>
              {dirty ? (
                <span className="text-sm text-amber-600">Unsaved changes</span>
              ) : (
                <span className="text-sm text-muted-foreground">All changes saved</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function LoyaltySampleDataBanner() {
  return (
    <div className="mb-6 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      Sample data below - program settings above are live.
    </div>
  );
}
