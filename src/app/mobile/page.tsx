"use client";

import { StaticDemoMenuProvider } from "@/lib/contexts/PublicMenuContext";
import { GuestMenuPage } from "@/components/mobile-ordering/guest-menu-page";

export default function MobileMenuPage() {
  return (
    <StaticDemoMenuProvider>
      <GuestMenuPage />
    </StaticDemoMenuProvider>
  );
}
