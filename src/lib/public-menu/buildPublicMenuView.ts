/**
 * Builds the guest-facing menu view from a store slug.
 * No auth required — caller is the public API route.
 */

import { eq, asc, desc, inArray, and } from "drizzle-orm";
import { db } from "@/db";
import {
  items,
  categories,
  customizationGroups,
  menus,
  conditionalPrices,
  secondaryGroupRules,
} from "@/db/schema";
import { merchantLocations, merchants, normalizeLoyaltySettings } from "@/lib/db/schema";
import type { PublicMenuView } from "@/lib/public-menu/types";
import { listActivePublicLoyaltyRewards } from "@/lib/loyalty/listActivePublicLoyaltyRewards";
import { coerceTaxRatePercent } from "@/lib/tax-rate";
import {
  openingHoursToGuestHours,
  resolveActiveMenu,
} from "@/lib/public-menu/resolveActiveMenu";
import {
  facebookProfileUrl,
  instagramProfileUrl,
  tiktokProfileUrl,
} from "@/lib/public-menu/socialLinks";
import type {
  GuestCategory,
  GuestCustomizationGroup,
  GuestMenuItem,
  GuestRestaurant,
} from "@/lib/guest-menu/types";
import { normalizeCatalogI18n } from "@/lib/catalog-i18n";

function mapCategory(row: {
  id: string;
  name: string;
  emoji?: string | null;
  i18n?: unknown;
}): GuestCategory {
  return {
    id: row.id,
    emoji: row.emoji?.trim() || "",
    name: row.name || "Uncategorized",
    i18n: normalizeCatalogI18n(row.i18n),
  };
}

function mapGuestStatus(status: string | null | undefined): "live" | "soldout" {
  return status === "soldout" ? "soldout" : "live";
}

type RawCategory = {
  id: string;
  name: string;
  emoji?: string | null;
  i18n?: unknown;
};
type RawItem = {
  id: string;
  name: string;
  description: string | null;
  i18n?: unknown;
  price: string;
  photoUrl: string | null;
  status: string | null;
  featured?: boolean | null;
  displayOrder?: number | null;
  categoryItems?: Array<{ category: { id: string } }>;
  itemTags?: Array<{ tag: { name: string; i18n?: unknown } }>;
  itemCustomizations?: Array<{ group: { id: string } }>;
};

function buildGuestMenuItems(
  rawItems: RawItem[],
  rawCategories: RawCategory[],
  activeCategoryIds: Set<string> | null,
): { categories: GuestCategory[]; items: GuestMenuItem[] } {
  const visibleCategories: GuestCategory[] = activeCategoryIds
    ? rawCategories
        .filter((category) => activeCategoryIds.has(category.id))
        .map(mapCategory)
    : rawCategories.map(mapCategory);

  const visibleCategoryIdSet = new Set(visibleCategories.map((category) => category.id));
  const guestItems: GuestMenuItem[] = [];

  // rawItems are already ordered by displayOrder desc, createdAt desc
  for (const item of rawItems) {
    if (item.status === "draft" || item.status === "hidden") continue;

    const categoryIds =
      item.categoryItems?.map((ci) => ci.category.id).filter(Boolean) ?? [];
    const primaryCategoryId = categoryIds.find((id) => visibleCategoryIdSet.has(id));

    if (activeCategoryIds && categoryIds.length > 0 && !primaryCategoryId) {
      continue;
    }

    const categoryId = primaryCategoryId ?? categoryIds[0] ?? "uncategorized";
    if (activeCategoryIds && !visibleCategoryIdSet.has(categoryId) && categoryId !== "uncategorized") {
      continue;
    }

    const groupIds = item.itemCustomizations?.map((ic) => ic.group.id) ?? [];
    const featured = Boolean(item.featured) && item.status === "live";

    guestItems.push({
      id: item.id,
      categoryId,
      name: item.name,
      description: item.description ?? "",
      price: Number.parseFloat(item.price),
      image: item.photoUrl ?? "",
      tags:
        item.itemTags?.map((it) => ({
          name: it.tag.name,
          i18n: normalizeCatalogI18n(it.tag.i18n),
        })) ?? [],
      status: mapGuestStatus(item.status),
      featured,
      customizationGroupIds: groupIds,
      i18n: normalizeCatalogI18n(item.i18n),
    });
  }

  const categoriesWithItems = new Set(guestItems.map((item) => item.categoryId));
  const filteredCategories = visibleCategories.filter((category) =>
    categoriesWithItems.has(category.id),
  );

  if (!filteredCategories.some((category) => category.id === "uncategorized")) {
    if (categoriesWithItems.has("uncategorized")) {
      filteredCategories.push({
        id: "uncategorized",
        emoji: "",
        name: "Uncategorized",
      });
    }
  }

  return { categories: filteredCategories, items: guestItems };
}

