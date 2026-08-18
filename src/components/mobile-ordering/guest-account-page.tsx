"use client";

import Link from "next/link";
import {
  ChevronRight,
  Gift,
  Globe,
  LogIn,
  LogOut,
  Receipt,
  Settings,
  User,
} from "lucide-react";
import { GuestTabPage } from "@/components/mobile-ordering/guest-tab-page";
import { usePublicMenu } from "@/lib/contexts/PublicMenuContext";
import { useGuestT } from "@/lib/guest-i18n";

export function GuestAccountPage() {
  const t = useGuestT();
  const {
    storeSlug,
    restaurant,
    customer,
    customerLoading,
    loyaltyPoints,
    loyaltySettings,
    rewardsPath,
    ordersPath,
    accountLoginPath,
    accountSignupPath,
    logoutCustomer,
  } = usePublicMenu();

  const settingsHref = `/menu/${encodeURIComponent(storeSlug)}/account/settings`;

  const links = [
    ...(customer
      ? [
          {
            href: settingsHref,
            labelKey: "account.settingsTitle" as const,
            icon: Settings,
          },
        ]
      : []),
    { href: rewardsPath, labelKey: "nav.rewards" as const, icon: Gift },
    { href: ordersPath, labelKey: "account.orderHistory" as const, icon: Receipt },
    {
      href: `/account?store=${encodeURIComponent(storeSlug)}`,
      labelKey: "account.allRestaurants" as const,
      icon: Globe,
    },
  ];

  return (
    <GuestTabPage title={t("account.title")} subtitle={restaurant?.name ?? null}>
      {customerLoading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-muted/60" />
      ) : customer ? (
        <section className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
              <User className="h-5 w-5 text-muted-foreground" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">
                {customer.name}
              </p>
              <p className="truncate text-sm text-muted-foreground">{customer.email}</p>
            </div>
          </div>

          {loyaltySettings?.enabled && typeof loyaltyPoints === "number" ? (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-border/60 bg-background/50 px-3 py-2.5">
              <span className="text-sm text-muted-foreground">
                {t("account.pointsHere", {
                  name: restaurant?.name ?? t("account.thisRestaurant"),
                })}
              </span>
              <span className="text-sm font-semibold text-foreground">
                {loyaltyPoints.toLocaleString()} {t("common.points")}
              </span>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-border/70 bg-card/70 p-5 text-center shadow-sm backdrop-blur-md">
          <User className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-base font-semibold text-foreground">
            {t("account.signInTo", { name: restaurant?.name ?? t("account.thisRestaurant") })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("account.signInHintLong")}
          </p>
          <Link
            href={accountLoginPath}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
          >
            <LogIn className="h-4 w-4" />
            {t("account.signIn")}
          </Link>
          <Link
            href={accountSignupPath}
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl border border-border/70 text-sm font-semibold text-foreground"
          >
            {t("account.createAccount")}
          </Link>
        </section>
      )}

      <nav className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-sm backdrop-blur-md">
        <ul className="divide-y divide-border/60">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-foreground hover:bg-foreground/5"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1">{t(link.labelKey)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {customer ? (
        <button
          type="button"
          onClick={() => {
            void logoutCustomer();
          }}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-rose-400/50 bg-rose-500/15 text-sm font-semibold text-rose-800 hover:bg-rose-500/25 dark:text-rose-200"
        >
          <LogOut className="h-4 w-4" />
          {t("account.signOut")}
        </button>
      ) : null}
    </GuestTabPage>
  );
}
