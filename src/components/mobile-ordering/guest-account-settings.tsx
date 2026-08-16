"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  updateCustomerPassword,
  updateCustomerProfile,
} from "@/app/actions/customer-auth";
import { useGuestT } from "@/lib/guest-i18n";
import { cn } from "@/lib/utils";

type GuestAccountSettingsProps = {
  email: string;
  name: string;
  storeSlug?: string | null;
  onProfileSaved?: (name: string) => void | Promise<void>;
  className?: string;
};

export function GuestAccountSettings({
  email,
  name,
  storeSlug = null,
  onProfileSaved,
  className,
}: GuestAccountSettingsProps) {
  const t = useGuestT();
  const [displayName, setDisplayName] = useState(name);
  const [profilePending, setProfilePending] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(name);
  }, [name]);

  const handleSaveProfile = async () => {
    setProfilePending(true);
    setProfileError(null);
    setProfileMessage(null);
    const result = await updateCustomerProfile({
      name: displayName,
      storeSlug,
    });
    setProfilePending(false);
    if (!result.ok) {
      setProfileError(result.error);
      return;
    }
    setProfileMessage(t("account.settingsProfileSaved"));
    await onProfileSaved?.(result.name);
  };

  const handleSavePassword = async () => {
    setPasswordError(null);
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordError(t("account.settingsPasswordMismatch"));
      return;
    }
    setPasswordPending(true);
    const result = await updateCustomerPassword({
      currentPassword,
      newPassword,
    });
    setPasswordPending(false);
    if (!result.ok) {
      setPasswordError(result.error);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage(t("account.settingsPasswordSaved"));
  };

  const inputClass =
    "mt-1.5 h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <section
      className={cn(
        "space-y-5 rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur-md",
        className,
      )}
    >
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("account.settingsProfile")}
        </p>
        <label className="block text-sm text-foreground">
          {t("auth.email")}
          <input
            type="email"
            value={email}
            readOnly
            disabled
            className={cn(inputClass, "cursor-not-allowed opacity-70")}
          />
        </label>
        <label className="block text-sm text-foreground">
          {t("auth.fullName")}
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={120}
            autoComplete="name"
            className={inputClass}
          />
        </label>
        {profileError ? (
          <p className="text-xs text-rose-600 dark:text-rose-300">{profileError}</p>
        ) : null}
        {profileMessage ? (
          <p className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
            <Check className="h-3.5 w-3.5" />
            {profileMessage}
          </p>
        ) : null}
        <button
          type="button"
          disabled={
            profilePending ||
            !displayName.trim() ||
            displayName.trim() === name.trim()
          }
          onClick={() => {
            void handleSaveProfile();
          }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {profilePending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("account.settingsSaveProfile")}
        </button>
      </div>

      <div className="h-px bg-border/70" />

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("account.settingsPassword")}
        </p>
        <label className="block text-sm text-foreground">
          {t("account.settingsCurrentPassword")}
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            className={inputClass}
          />
        </label>
        <label className="block text-sm text-foreground">
          {t("account.settingsNewPassword")}
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
        <label className="block text-sm text-foreground">
          {t("account.settingsConfirmPassword")}
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
        {passwordError ? (
          <p className="text-xs text-rose-600 dark:text-rose-300">{passwordError}</p>
        ) : null}
        {passwordMessage ? (
          <p className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
            <Check className="h-3.5 w-3.5" />
            {passwordMessage}
          </p>
        ) : null}
        <button
          type="button"
          disabled={
            passwordPending ||
            !currentPassword ||
            !newPassword ||
            !confirmPassword
          }
          onClick={() => {
            void handleSavePassword();
          }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-foreground/5 disabled:opacity-50"
        >
          {passwordPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("account.settingsSavePassword")}
        </button>
      </div>
    </section>
  );
}
