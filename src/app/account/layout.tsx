import type { ReactNode } from "react";
import { GuestLocaleProvider } from "@/lib/guest-i18n";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <GuestLocaleProvider defaultLocale="en">
      <div className="min-h-dvh bg-gradient-to-b from-background via-background to-muted/30 text-foreground">
        {children}
      </div>
    </GuestLocaleProvider>
  );
}
