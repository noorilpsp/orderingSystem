"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { usePublicMenu } from "@/lib/contexts/PublicMenuContext";

/**
 * Guest ordering canvas - full-bleed on all breakpoints.
 * Soft banner blur sits behind content on tablet/desktop without covering
 * the liquid-glass page gradients.
 */
export function GuestPhoneShell({ children }: { children: ReactNode }) {
  const { restaurant } = usePublicMenu();
  const bannerUrl = restaurant?.bannerUrl?.trim() || null;

  return (
    <div className="guest-phone-shell relative min-h-dvh w-full">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden md:block"
      >
        {bannerUrl ? (
          <Image
            src={bannerUrl}
            alt=""
            fill
            className="guest-phone-atmosphere-image scale-110 object-cover opacity-25 blur-3xl saturate-[1.1]"
            sizes="100vw"
          />
        ) : null}
      </div>

      <div className="guest-phone-frame relative min-h-dvh w-full bg-transparent">
        {children}
      </div>
    </div>
  );
}
