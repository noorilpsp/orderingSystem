"use client";

import { useRouter } from "next/navigation";
import { GuestAccountSettings } from "@/components/mobile-ordering/guest-account-settings";

export function AccountSettingsSection({
  email,
  name,
  phone,
  storeSlug,
}: {
  email: string;
  name: string;
  phone?: string | null;
  storeSlug?: string | null;
}) {
  const router = useRouter();
  return (
    <GuestAccountSettings
      email={email}
      name={name}
      phone={phone}
      storeSlug={storeSlug}
      onProfileSaved={() => {
        router.refresh();
      }}
    />
  );
}
