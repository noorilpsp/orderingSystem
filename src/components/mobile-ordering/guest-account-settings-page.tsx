"use client";

import Link from "next/link";
import { LogIn, User } from "lucide-react";
import { GuestTabPage } from "@/components/mobile-ordering/guest-tab-page";
import { GuestAccountSettings } from "@/components/mobile-ordering/guest-account-settings";
import { usePublicMenu } from "@/lib/contexts/PublicMenuContext";
import { useGuestT } from "@/lib/guest-i18n";

export function GuestAccountSettingsPage() {
  const t = useGuestT();
  const {
    storeSlug,
    restaurant,
    customer,
    customerLoading,
    accountPath,
    accountLoginPath,
    refetchCustomer,
  } = usePublicMenu();

  return (
    <GuestTabPage
      title={t("account.settingsTitle")}
      subtitle={restaurant?.name ?? null}
      backHref={accountPath}
      backLabel={t("account.title")}
    >
      {customerLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted/60" />
      ) : customer ? (
        <GuestAccountSettings
          email={customer.email}
          name={customer.name}
          storeSlug={storeSlug}
          onProfileSaved={async () => {
            await refetchCustomer();
          }}
        />
      ) : (
        <section className="rounded-2xl border border-border/70 bg-card/70 p-5 text-center shadow-sm backdrop-blur-md">
          <User className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-base font-semibold text-foreground">
            {t("account.signInTo", {
              name: restaurant?.name ?? t("account.thisRestaurant"),
            })}
          </p>
          <Link
            href={accountLoginPath}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
          >
            <LogIn className="h-4 w-4" />
            {t("account.signIn")}
          </Link>
        </section>
      )}
    </GuestTabPage>
  );
}
