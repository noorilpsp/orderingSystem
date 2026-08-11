"use client";

import type { ReactNode } from "react";

type GuestTabPageProps = {
  title: string;
  subtitle?: string | null;
  headerSlot?: ReactNode;
  children: ReactNode;
};

/** Shared frame for the guest bottom-tab destinations (rewards, orders, account). */
export function GuestTabPage({
  title,
  subtitle,
  headerSlot,
  children,
}: GuestTabPageProps) {
  return (
    <div
      className="min-h-screen"
      style={{
        paddingTop: "var(--guest-tab-bar-pad-top, 0px)",
        paddingBottom: "calc(2rem + var(--guest-tab-bar-pad-bottom, var(--guest-tab-bar-height, 0rem)))",
      }}
    >
      <header className="sticky top-0 z-(--z-sticky) border-b border-border/70 bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-none items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground">{title}</h1>
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {headerSlot}
        </div>
      </header>

      <main className="mx-auto w-full max-w-none space-y-4 px-4 py-4 lg:px-8">
        {children}
      </main>
    </div>
  );
}
