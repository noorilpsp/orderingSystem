import type { CatalogI18n } from "@/lib/catalog-i18n";

export type GuestRestaurant = {
  name: string;
  description: string;
  bannerUrl: string | null;
  logoUrl: string | null;
  address: string;
  phone: string;
  website: string;
  hours: Array<{ day: string; time: string }>;
  social?: {
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    tiktokUrl?: string | null;
  };
  /** ISO 4217 currency code from merchant localization. */
  currency: string;
  /** Merchant default language (e.g. en-US, ar). */
  defaultLanguage: string;
  /** Languages offered on the guest menu (`en` | `ar`). */
  availableLanguages: Array<"en" | "ar">;
  dateFormat: string | null;
  numberFormat: string | null;
};

export type GuestCategory = {
  id: string;
  emoji: string;
  name: string;
  /** Optional locale overrides; primary `name` is English. */
  i18n?: CatalogI18n | null;
};

export type GuestTag = {
  name: string;
  emoji?: string | null;
  i18n?: CatalogI18n | null;
};

export type GuestAllergen = {
  name: string;
  emoji?: string | null;
};

export type GuestMenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  calories?: number | null;
  /** Original price when a sale is live. */
  compareAtPrice?: number | null;
  promoKind?: "sale_price" | "bogo" | null;
  image: string;
  tags: GuestTag[];
  dietaryTags: GuestTag[];
  allergens: GuestAllergen[];
  status: "live" | "soldout";
  featured?: boolean;
  customizationGroupIds?: string[];
  /** Optional locale overrides; primary name/description are English. */
  i18n?: CatalogI18n | null;
};

export type GuestCartItem = {
  /** Catalog menu item id. Multiple cart rows can share this when customizations differ. */
  id: string;
  /** Unique cart row id. Distinct toppings for the same menu item get different line ids. */
  lineId?: string;
  name: string;
  quantity: number;
  price: number;
  compareAtPrice?: number | null;
  promoKind?: "sale_price" | "bogo" | null;
  /** Catalog loyalty reward attached as a $0 cart line. */
  rewardId?: string;
  selectedOptions?: Record<string, string[]>;
  sauceQuantities?: Record<string, number>;
  specialInstructions?: string;
};

export type GuestCustomizationOption = {
  id: string;
  name: string;
  price: number;
  i18n?: CatalogI18n | null;
  conditionalPrices?: {
    baseGroupId: string;
    prices: Array<{ baseOptionId: string; price: number }>;
  };
};

export type GuestCustomizationGroup = {
  id: string;
  name: string;
  customerInstructions?: string;
  i18n?: CatalogI18n | null;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  isSecondary?: boolean;
  triggerRule?: {
    triggerGroupId: string;
    triggerOptionId: string;
  };
  conditionalQuantities?: {
    baseGroupId: string;
    rules: Array<{ baseOptionId: string; maxSelections: number }>;
  };
  options: GuestCustomizationOption[];
};

export type GuestSessionMode = "staff_seated" | "self_service";

export type GuestOrderModes = {
  dine_in?: { enabled: boolean; guest_session_mode?: GuestSessionMode };
  pickup?: {
    enabled: boolean;
    estimated_time_minutes?: number;
    instructions?: string;
  };
  delivery?: { enabled: boolean; estimated_time_minutes?: number };
};

export const DEFAULT_PICKUP_INSTRUCTIONS =
  "Ring the bell at the side entrance.";