export async function buildPublicMenuView(
  storeSlug: string,
): Promise<PublicMenuView | null> {
  const location = await db.query.merchantLocations.findFirst({
    where: eq(merchantLocations.storeSlug, storeSlug),
    columns: {
      id: true,
      name: true,
      description: true,
      storeSlug: true,
      address: true,
      addressLine2: true,
      postalCode: true,
      city: true,
      phone: true,
      websiteUrl: true,
      instagramHandle: true,
      facebookUrl: true,
      tiktokHandle: true,
      logoUrl: true,
      bannerUrl: true,
      openingHours: true,
      enableOnlineOrders: true,
      status: true,
      orderModes: true,
      merchantId: true,
      taxRate: true,
    },
  });

  if (!location?.storeSlug) return null;

  const unavailableReason =
    !location.enableOnlineOrders
      ? ("online_orders_disabled" as const)
      : location.status !== "active"
        ? ("location_inactive" as const)
        : null;

  const addressParts = [
    location.address,
    location.addressLine2,
    `${location.postalCode} ${location.city}`.trim(),
  ].filter(Boolean);

  const restaurant: GuestRestaurant = {
    name: location.name,
    description: location.description ?? "",
    bannerUrl: location.bannerUrl ?? "/banner.jpg",
    logoUrl: location.logoUrl ?? "/logo.jpg",
    address: addressParts.join(", "),
    phone: location.phone,
    website: location.websiteUrl?.replace(/^https?:\/\//, "") ?? "",
    hours: openingHoursToGuestHours(location.openingHours),
    social: {
      instagramUrl: instagramProfileUrl(location.instagramHandle),
      facebookUrl: facebookProfileUrl(location.facebookUrl),
      tiktokUrl: tiktokProfileUrl(location.tiktokHandle),
    },
  };

  const [menuRows, rawCategories, rawGroups, merchantRow] = await Promise.all([
    db.query.menus.findMany({
      where: and(eq(menus.locationId, location.id), eq(menus.status, "active")),
      orderBy: [asc(menus.displayOrder), desc(menus.createdAt)],
      columns: {
        id: true,
        name: true,
        schedule: true,
        status: true,
        displayOrder: true,
      },
      with: {
        menuCategories: {
          columns: { categoryId: true },
        },
      },
    }),
    db.query.categories.findMany({
      where: eq(categories.locationId, location.id),
      orderBy: [asc(categories.displayOrder), desc(categories.createdAt)],
      columns: { id: true, name: true, emoji: true, i18n: true },
    }),
    db.query.customizationGroups.findMany({
      where: eq(customizationGroups.locationId, location.id),
      orderBy: [desc(customizationGroups.displayOrder), desc(customizationGroups.createdAt)],
      columns: {
        id: true,
        name: true,
        customerInstructions: true,
        i18n: true,
        isRequired: true,
        minSelections: true,
        maxSelections: true,
        useConditionalPricing: true,
        conditionalPricingBaseGroupId: true,
        useConditionalQuantities: true,
        conditionalQuantitiesBaseGroupId: true,
      },
      with: {
        options: {
          orderBy: (opt, { asc: ascOrder }) => [ascOrder(opt.displayOrder)],
          columns: { id: true, name: true, price: true, i18n: true },
        },
        conditionalQuantities: {
          columns: {
            baseOptionId: true,
            maxSelections: true,
          },
        },
      },
    }),
    db.query.merchants.findFirst({
      where: eq(merchants.id, location.merchantId),
      columns: { loyaltySettings: true },
    }),
  ]);

  const loyalty = normalizeLoyaltySettings(merchantRow?.loyaltySettings);
  const rewards =
    loyalty.enabled && location.merchantId
      ? await listActivePublicLoyaltyRewards({
          merchantId: location.merchantId,
          locationId: location.id,
        })
      : [];

  const activeMenu = resolveActiveMenu(menuRows);
  const activeCategoryIds = activeMenu
    ? new Set(activeMenu.menuCategories.map((mc) => mc.categoryId))
    : null;

  const rawItems = await db.query.items.findMany({
    where: eq(items.locationId, location.id),
    orderBy: [desc(items.displayOrder), desc(items.createdAt)],
    columns: {
      id: true,
      name: true,
      description: true,
      i18n: true,
      price: true,
      photoUrl: true,
      status: true,
      featured: true,
      displayOrder: true,
    },
    with: {
      categoryItems: {
        with: { category: { columns: { id: true } } },
      },
      itemTags: { with: { tag: { columns: { name: true, i18n: true } } } },
      itemCustomizations: {
        with: { group: { columns: { id: true } } },
      },
    },
  });

  const publishableItemCount = rawItems.filter(
    (item) => item.status !== "draft" && item.status !== "hidden",
  ).length;

  let { categories: visibleCategories, items: guestItems } = buildGuestMenuItems(
    rawItems,
    rawCategories,
    activeCategoryIds,
  );

  // If the active menu's categories don't match any live items, fall back to all items.
  if (guestItems.length === 0 && publishableItemCount > 0) {
    ({ categories: visibleCategories, items: guestItems } = buildGuestMenuItems(
      rawItems,
      rawCategories,
      null,
    ));
  }

  const optionIds = rawGroups.flatMap((group) =>
    group.options.map((option) => option.id),
  );

  const [conditionalPriceRows, secondaryRuleRows] = await Promise.all([
    optionIds.length > 0
      ? db.query.conditionalPrices.findMany({
          where: inArray(conditionalPrices.optionId, optionIds),
          columns: {
            optionId: true,
            baseOptionId: true,
            price: true,
          },
        })
      : Promise.resolve([]),
    optionIds.length > 0
      ? db.query.secondaryGroupRules.findMany({
          where: inArray(secondaryGroupRules.triggerOptionId, optionIds),
          columns: {
            triggerOptionId: true,
            showGroupId: true,
            isRequired: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const conditionalPricesByOptionId = new Map<
    string,
    Array<{ baseOptionId: string; price: number }>
  >();
  for (const row of conditionalPriceRows) {
    const list = conditionalPricesByOptionId.get(row.optionId) ?? [];
    list.push({
      baseOptionId: row.baseOptionId,
      price: Number.parseFloat(String(row.price)),
    });
    conditionalPricesByOptionId.set(row.optionId, list);
  }

  const optionToGroupId = new Map<string, string>();
  for (const group of rawGroups) {
    for (const option of group.options) {
      optionToGroupId.set(option.id, group.id);
    }
  }

  const secondaryByShowGroupId = new Map<
    string,
    { triggerGroupId: string; triggerOptionId: string }
  >();
  for (const rule of secondaryRuleRows) {
    const triggerGroupId = optionToGroupId.get(rule.triggerOptionId);
    if (!triggerGroupId) continue;
    secondaryByShowGroupId.set(rule.showGroupId, {
      triggerGroupId,
      triggerOptionId: rule.triggerOptionId,
    });
  }

  const mappedGroups: GuestCustomizationGroup[] = rawGroups.map((group) => {
    const secondary = secondaryByShowGroupId.get(group.id);
    const baseGroupIdForPricing =
      group.conditionalPricingBaseGroupId ?? undefined;
    const baseGroupIdForQuantities =
      group.conditionalQuantitiesBaseGroupId ?? undefined;

    return {
      id: group.id,
      name: group.name,
      customerInstructions: group.customerInstructions ?? undefined,
      i18n: normalizeCatalogI18n(group.i18n),
      isRequired: group.isRequired ?? false,
      minSelections: group.minSelections ?? 0,
      maxSelections: group.maxSelections ?? 1,
      ...(secondary
        ? {
            isSecondary: true,
            triggerRule: secondary,
          }
        : {}),
      ...(group.useConditionalQuantities &&
      baseGroupIdForQuantities &&
      group.conditionalQuantities.length > 0
        ? {
            conditionalQuantities: {
              baseGroupId: baseGroupIdForQuantities,
              rules: group.conditionalQuantities.map((rule) => ({
                baseOptionId: rule.baseOptionId,
                maxSelections:
                  rule.maxSelections ?? group.maxSelections ?? 1,
              })),
            },
          }
        : {}),
      options: group.options.map((option) => {
        const prices = conditionalPricesByOptionId.get(option.id);
        return {
          id: option.id,
          name: option.name,
          price: Number.parseFloat(option.price),
          i18n: normalizeCatalogI18n(option.i18n),
          ...(group.useConditionalPricing &&
          baseGroupIdForPricing &&
          prices &&
          prices.length > 0
            ? {
                conditionalPrices: {
                  baseGroupId: baseGroupIdForPricing,
                  prices,
                },
              }
            : {}),
        };
      }),
    };
  });

  return {
    storeSlug: location.storeSlug,
    locationId: location.id,
    taxRate: coerceTaxRatePercent(location.taxRate),
    availability: unavailableReason
      ? { status: "unavailable", reason: unavailableReason }
      : { status: "available" },
    restaurant,
    categories: visibleCategories,
    items: guestItems,
    customizationGroups: mappedGroups,
    orderModes: location.orderModes ?? {
      dine_in: { enabled: true },
      pickup: { enabled: true },
      delivery: { enabled: false },
    },
    activeMenuId: activeMenu?.id ?? null,
    activeMenuName: activeMenu?.name ?? null,
    loyaltySettings: {
      enabled: loyalty.enabled,
      pointsPerDollar: loyalty.pointsPerDollar,
      redeemPointsPerDollarOff: loyalty.redeemPointsPerDollarOff,
      allowOpenWalletRedeem: loyalty.allowOpenWalletRedeem,
      pointsExpirationMonths: loyalty.pointsExpirationMonths,
    },
    rewards,
  };
}

export async function resolvePublicLocationBySlug(storeSlug: string) {
  return db.query.merchantLocations.findFirst({
    where: eq(merchantLocations.storeSlug, storeSlug),
    columns: {
      id: true,
      storeSlug: true,
      enableOnlineOrders: true,
      status: true,
      orderModes: true,
      taxRate: true,
      serviceChargePercentage: true,
    },
  });
}
