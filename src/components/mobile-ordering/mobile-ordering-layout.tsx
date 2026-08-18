import type { ReactNode } from "react";
import { LiquidGlassPageClass } from "@/components/mobile-ordering/liquid-glass-page-class";

export function MobileOrderingLayout({ children }: { children: ReactNode }) {
  // Fonts come from the root layout (GeistSans / GeistMono CSS variables on <body>).
  return (
    <div className="mobile-ordering-root font-sans antialiased min-h-full">
      <LiquidGlassPageClass />
      {children}
    </div>
  );
}
