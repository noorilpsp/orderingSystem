"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift, Receipt, User, UtensilsCrossed } from "lucide-react";
import { usePublicMenu } from "@/lib/contexts/PublicMenuContext";
import { guestStorePath } from "@/lib/public-menu/guestMenuPaths";
import { readGuestActiveOrders } from "@/lib/public-menu/guest-active-order-storage";
import { cn } from "@/lib/utils";
import { useGuestT } from "@/lib/guest-i18n";
import type { EnMessageKey } from "@/lib/guest-i18n";

type GuestTab = {
  id: "menu" | "rewards" | "orders" | "account";
  labelKey: EnMessageKey;
  href: string;
  icon: typeof UtensilsCrossed;
  showDot: boolean;
};

/** Focused flows own the bottom edge with their own CTA, so tabs step aside. */
const HIDDEN_ON_SEGMENTS = ["checkout", "order-confirmation"];

function activeTabFor(pathname: string, storeSlug: string): GuestTab["id"] {
  const base = guestStorePath(storeSlug);
  if (pathname.startsWith(`${base}/rewards`)) return "rewards";
  if (pathname.startsWith(`${base}/orders`)) return "orders";
  if (pathname.startsWith(`${base}/account`)) return "account";
  return "menu";
}

export function GuestTabBar() {
  const {
    storeSlug,
    menuPath,
    rewardsPath,
    ordersPath,
    accountPath,
    rewards,
    loyaltyPoints,
    customer,
    refetchOrderHistory,
  } = usePublicMenu();
  const t = useGuestT();
  const pathname = usePathname() ?? "";
  const [hasActiveOrder, setHasActiveOrder] = useState(false);

  const lastSegment = pathname.split("/").filter(Boolean).pop() ?? "";
  const hidden = HIDDEN_ON_SEGMENTS.includes(lastSegment);

  useEffect(() => {
    if (hidden) return;
    setHasActiveOrder(readGuestActiveOrders(storeSlug).length > 0);
  }, [hidden, pathname, storeSlug]);

  useEffect(() => {
    if (hidden || !customer) return;
    void refetchOrderHistory();
  }, [customer, hidden, refetchOrderHistory]);

  // Lets fixed elements (cart CTA, toasts) sit above the bar instead of under it.
  useEffect(() => {
    const root = document.documentElement;
    const clear = () => {
      root.style.removeProperty("--guest-tab-bar-height");
      root.style.removeProperty("--guest-bottom-bar-safe-pad");
      root.style.removeProperty("--guest-tab-bar-pad-top");
      root.style.removeProperty("--guest-tab-bar-pad-bottom");
    };
    if (hidden) {
      clear();
      return;
    }
    root.style.setProperty(
      "--guest-tab-bar-height",
      "calc(4rem + env(safe-area-inset-bottom))",
    );
    root.style.setProperty("--guest-tab-bar-pad-top", "0px");
    root.style.setProperty(
      "--guest-tab-bar-pad-bottom",
      "calc(4rem + env(safe-area-inset-bottom))",
    );
    root.style.setProperty("--guest-bottom-bar-safe-pad", "0px");
    return clear;
  }, [hidden]);

  if (hidden) return null;

  const affordableRewards = rewards.filter(
    (reward) => reward.pointsCost <= (loyaltyPoints ?? 0),
  ).length;

  const tabs: GuestTab[] = [
    {
      id: "menu",
      labelKey: "nav.menu",
      href: menuPath,
      icon: UtensilsCrossed,
      showDot: false,
    },
    {
      id: "rewards",
      labelKey: "nav.rewards",
      href: rewardsPath,
      icon: Gift,
      showDot: affordableRewards > 0,
    },
    {
      id: "orders",
      labelKey: "nav.orders",
      href: ordersPath,
      icon: Receipt,
      showDot: hasActiveOrder,
    },
    {
      id: "account",
      labelKey: "nav.account",
      href: accountPath,
      icon: User,
      showDot: !customer,
    },
  ];

  const active = activeTabFor(pathname, storeSlug);

  return (
    <nav
      aria-label={t("nav.aria")}
      className="fixed inset-x-0 bottom-0 z-(--z-tab-bar)"
    >
      <div className="mx-auto w-full max-w-none pb-[env(safe-area-inset-bottom)]">
        <ul className="liquid-glass flex h-16 items-stretch border-t border-border/70 bg-card/90 backdrop-blur-xl">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            return (
              <li key={tab.id} className="flex-1">
                <Link
                  href={tab.href}
                  prefetch
                  aria-current={isActive ? "page" : undefined}
                  onMouseEnter={
                    tab.id === "orders" ? () => void refetchOrderHistory() : undefined
                  }
                  onFocus={
                    tab.id === "orders" ? () => void refetchOrderHistory() : undefined
                  }
                  className={cn(
                    "flex h-full w-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="relative">
                    <Icon
                      className={cn("h-5 w-5", isActive && "text-primary")}
                      strokeWidth={isActive ? 2.4 : 1.8}
                    />
                    {tab.showDot ? (
                      <span
                        className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-card"
                        aria-hidden
                      />
                    ) : null}
                  </span>
                  <span>{t(tab.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
