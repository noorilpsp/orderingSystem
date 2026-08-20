import type {
  GuestCategory,
  GuestCustomizationGroup,
  GuestMenuItem,
  GuestOrderModes,
  GuestRestaurant,
} from "@/lib/guest-menu/types";

export type PublicMenuAvailability =
  | { status: "available" }
  | { status: "unavailable"; reason: "online_orders_disabled" | "location_inactive" | "no_slug" };

export type PublicMenuLoyaltySettings = {
  enabled: boolean;
  pointsPerDollar: number;
  redeemPointsPerDollarOff: number;
  allowOpenWalletRedeem: boolean;
  pointsExpirationMonths: number;
};

export type PublicMenuReward = {
  id: string;
  name: string;
  description: string | null;
  kind: "fixed_off" | "percent_off" | "free_item";
  pointsCost: number;
  summary: string;
  discountAmount: number | null;
  percentOff: number | null;
  maxDiscountAmount: number | null;
  menuItemId: string | null;
  menuItemName: string | null;
};

export type PublicMenuTable = {
  id: string;
  tableNumber: string;
};

export type PublicMenuView = {
  storeSlug: string;
  locationId: string;
  /** Bumped on every dashboard catalog write so the guest menu can detect freshness. */
  catalogUpdatedAt: string;
  /** Sales tax percent for this location (e.g. 21 = 21%). */
  taxRate: number;
  availability: PublicMenuAvailability;
  restaurant: GuestRestaurant;
  categories: GuestCategory[];
  items: GuestMenuItem[];
  customizationGroups: GuestCustomizationGroup[];
  orderModes: GuestOrderModes;
  /** Tables configured for delivery-to-table (empty when none). */
  tables: PublicMenuTable[];
  activeMenuId: string | null;
  activeMenuName: string | null;
  loyaltySettings: PublicMenuLoyaltySettings;
  rewards: PublicMenuReward[];
};

export type PublicOrderItemInput = {
  itemId: string;
  quantity: number;
  notes?: string | null;
  customizations?: Array<{
    groupId: string;
    optionId: string;
    quantity?: number;
  }>;
};

export type CreatePublicOrderInput = {
  storeSlug: string;
  orderType: "dine_in" | "pickup" | "delivery";
  paymentTiming: "pay_first" | "pay_later";
  tableNumber?: string | null;
  seatId?: string | null;
  deviceId?: string | null;
  guestCount?: number;
  notes?: string | null;
  scheduledPickupAt?: string | null;
  pointsToRedeem?: number;
  rewardId?: string;
  /** Walk-in guest mobile number so the restaurant can call about the order. */
  phone?: string | null;
  /** Optional guest name for dine-in table seats. */
  guestName?: string | null;
  items: PublicOrderItemInput[];
};

export type CreatePublicOrderResult =
  | { ok: true; orderId: string; orderNumber: string }
  | { ok: false; code: string; message: string };
