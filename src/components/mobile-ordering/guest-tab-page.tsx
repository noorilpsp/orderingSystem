"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type GuestTabPageProps = {
  title: string;
  subtitle?: string | null;
  headerSlot?: ReactNode;
  /** When set, shows a back control that navigates here. */
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
};

/** Shared frame for the guest bottom-tab destinations (rewards, orders, account). */
export function GuestTabPage({
  title,
  subtitle,
  headerSlot,
  backHref,
  backLabel,
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
          <div className="flex min-w-0 items-center gap-2">
            {backHref ? (
              <Link
                href={backHref}
                aria-label={backLabel ?? "Back"}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-foreground/10"
              >
                <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
              </Link>
            ) : null}
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground">{title}</h1>
              {subtitle ? (
                <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
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
