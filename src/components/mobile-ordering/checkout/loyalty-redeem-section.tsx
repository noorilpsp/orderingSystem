"use client";

import { useEffect, useMemo, useState } from "react";
import { Gift, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  maxRedeemablePoints,
  pointsToDiscountAmount,
  type LoyaltySettings,
} from "@/lib/db/schema/merchants";
import type { PublicMenuReward } from "@/lib/public-menu/types";
import { useGuestLocalization } from "@/lib/hooks/useGuestLocalization";

export type LoyaltyRedeemSelection = {
  rewardId: string | null;
  pointsToRedeem: number;
};

type LoyaltyRedeemSectionProps = {
  balance: number;
  subtotal: number;
  loyaltySettings: Pick<
    LoyaltySettings,
    "enabled" | "redeemPointsPerDollarOff" | "allowOpenWalletRedeem"
  >;
  rewards: PublicMenuReward[];
  selection: LoyaltyRedeemSelection;
  onSelectionChange: (next: LoyaltyRedeemSelection) => void;
};

function previewRewardDiscount(
  reward: PublicMenuReward,
  subtotal: number,
  formatMoney: (amount: number) => string,
): { label: string; amount: number } {
  switch (reward.kind) {
    case "fixed_off": {
      const amount = Math.min(Number(reward.discountAmount ?? 0), subtotal);
      return { label: `−${formatMoney(amount)} off`, amount };
    }
    case "percent_off": {
      const raw = (subtotal * (reward.percentOff ?? 0)) / 100;
      const amount = Math.min(
        raw,
        Number(reward.maxDiscountAmount ?? 0),
        subtotal,
      );
      return { label: `−${formatMoney(amount)} off`, amount };
    }
    case "free_item":
      return {
        label: reward.menuItemName
          ? `Free: ${reward.menuItemName}`
          : "Free menu item",
        amount: 0,
      };
    default: {
      const _exhaustive: never = reward.kind;
      return _exhaustive;
    }
  }
}

export function LoyaltyRedeemSection({
  balance,
  subtotal,
  loyaltySettings,
  rewards,
  selection,
  onSelectionChange,
}: LoyaltyRedeemSectionProps) {
  const { formatMoney } = useGuestLocalization();
  const allowWallet = loyaltySettings.allowOpenWalletRedeem !== false;
  const affordableRewards = useMemo(
    () => rewards.filter((reward) => reward.pointsCost <= balance),
    [balance, rewards],
  );

  const normalizedSettings = useMemo(
    () => ({
      enabled: loyaltySettings.enabled !== false,
      pointsScope: "location" as const,
      pointsPerDollar: 10,
      redeemPointsPerDollarOff:
        typeof loyaltySettings.redeemPointsPerDollarOff === "number" &&
        loyaltySettings.redeemPointsPerDollarOff > 0
          ? Math.floor(loyaltySettings.redeemPointsPerDollarOff)
          : 10,
      allowOpenWalletRedeem: allowWallet,
    }),
    [allowWallet, loyaltySettings],
  );

  const maxPoints = maxRedeemablePoints(balance, subtotal, normalizedSettings);
  const walletDiscount = pointsToDiscountAmount(
    selection.pointsToRedeem,
    normalizedSettings,
  );
  const selectedReward =
    affordableRewards.find((reward) => reward.id === selection.rewardId) ?? null;
  const rewardPreview = selectedReward
    ? previewRewardDiscount(selectedReward, subtotal, formatMoney)
    : null;

  const [useWallet, setUseWallet] = useState(
    allowWallet && selection.pointsToRedeem > 0,
  );

  useEffect(() => {
    if (!allowWallet && selection.pointsToRedeem > 0) {
      onSelectionChange({ rewardId: selection.rewardId, pointsToRedeem: 0 });
      setUseWallet(false);
    }
  }, [allowWallet, onSelectionChange, selection.pointsToRedeem, selection.rewardId]);

  useEffect(() => {
    if (!useWallet && selection.pointsToRedeem > 0 && !selection.rewardId) {
      onSelectionChange({ rewardId: null, pointsToRedeem: 0 });
    }
  }, [onSelectionChange, selection.pointsToRedeem, selection.rewardId, useWallet]);

  if (!normalizedSettings.enabled || balance <= 0) {
    return null;
  }

  const showCatalog = affordableRewards.length > 0;
  const showWallet = allowWallet && maxPoints > 0;
  if (!showCatalog && !showWallet) {
    return null;
  }

  const selectReward = (rewardId: string) => {
    setUseWallet(false);
    onSelectionChange({
      rewardId: selection.rewardId === rewardId ? null : rewardId,
      pointsToRedeem: 0,
    });
  };

  const handleWalletToggle = (checked: boolean) => {
    setUseWallet(checked);
    if (!checked) {
      onSelectionChange({ rewardId: selection.rewardId, pointsToRedeem: 0 });
      return;
    }
    onSelectionChange({ rewardId: null, pointsToRedeem: maxPoints });
  };

  const handleWalletInput = (raw: string) => {
    const parsed = Math.floor(Number(raw));
    if (!Number.isFinite(parsed) || parsed < 0) {
      onSelectionChange({ rewardId: null, pointsToRedeem: 0 });
      return;
    }
    onSelectionChange({
      rewardId: null,
      pointsToRedeem: Math.min(parsed, maxPoints),
    });
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm backdrop-blur-md">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-orange-500" />
          <p className="text-base font-semibold text-foreground">Loyalty & rewards</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Balance: {balance.toLocaleString()} pts · use a reward or points (not both)
        </p>
      </div>

      {showCatalog ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Rewards
          </p>
          <ul className="space-y-2">
            {affordableRewards.map((reward) => {
              const selected = selection.rewardId === reward.id;
              return (
                <li key={reward.id}>
                  <button
                    type="button"
                    onClick={() => selectReward(reward.id)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      selected
                        ? "border-orange-500/70 bg-orange-500/10"
                        : "border-border/60 bg-background/50 hover:border-border"
                    }`}
                  >
                    <Gift className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">
                        {reward.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {reward.summary} · {reward.pointsCost.toLocaleString()} pts
                      </span>
                    </span>
                    <span
                      className={`mt-1 h-4 w-4 shrink-0 rounded-full border ${
                        selected
                          ? "border-orange-500 bg-orange-500"
                          : "border-muted-foreground/40"
                      }`}
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
          </ul>
          {rewardPreview ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {rewardPreview.label}
            </p>
          ) : null}
        </div>
      ) : null}

      {showWallet ? (
        <div className="space-y-3 border-t border-border/50 pt-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Open points</p>
              <p className="text-xs text-muted-foreground">
                Up to {maxPoints.toLocaleString()} pts on this order
              </p>
            </div>
            <Switch
              checked={useWallet && selection.pointsToRedeem > 0}
              onCheckedChange={handleWalletToggle}
              aria-label="Use open loyalty points"
            />
          </div>
          {useWallet || selection.pointsToRedeem > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="loyalty-points-redeem">Points to redeem</Label>
              <Input
                id="loyalty-points-redeem"
                type="number"
                min={0}
                max={maxPoints}
                step={1}
                value={selection.pointsToRedeem}
                onChange={(event) => handleWalletInput(event.target.value)}
              />
              {selection.pointsToRedeem > 0 ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  −{formatMoney(walletDiscount)} off this order
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
