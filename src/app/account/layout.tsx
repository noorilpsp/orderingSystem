import type { ReactNode } from "react";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-background via-background to-muted/30 text-foreground">
      {children}
    </div>
  );
}
