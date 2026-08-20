"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { restaurant as staticRestaurant } from "@/lib/menu-data";
import { usePublicMenuOptional } from "@/lib/contexts/PublicMenuContext";
import { useGuestT } from "@/lib/guest-i18n";
import { cn } from "@/lib/utils";
import { isGuestRestaurantOpenNow } from "@/lib/public-menu/resolveActiveMenu";

interface HeroSectionProps {
  onInfoClick: () => void;
  topRightSlot?: ReactNode;
}

function storeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function HeroSection({ onInfoClick, topRightSlot }: HeroSectionProps) {
  const publicMenu = usePublicMenuOptional();
  const t = useGuestT();
  const restaurant = publicMenu?.restaurant ?? staticRestaurant;
  const bannerUrl = restaurant.bannerUrl?.trim() || null;
  const logoUrl = restaurant.logoUrl?.trim() || null;
  const [openNow, setOpenNow] = useState<boolean | null>(null);

  useEffect(() => {
    const update = () => {
      setOpenNow(
        isGuestRestaurantOpenNow(restaurant.hours, restaurant.timezone),
      );
    };
    update();
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, [restaurant.hours, restaurant.timezone]);

  return (
    <div className="relative">
      <div className="relative h-72 w-full md:h-52 lg:h-56">
        <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-slate-700 via-slate-600 to-slate-800">
          {bannerUrl ? (
            <Image
              src={bannerUrl}
              alt={`${restaurant.name} banner`}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 1200px"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/20 to-black/55" />
          <div className="absolute inset-0 bg-[radial-gradient(110%_70%_at_100%_0%,rgba(80,160,255,0.2),transparent_58%)]" />
        </div>

        {topRightSlot ? (
          <div className="absolute right-3 top-3 z-[var(--z-popover)] lg:right-6">
            {topRightSlot}
          </div>
        ) : null}

        <button
          type="button"
          onClick={onInfoClick}
          aria-label={t("info.openRestaurantInfo")}
          className="absolute inset-x-0 bottom-0 z-20 px-4 pb-4 text-start lg:px-6"
        >
          <div className="mx-auto w-full max-w-none space-y-3">
            <div className="flex items-center gap-3">
              <div className="logo-float flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/25 bg-white/10 shadow-[0_8px_22px_rgba(0,0,0,0.28)] backdrop-blur-sm md:h-[104px] md:w-[104px]">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt={`${restaurant.name} logo`}
                    width={104}
                    height={104}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold tracking-wide text-white md:text-2xl">
                    {storeInitials(restaurant.name)}
                  </span>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5">
                <div className="liquid-glass inline-flex max-w-full items-center rounded-full px-3 py-1.5 text-[15px] font-semibold text-white md:text-base lg:text-lg">
                  <span className="truncate">{restaurant.name}</span>
                </div>

                {restaurant.description ? (
                  <div className="liquid-glass inline-flex max-w-full rounded-full px-3 py-1.5 text-[13px] text-white/90">
                    <p className="max-w-full truncate">{restaurant.description}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex max-w-full items-center gap-2">
              {openNow != null ? (
                <div
                  className={cn(
                    "liquid-glass shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                    openNow ? "text-emerald-200" : "text-rose-200",
                  )}
                >
                  {openNow ? t("info.openNow") : t("info.closedNow")}
                </div>
              ) : null}
              {restaurant.address ? (
                <div className="liquid-glass min-w-0 max-w-[min(66vw,28rem)] rounded-full px-3 py-1 text-xs text-white/85">
                  <span className="block truncate">{restaurant.address}</span>
                </div>
              ) : null}
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
