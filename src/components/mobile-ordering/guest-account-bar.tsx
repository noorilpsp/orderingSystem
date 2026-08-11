"use client";

import Link from "next/link";
import { LogIn, LogOut, User } from "lucide-react";
import { usePublicMenu } from "@/lib/contexts/PublicMenuContext";
import { cn } from "@/lib/utils";

type GuestAccountBarProps = {
  className?: string;
};

export function GuestAccountBar({ className }: GuestAccountBarProps) {
  const {
    customer,
    customerLoading,
    accountLoginPath,
    logoutCustomer,
  } = usePublicMenu();

  if (customerLoading) {
    return (
      <div className={cn("mx-auto max-w-md px-4", className)}>
        <div className="h-9 animate-pulse rounded-full bg-muted/60" />
      </div>
    );
  }

  if (customer) {
    return (
      <div className={cn("mx-auto max-w-md px-4", className)}>
        <div className="flex items-center justify-between gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-sm shadow-sm backdrop-blur-md">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-foreground">
            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{customer.name || customer.email}</span>
            {typeof customer.loyaltyPoints === "number" ? (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {customer.loyaltyPoints} pts
              </span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => {
              void logoutCustomer();
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("mx-auto max-w-md px-4", className)}>
      <Link
        href={accountLoginPath}
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-3 text-sm font-semibold text-foreground shadow-sm backdrop-blur-md hover:bg-card"
      >
        <LogIn className="h-3.5 w-3.5" />
        Sign in
      </Link>
    </div>
  );
}
