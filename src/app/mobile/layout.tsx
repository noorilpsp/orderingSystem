import type { ReactNode } from "react";
import { MobileOrderingLayout } from "@/components/mobile-ordering/mobile-ordering-layout";
import { GuestLocaleProvider } from "@/lib/guest-i18n";

export default function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <MobileOrderingLayout>
      <GuestLocaleProvider defaultLocale="en">{children}</GuestLocaleProvider>
    </MobileOrderingLayout>
  );
}
