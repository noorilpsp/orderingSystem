"use client";

import React from "react";

import { useState, useRef } from "react";
import { MapPin, Phone, Clock, Globe, X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { restaurant as staticRestaurant } from "@/lib/menu-data";
import { usePublicMenuOptional } from "@/lib/contexts/PublicMenuContext";
import { useGuestT, type EnMessageKey } from "@/lib/guest-i18n";

interface InfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DAY_MESSAGE_KEYS: Record<string, EnMessageKey> = {
  sunday: "day.sunday",
  monday: "day.monday",
  tuesday: "day.tuesday",
  wednesday: "day.wednesday",
  thursday: "day.thursday",
  friday: "day.friday",
  saturday: "day.saturday",
};

function localizeDayLabel(day: string, t: (key: EnMessageKey) => string): string {
  const key = DAY_MESSAGE_KEYS[day.trim().toLowerCase()];
  return key ? t(key) : day;
}

function localizeHoursTime(time: string, t: (key: EnMessageKey) => string): string {
  if (time.trim().toLowerCase() === "closed") {
    return t("info.closed");
  }
  return time;
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M14 8h2.5V5.2C16.1 5.1 15 5 13.7 5 11.1 5 9.3 6.6 9.3 9.6V12H7v3.2h2.3V21h3.2v-5.8H15l.5-3.2h-2.9V9.8c0-.9.3-1.8 1.4-1.8Z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M16.5 4c.4 2.1 1.8 3.7 3.9 4v2.7c-1.4 0-2.7-.4-3.9-1.2v5.5c0 3.4-2.7 6.1-6.1 6.1S4.3 18.4 4.3 15s2.7-6.1 6.1-6.1c.3 0 .7 0 1 .1v2.8c-.3-.1-.7-.2-1-.2-1.8 0-3.3 1.5-3.3 3.4s1.5 3.4 3.3 3.4 3.3-1.5 3.3-3.4V4h2.8Z" />
    </svg>
  );
}

export function InfoSheet({ open, onOpenChange }: InfoSheetProps) {
  const publicMenu = usePublicMenuOptional();
  const t = useGuestT();
  const restaurant = publicMenu?.restaurant ?? staticRestaurant;
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const socialLinks = [
    restaurant.social?.instagramUrl
      ? {
          id: "instagram" as const,
          href: restaurant.social.instagramUrl,
          label: t("info.instagram"),
          Icon: InstagramIcon,
        }
      : null,
    restaurant.social?.tiktokUrl
      ? {
          id: "tiktok" as const,
          href: restaurant.social.tiktokUrl,
          label: t("info.tiktok"),
          Icon: TikTokIcon,
        }
      : null,
    restaurant.social?.facebookUrl
      ? {
          id: "facebook" as const,
          href: restaurant.social.facebookUrl,
          label: t("info.facebook"),
          Icon: FacebookIcon,
        }
      : null,
  ].filter((entry): entry is NonNullable<typeof entry> => entry != null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;

    // Only allow drag-to-close if content is at or near the top (within 5px)
    const isScrolledToTop = scrollRef.current ? scrollRef.current.scrollTop <= 5 : true;

    if (diff > 0 && isScrolledToTop) {
      e.preventDefault();
      setDragY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (dragY > 100) {
      setDragY(0);
      onOpenChange(false);
    } else {
      setDragY(0);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={scrollRef}
        side="bottom"
        showClose={false}
        className="rounded-t-2xl max-h-[85vh] overflow-y-auto px-4"
        style={{
          transform: `translateY(${dragY}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-1.5 pb-2 touch-none cursor-grab active:cursor-grabbing">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        <div>
          <SheetHeader className="bg-transparent p-0 pb-2">
            <div className="relative flex items-center gap-3 pe-8">
              <SheetTitle className="min-w-0 flex-1 text-start text-xl">
                {restaurant.name}
              </SheetTitle>
              <SheetClose className="absolute right-0 top-1/2 -translate-y-1/2 shrink-0 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:outline-hidden">
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </SheetClose>
            </div>
          </SheetHeader>

          <div className="space-y-6 pb-6 px-0">
            <a
              href={`https://www.google.com/maps/search/${encodeURIComponent(restaurant.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-4 hover:opacity-80 transition-opacity"
            >
              <MapPin className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
              <div>
                <p className="text-sm font-semibold text-foreground">{t("info.address")}</p>
                <p className="text-sm text-blue-600 hover:underline">{restaurant.address}</p>
              </div>
            </a>

            <div className="flex items-start gap-4">
              <Phone className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
              <div>
                <p className="text-sm font-semibold text-foreground">{t("info.phone")}</p>
                <a
                  href={`tel:${restaurant.phone}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {restaurant.phone}
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Clock className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
              <div className="flex-1">
                <p className="mb-3 text-sm font-semibold text-foreground">
                  {t("info.openingHours")}
                </p>
                <div className="space-y-2">
                  {restaurant.hours.map((schedule) => (
                    <div key={schedule.day} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {localizeDayLabel(schedule.day, t)}
                      </span>
                      <span className="font-medium text-foreground">
                        {localizeHoursTime(schedule.time, t)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {restaurant.website ? (
              <div className="flex items-start gap-4">
                <Globe className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("info.website")}</p>
                  <a
                    href={`https://${restaurant.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {restaurant.website}
                  </a>
                </div>
              </div>
            ) : null}

            {socialLinks.length > 0 ? (
              <div className="flex items-start gap-4">
                <InstagramIcon className="mt-1 h-6 w-6 shrink-0 text-blue-600" />
                <div className="min-w-0 flex-1">
                  <p className="mb-3 text-sm font-semibold text-foreground">
                    {t("info.social")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {socialLinks.map((link) => {
                      const Icon = link.Icon;
                      return (
                        <a
                          key={link.id}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                        >
                          <Icon className="h-4 w-4 text-blue-600" />
                          {link.label}
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
