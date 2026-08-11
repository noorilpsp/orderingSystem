"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { writeSelectedRewardId } from "@/lib/public-menu/guest-reward-storage";
import type { PublicLoyaltyReward } from "@/lib/loyalty/listActivePublicLoyaltyRewards";

type AccountRewardsPanelProps = {
  storeSlug: string;
  balance: number;
  rewards: PublicLoyaltyReward[];
};

export function AccountRewardsPanel({
  storeSlug,
  balance,
  rewards,
}: AccountRewardsPanelProps) {
  const router = useRouter();

  if (rewards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No rewards available at this restaurant yet.
      </p>
    );
  }

  const handleUse = (rewardId: string) => {
    writeSelectedRewardId(storeSlug, rewardId);
    toast.success("Reward saved — add items, then apply at checkout");
    router.push(`/menu/${storeSlug}`);
  };

  return (
    <ul className="space-y-3">
      {rewards.map((reward) => {
        const canAfford = balance >= reward.pointsCost;
        return (
          <li
            key={reward.id}
            className="rounded-xl border border-border/60 bg-background/60 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{reward.name}</p>
                <p className="text-sm text-muted-foreground">{reward.summary}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {reward.pointsCost.toLocaleString()} pts
                  {!canAfford ? " · Not enough points" : ""}
                </p>
              </div>
              <Button
                size="sm"
                disabled={!canAfford}
                onClick={() => handleUse(reward.id)}
              >
                Use at checkout
              </Button>
            </div>
            <Link
              href={`/menu/${storeSlug}`}
              className="mt-2 inline-block text-xs font-medium text-primary underline"
            >
              Open menu
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
