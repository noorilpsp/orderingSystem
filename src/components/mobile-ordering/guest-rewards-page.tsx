"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Gift, Lock, LogIn, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { GuestTabPage } from "@/components/mobile-ordering/guest-tab-page";
import { usePublicMenu } from "@/lib/contexts/PublicMenuContext";
import type { PublicMenuReward } from "@/lib/public-menu/types";
import type { GuestMenuItem, GuestRestaurant } from "@/lib/guest-menu/types";
import { findRewardInCart } from "@/lib/public-menu/guest-reward-cart";
import {
  computeRewardGoodThroughDate,
  formatGoodThroughLabel,
} from "@/lib/loyalty/loyaltyPointLots";
import { useGuestT } from "@/lib/guest-i18n";

function getRewardImageUrl(
  reward: PublicMenuReward,
  items: GuestMenuItem[],
  restaurant: GuestRestaurant | null,
): string {
  if (reward.menuItemId) {
    const menuItem = items.find((item) => item.id === reward.menuItemId);
    if (menuItem?.image) return menuItem.image;
  }
  if (restaurant?.logoUrl) return restaurant.logoUrl;
  return "/placeholder.svg";
}

export function GuestRewardsPage() {
  const router = useRouter();
  const t = useGuestT();
  const {
    storeSlug,
    restaurant,
    rewards,
    items,
    loyaltySettings,
    loyaltyPoints,
    loyaltyPointLots,
    customer,
    customerLoading,
    cart,
    addRewardToCart,
    removeFromCart,
    menuPath,
    accountLoginPath,
  } = usePublicMenu();

  const [modalRewardId, setModalRewardId] = useState<string | null>(null);
  const selectedRewardId = findRewardInCart(cart)?.rewardId ?? null;

  const balance = loyaltyPoints ?? 0;
  const programOff = loyaltySettings?.enabled === false;
  const modalReward = modalRewardId
    ? rewards.find((reward) => reward.id === modalRewardId) ?? null
    : null;

  const handleAddToCart = (reward: PublicMenuReward) => {
    addRewardToCart(reward);
    setModalRewardId(null);
    toast.success(t("rewards.addedToCart"));
    router.push(menuPath);
  };

  const handleClear = () => {
    const rewardLine = findRewardInCart(cart);
    if (rewardLine) {
      removeFromCart(rewardLine.id);
    }
    toast.success(t("rewards.removedFromCart"));
    setModalRewardId(null);
  };

  const pointsHeader =
    !programOff && customer ? (
      <p className="shrink-0 text-lg font-bold tabular-nums text-foreground">
        {balance.toLocaleString()} {t("common.points")}
      </p>
    ) : null;

  const itemImageById = useMemo(
    () => new Map(items.map((item) => [item.id, item.image])),
    [items],
  );

  const getRewardCardImage = (reward: PublicMenuReward) => {
    const imageUrl =
      (reward.menuItemId && itemImageById.get(reward.menuItemId)) ||
      getRewardImageUrl(reward, items, restaurant);
    const showDiscountFallback =
      reward.kind !== "free_item" && !reward.menuItemId;
    return { imageUrl, showDiscountFallback };
  };

  const modalCanAfford =
    !!modalReward && !!customer && balance >= modalReward.pointsCost;
  const modalIsSelected =
    !!modalReward && selectedRewardId === modalReward.id;
  const modalImage = modalReward ? getRewardCardImage(modalReward) : null;
  const modalGoodThrough =
    modalReward && customer && modalCanAfford && loyaltyPointLots
      ? computeRewardGoodThroughDate(loyaltyPointLots, modalReward.pointsCost)
      : null;
  const modalGoodThroughLabel = modalGoodThrough
    ? formatGoodThroughLabel(modalGoodThrough)
    : null;

  return (
    <GuestTabPage
      title={t("rewards.title")}
      subtitle={restaurant?.name ?? null}
      headerSlot={pointsHeader}
    >
      {programOff ? (
        <p className="rounded-2xl border border-border/70 bg-card/70 p-4 text-sm text-muted-foreground shadow-sm">
          {t("rewards.programOff")}
        </p>
      ) : customerLoading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-muted/60" />
      ) : !customer ? (
        <section className="rounded-2xl border border-border/70 bg-card/70 p-5 text-center shadow-sm backdrop-blur-md">
          <Sparkles className="mx-auto h-6 w-6 text-orange-500" />
          <p className="mt-2 text-base font-semibold text-foreground">
            {t("rewards.earnTitle")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("rewards.signInTitle", {
              name: restaurant?.name ?? t("account.thisRestaurant"),
            })}
          </p>
          <Link
            href={accountLoginPath}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
          >
            <LogIn className="h-4 w-4" />
            {t("rewards.signInCta")}
          </Link>
        </section>
      ) : null}

      {!programOff && rewards.length > 0 ? (
        <section className="space-y-2">
          <div className="px-1">
            <p className="text-xl font-bold text-foreground">
              {t("rewards.redeemForPoints")}
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4 lg:gap-6 xl:grid-cols-5">
            {rewards.map((reward) => {
              const canAfford = !!customer && balance >= reward.pointsCost;
              const isSelected = selectedRewardId === reward.id;
              const { imageUrl, showDiscountFallback } = getRewardCardImage(reward);

              return (
                <li key={reward.id}>
                  <button
                    type="button"
                    onClick={() => setModalRewardId(reward.id)}
                    className={`flex w-full flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition active:scale-[0.98] ${
                      isSelected
                        ? "border-orange-500 ring-2 ring-orange-500/30"
                        : "border-border/70"
                    } ${!canAfford && customer ? "opacity-80" : ""}`}
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-muted md:aspect-[4/3]">
                      {showDiscountFallback ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-linear-to-br from-orange-500/15 to-amber-500/25 px-3 text-center">
                          <Gift className="h-8 w-8 text-orange-500 md:h-6 md:w-6" />
                          <p className="text-xs font-semibold text-foreground md:text-[11px]">
                            {reward.summary}
                          </p>
                        </div>
                      ) : (
                        <img
                          src={imageUrl}
                          alt={reward.menuItemName ?? reward.name}
                          className={`h-full w-full object-cover ${
                            !canAfford && customer ? "grayscale" : ""
                          }`}
                        />
                      )}

                      <div className="absolute inset-x-0 bottom-0 bg-black/20 px-2 py-1.5 text-center backdrop-blur-[2px]">
                        <p className="inline-flex items-center justify-center gap-1 text-sm font-bold tabular-nums text-white drop-shadow-sm md:text-xs">
                          {customer && !canAfford ? (
                            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          ) : null}
                          {reward.pointsCost.toLocaleString()} pts
                        </p>
                      </div>

                      {isSelected ? (
                        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-col p-3 md:p-2.5">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground md:text-[13px]">
                        {reward.name}
                      </p>
                      {!showDiscountFallback ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground md:mt-0.5 md:line-clamp-1">
                          {reward.summary}
                        </p>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : !programOff ? (
        <p className="rounded-2xl border border-border/70 bg-card/70 p-4 text-sm text-muted-foreground shadow-sm">
          {t("rewards.noPublished")}
        </p>
      ) : null}

      <Dialog open={modalReward != null} onOpenChange={(open) => !open && setModalRewardId(null)}>
        <DialogContent className="bottom-0 top-auto max-h-[90vh] max-w-md translate-x-[-50%] translate-y-0 gap-0 overflow-hidden rounded-t-3xl border-border/80 bg-card p-0 text-foreground shadow-2xl data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:max-w-md">
          {modalReward && modalImage ? (
            <>
              <div className="relative aspect-4/3 w-full overflow-hidden bg-muted">
                {modalImage.showDiscountFallback ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-linear-to-br from-orange-500/15 to-amber-500/25 px-6 text-center">
                    <Gift className="h-12 w-12 text-orange-500" />
                    <p className="text-sm font-semibold text-foreground">
                      {modalReward.summary}
                    </p>
                  </div>
                ) : (
                  <img
                    src={modalImage.imageUrl}
                    alt={modalReward.menuItemName ?? modalReward.name}
                    className={`h-full w-full object-cover ${
                      customer && !modalCanAfford ? "grayscale" : ""
                    }`}
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/20 px-3 py-2 text-center backdrop-blur-[2px]">
                  <p className="inline-flex items-center justify-center gap-1.5 text-base font-bold tabular-nums text-white drop-shadow-sm">
                    {customer && !modalCanAfford ? (
                      <Lock className="h-4 w-4 shrink-0" aria-hidden />
                    ) : null}
                    {modalReward.pointsCost.toLocaleString()} pts
                  </p>
                </div>
              </div>

              <div className="space-y-3 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
                <div>
                  <DialogTitle className="text-xl font-bold text-foreground">
                    {modalReward.name}
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-sm text-muted-foreground">
                    {modalReward.summary}
                  </DialogDescription>
                  {modalReward.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                      {modalReward.description}
                    </p>
                  ) : null}
                  {modalGoodThroughLabel ? (
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {modalGoodThroughLabel}
                    </p>
                  ) : null}
                </div>

                {customer && !modalCanAfford ? (
                  <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                    {t("rewards.needMore", {
                      points: (modalReward.pointsCost - balance).toLocaleString(),
                    })}
                  </p>
                ) : null}

                {!customer ? (
                  <Link
                    href={accountLoginPath}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                  >
                    <LogIn className="h-4 w-4" />
                    {t("rewards.signInToRedeem")}
                  </Link>
                ) : modalIsSelected ? (
                  <div className="flex flex-col gap-2">
                    <Button
                      className="h-11 w-full"
                      onClick={() => {
                        setModalRewardId(null);
                        router.push(menuPath);
                      }}
                    >
                      {t("rewards.goToMenu")}
                    </Button>
                    <Button className="h-11 w-full" variant="ghost" onClick={handleClear}>
                      {t("rewards.removeFromCart")}
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="h-11 w-full"
                    disabled={!modalCanAfford}
                    onClick={() => handleAddToCart(modalReward)}
                  >
                    {t("rewards.addToCart")}
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </GuestTabPage>
  );
}
