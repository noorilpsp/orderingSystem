"use client";

import Link from "next/link";
import { Check, Languages, LayoutDashboard, LogOut } from "lucide-react";

import { logout } from "@/app/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OrdersStaffProfile } from "@/lib/orders/getOrdersStaffProfile";
import { useStaffLocale, type OpsLocale } from "@/lib/ops-i18n";
import { clearUserData } from "@/lib/utils/logout";
import { cn } from "@/lib/utils";

type OrdersStaffMenuProps = {
  profile: OrdersStaffProfile | null;
  className?: string;
};

export function OrdersStaffMenu({ profile, className }: OrdersStaffMenuProps) {
  const { locale, setLocale, t, dir } = useStaffLocale();

  const handleLogout = async () => {
    clearUserData();
    await logout();
  };

  const languageOptions: Array<{ id: OpsLocale; label: string }> = [
    { id: "en", label: t("locale.english") },
    { id: "ar", label: t("locale.arabic") },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("staff.accountMenu")}
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.08] text-xs font-semibold tracking-wide text-zinc-100 transition-colors hover:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
            className,
          )}
        >
          {profile?.initials ?? <Languages className="h-4 w-4" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        dir={dir}
        sideOffset={8}
        className="w-56 border-white/10 bg-[hsl(224,18%,12%)] text-zinc-100"
      >
        {profile ? (
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-0.5">
              <span className="truncate text-sm font-semibold text-zinc-50">
                {profile.name}
              </span>
              {profile.roleLabel ? (
                <span className="truncate text-xs text-zinc-400">{profile.roleLabel}</span>
              ) : null}
              {profile.email ? (
                <span className="truncate text-[11px] text-zinc-500">{profile.email}</span>
              ) : null}
            </div>
          </DropdownMenuLabel>
        ) : null}
        {profile ? <DropdownMenuSeparator className="bg-white/10" /> : null}
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          {t("locale.label")}
        </DropdownMenuLabel>
        {languageOptions.map((option) => (
          <DropdownMenuItem
            key={option.id}
            className="cursor-pointer justify-between focus:bg-white/10 focus:text-zinc-50"
            onSelect={() => setLocale(option.id)}
          >
            <span>{option.label}</span>
            {locale === option.id ? <Check className="h-3.5 w-3.5 text-cyan-300" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-white/10 focus:text-zinc-50">
          <Link href="/dashboard">
            <LayoutDashboard className="h-4 w-4" />
            {t("staff.dashboard")}
          </Link>
        </DropdownMenuItem>
        {profile ? (
          <>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              className="cursor-pointer text-rose-300 focus:bg-rose-500/15 focus:text-rose-200"
              onSelect={(event) => {
                event.preventDefault();
                void handleLogout();
              }}
            >
              <LogOut className="h-4 w-4" />
              {t("staff.logOut")}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
