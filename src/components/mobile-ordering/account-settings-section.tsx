"use client";

import { useRouter } from "next/navigation";
import { GuestAccountSettings } from "@/components/mobile-ordering/guest-account-settings";

export function AccountSettingsSection({
  email,
  name,
  storeSlug,
}: {
  email: string;
  name: string;
  storeSlug?: string | null;
}) {
  const router = useRouter();
  return (
    <GuestAccountSettings
      email={email}
      name={name}
      storeSlug={storeSlug}
      onProfileSaved={() => {
        router.refresh();
      }}
    />
  );
}
