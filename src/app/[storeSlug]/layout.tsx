import { notFound } from "next/navigation";
import { GuestPhoneShell } from "@/components/mobile-ordering/guest-phone-shell";
import {
  GuestStoreChrome,
  GuestStorePages,
} from "@/components/mobile-ordering/guest-store-chrome";
import { GuestTabBar } from "@/components/mobile-ordering/guest-tab-bar";
import { MobileOrderingLayout } from "@/components/mobile-ordering/mobile-ordering-layout";
import { isReservedStoreSlug, normalizeStoreSlug, STORE_SLUG_PATTERN } from "@/lib/public-menu/guestMenuPaths";
import { getCachedPublicMenuView } from "@/lib/public-menu/publicMenuCache";
import { PublicMenuStoreProvider } from "./public-menu-store-provider";

export default async function PublicMenuLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug: rawSlug } = await params;
  const storeSlug = normalizeStoreSlug(rawSlug);
  if (!storeSlug || !STORE_SLUG_PATTERN.test(storeSlug) || isReservedStoreSlug(storeSlug)) {
    notFound();
  }
  const initialView = await getCachedPublicMenuView(storeSlug);

  return (
    <MobileOrderingLayout>
      <PublicMenuStoreProvider storeSlug={storeSlug} initialView={initialView}>
        <GuestStoreChrome>
          <GuestPhoneShell>
            <GuestStorePages>{children}</GuestStorePages>
          </GuestPhoneShell>
          <GuestTabBar />
        </GuestStoreChrome>
      </PublicMenuStoreProvider>
    </MobileOrderingLayout>
  );
}
