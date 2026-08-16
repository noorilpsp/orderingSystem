"use client";

import { MerchantOnboardingForm } from "@/app/admin/merchants/new/components/MerchantOnboardingForm";

type Merchant = {
  id: string;
  name: string;
  legalName: string;
  kboNumber: string | null;
  contactEmail: string;
  phone: string;
  businessType: string;
  status: string;
  subscriptionTier: string;
  subscriptionExpiresAt: Date | null;
  kdsEnabled: boolean;
};

type Location = {
  id: string;
  name: string;
  address: string;
  addressLine2: string | null;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
  email: string | null;
  storeType: string | null;
};

type EditMerchantFormProps = {
  merchant: Merchant;
  location?: Location;
};

function dateInputValue(value: Date | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0] ?? "";
}

function storeTypeValue(businessType: string, locationType?: string | null) {
  const candidate = locationType || businessType;
  const allowed = new Set([
    "restaurant",
    "cafe",
    "bar",
    "bakery",
    "food_truck",
    "fine_dining",
    "fast_food",
    "other",
  ]);
  return allowed.has(candidate) ? candidate : "restaurant";
}

export function EditMerchantForm({ merchant, location }: EditMerchantFormProps) {
  return (
    <MerchantOnboardingForm
      mode="edit"
      merchantId={merchant.id}
      locationId={location?.id ?? null}
      defaultValues={{
        storeName: location?.name || merchant.name,
        storeType: storeTypeValue(merchant.businessType, location?.storeType) as
          | "restaurant"
          | "cafe"
          | "bar"
          | "bakery"
          | "food_truck"
          | "fine_dining"
          | "fast_food"
          | "other",
        address: location?.address ?? "",
        addressLine2: location?.addressLine2 ?? "",
        postalCode: location?.postalCode ?? "",
        city: location?.city ?? "",
        country: location?.country === "BE" ? "Belgium" : location?.country || "Belgium",
        phone: location?.phone || merchant.phone,
        publicEmail: location?.email ?? "",
        legalName: merchant.legalName ?? "",
        kboNumber: merchant.kboNumber ?? "",
        contactEmail: merchant.contactEmail ?? "",
        subscriptionTier: (merchant.subscriptionTier as
          | "trial"
          | "basic"
          | "pro"
          | "enterprise") || "trial",
        trialExpires: dateInputValue(merchant.subscriptionExpiresAt),
        status: (merchant.status as "onboarding" | "active" | "suspended" | "inactive") ||
          "onboarding",
        kdsEnabled: merchant.kdsEnabled,
      }}
    />
  );
}
