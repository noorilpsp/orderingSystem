import { GuestPhoneShell } from "@/components/mobile-ordering/guest-phone-shell";
import { GuestTabBar } from "@/components/mobile-ordering/guest-tab-bar";
import { MobileOrderingLayout } from "@/components/mobile-ordering/mobile-ordering-layout";
import { PublicMenuStoreProvider } from "./public-menu-store-provider";

export default async function PublicMenuLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;

  return (
    <MobileOrderingLayout>
      <PublicMenuStoreProvider storeSlug={storeSlug}>
        <GuestPhoneShell>{children}</GuestPhoneShell>
        <GuestTabBar />
      </PublicMenuStoreProvider>
    </MobileOrderingLayout>
  );
}
