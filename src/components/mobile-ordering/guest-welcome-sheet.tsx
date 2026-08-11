"use client";

import Link from "next/link";
import { LogIn, UtensilsCrossed } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGuestT } from "@/lib/guest-i18n";

type GuestWelcomeSheetProps = {
  open: boolean;
  restaurantName: string;
  loginPath: string;
  signupPath: string;
  onContinueAsGuest: () => void;
};

export function GuestWelcomeSheet({
  open,
  restaurantName,
  loginPath,
  signupPath,
  onContinueAsGuest,
}: GuestWelcomeSheetProps) {
  const t = useGuestT();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Backdrop / escape counts as browsing without an account.
        if (!next) onContinueAsGuest();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="bottom-0 top-auto max-w-md translate-x-[-50%] translate-y-0 gap-0 overflow-hidden rounded-t-3xl border-border/80 bg-card p-0 text-foreground shadow-2xl shadow-black/30 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:max-w-md"
      >
        <div className="relative overflow-hidden px-5 pb-2 pt-5">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_10%_0%,rgba(249,115,22,0.16),transparent_55%),radial-gradient(90%_70%_at_100%_20%,rgba(59,130,246,0.12),transparent_50%)]"
          />
          <div className="relative mx-auto mb-4 flex h-1 w-10 rounded-full bg-border/80" />
          <div className="relative space-y-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {restaurantName}
            </p>
            <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
              {t("welcome.readyToOrder")}
            </DialogTitle>
            <DialogDescription className="mx-auto max-w-[18rem] text-sm leading-relaxed text-muted-foreground">
              {t("welcome.subtitle")}
            </DialogDescription>
          </div>
        </div>

        <div className="space-y-2 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
          <Link
            href={loginPath}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <LogIn className="h-4 w-4" />
            {t("account.signIn")}
          </Link>

          <button
            type="button"
            onClick={onContinueAsGuest}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border/80 bg-background/70 text-sm font-semibold text-foreground transition hover:bg-muted/60"
          >
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
            {t("welcome.continueAsGuest")}
          </button>

          <p className="pt-1 text-center text-xs text-muted-foreground">
            {t("welcome.newHere")}{" "}
            <Link
              href={signupPath}
              className="font-semibold text-foreground underline underline-offset-2"
            >
              {t("account.createAccount")}
            </Link>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
