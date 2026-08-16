import { GuestPhoneShell } from "@/components/mobile-ordering/guest-phone-shell";
import { GuestTabBar } from "@/components/mobile-ordering/guest-tab-bar";
import { MobileOrderingLayout } from "@/components/mobile-ordering/mobile-ordering-layout";
import { getCachedPublicMenuView } from "@/lib/public-menu/publicMenuCache";
import { PublicMenuStoreProvider } from "./public-menu-store-provider";

export default async function PublicMenuLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const initialView = await getCachedPublicMenuView(storeSlug);

  return (
    <MobileOrderingLayout>
      <PublicMenuStoreProvider storeSlug={storeSlug} initialView={initialView}>
        <GuestPhoneShell>{children}</GuestPhoneShell>
        <GuestTabBar />
      </PublicMenuStoreProvider>
    </MobileOrderingLayout>
  );
}
