"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useLocation } from "@/lib/contexts/LocationContext";
import type { MenuItem, Category } from "@/lib/take-order-data";
import { attachPosPromotionsCategory } from "@/lib/promotions/promotions-category";

interface ApiItem {
  id: string;
  name: string;
  description?: string | null;
  price: string | number;
  photoUrl?: string | null;
  status?: string;
  categories?: string[];
  tags?: string[];
  customizationGroups?: string[];
  activePromo?: {
    kind: "sale_price" | "bogo";
    price: number;
    compareAtPrice: number | null;
    displayOrder?: number;
  } | null;
  [key: string]: unknown;
}

interface ApiCategory {
  id: string;
  name: string;
  emoji?: string | null;
  displayOrder?: number;
  [key: string]: unknown;
}

interface ApiCustomizationOption {
  id: string;
  name: string;
  price: string | number;
  displayOrder?: number;
}

export interface ApiCustomizationGroup {
  id: string;
  name: string;
  isRequired?: boolean;
  minSelections?: number;
  maxSelections?: number | null;
  options?: ApiCustomizationOption[];
  [key: string]: unknown;
}

const CATEGORY_ICONS: Record<string, string> = {
  drinks: "🍹",
  starters: "🥗",
  mains: "🍽️",
  desserts: "🍰",
  food: "🍽️",
  default: "📋",
};

function mapCategory(api: ApiCategory): Category {
  const nameLower = (api.name || "").toLowerCase();
  const icon =
    api.emoji?.trim() ||
    CATEGORY_ICONS[nameLower] ||
    CATEGORY_ICONS[api.id?.toLowerCase()] ||
    CATEGORY_ICONS.default;
  return {
    id: api.id,
    name: api.name || "Uncategorized",
    icon,
  };
}

function mapItem(
  api: ApiItem,
  groupMap: Map<string, ApiCustomizationGroup>
): MenuItem {
  const catalogPrice =
    typeof api.price === "string" ? parseFloat(api.price) : Number(api.price);
  const promo = api.activePromo ?? null;
  const price = promo?.price ?? catalogPrice;
  const categoryId = api.categories?.[0] ?? "uncategorized";
  const available =
    api.status !== "hidden" &&
    api.status !== "soldout" &&
    api.status !== "draft";

  const options: MenuItem["options"] = [];

  for (const groupId of api.customizationGroups ?? []) {
    const group = groupMap.get(groupId);
    if (!group?.options?.length) continue;

    const choices: (string | { name: string; price: number })[] = group.options
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((opt) => {
        const p =
          typeof opt.price === "string" ? parseFloat(opt.price) : Number(opt.price);
        if (p > 0) return { name: opt.name, price: p };
        return opt.name;
      });

    options.push({
      name: group.name || "Options",
      required: !!group.isRequired || (group.minSelections ?? 0) > 0,
      choices,
    });
  }

  const dietary = (api.tags ?? [])
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.toLowerCase().replace(/\s+/g, "_"));

  return {
    id: api.id,
    name: api.name || "Item",
    description: api.description ?? "",
    price: Number.isFinite(price) ? price : 0,
    compareAtPrice: promo?.compareAtPrice ?? null,
    promoKind: promo?.kind ?? null,
    promoDisplayOrder: promo?.displayOrder,
    category: categoryId,
    image: api.photoUrl ?? "",
    dietary,
    options,
    extras: undefined,
    available,
  };
}

let menuCache: {
  locationId: string;
  menuItems: MenuItem[];
  categories: Category[];
  customizations: ApiCustomizationGroup[];
} | null = null;

function getMenuCache(locationId: string | null): {
  menuItems: MenuItem[];
  categories: Category[];
  customizations: ApiCustomizationGroup[];
} | null {
  if (!locationId || !menuCache || menuCache.locationId !== locationId)
    return null;
  return {
    menuItems: menuCache.menuItems,
    categories: menuCache.categories,
    customizations: (menuCache as { customizations?: ApiCustomizationGroup[] }).customizations ?? [],
  };
}

function setMenuCache(
  locationId: string,
  menuItems: MenuItem[],
  categories: Category[],
  customizations: ApiCustomizationGroup[]
): void {
  menuCache = { locationId, menuItems, categories, customizations };
}

export type LocationMenuContextValue = {
  menuItems: MenuItem[];
  categories: Category[];
  customizations: ApiCustomizationGroup[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const LocationMenuContext = createContext<LocationMenuContextValue | undefined>(
  undefined
);

export function LocationMenuProvider({ children }: { children: ReactNode }) {
  const { currentLocationId, loading: locationLoading } = useLocation();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customizations, setCustomizations] = useState<ApiCustomizationGroup[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMenu = useCallback(
    async (silent = false) => {
      if (!currentLocationId) {
        setMenuItems([]);
        setCategories([]);
        setCustomizations([]);
        setLoading(false);
        setError(null);
        return;
      }

      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const [itemsRes, categoriesRes, customizationsRes] = await Promise.all([
          fetch(
            `/api/items?locationId=${encodeURIComponent(currentLocationId)}`,
            { credentials: "include", cache: "no-store" }
          ),
          fetch(
            `/api/categories?locationId=${encodeURIComponent(currentLocationId)}`,
            { credentials: "include", cache: "no-store" }
          ),
          fetch(
            `/api/customizations?locationId=${encodeURIComponent(currentLocationId)}`,
            { credentials: "include", cache: "no-store" }
          ),
        ]);

        if (!itemsRes.ok || !categoriesRes.ok || !customizationsRes.ok) {
          const msg = !itemsRes.ok
            ? await itemsRes.text()
            : !categoriesRes.ok
              ? await categoriesRes.text()
              : await customizationsRes.text();
          throw new Error(msg || "Failed to load menu");
        }

        const [
          itemsPayload,
          categoriesPayload,
          customizationsPayload,
        ] = await Promise.all([
          itemsRes.json() as Promise<{ ok?: boolean; data?: ApiItem[] }>,
          categoriesRes.json() as Promise<{ ok?: boolean; data?: ApiCategory[] }>,
          customizationsRes.json() as Promise<{
            ok?: boolean;
            data?: ApiCustomizationGroup[];
          }>,
        ]);
        const itemsList =
          itemsPayload?.ok && Array.isArray(itemsPayload.data)
            ? itemsPayload.data
            : [];
        const categoriesList =
          categoriesPayload?.ok && Array.isArray(categoriesPayload.data)
            ? categoriesPayload.data
            : [];
        const customizationsList =
          customizationsPayload?.ok && Array.isArray(customizationsPayload.data)
            ? customizationsPayload.data
            : [];

        const groupMap = new Map<string, ApiCustomizationGroup>();
        for (const g of customizationsList ?? []) {
          groupMap.set(g.id, g);
        }

        const mappedCategories = (categoriesList ?? []).map(mapCategory);
        const uncategorized: Category = {
          id: "uncategorized",
          name: "Uncategorized",
          icon: CATEGORY_ICONS.default,
        };
        const categoryIds = new Set(mappedCategories.map((c) => c.id));
        if (!categoryIds.has("uncategorized")) {
          mappedCategories.push(uncategorized);
        }

        const mappedItems = (itemsList ?? []).map((item) =>
          mapItem(item, groupMap)
        );
        const { categories: menuCategories, items: menuItems } =
          attachPosPromotionsCategory(mappedCategories, mappedItems);
        setMenuCache(
          currentLocationId,
          menuItems,
          menuCategories,
          customizationsList ?? []
        );

        setCategories(menuCategories);
        setMenuItems(menuItems);
        setCustomizations(customizationsList ?? []);
      } catch (err) {
        if (!silent) {
          setError(
            err instanceof Error ? err.message : "Failed to load menu"
          );
          setMenuItems([]);
          setCategories([]);
          setCustomizations([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [currentLocationId]
  );

  useEffect(() => {
    if (locationLoading || !currentLocationId) {
      if (!currentLocationId) {
        setMenuItems([]);
        setCategories([]);
        setCustomizations([]);
        setLoading(false);
        setError(null);
      }
      return;
    }

    const cached = getMenuCache(currentLocationId);
    if (cached) {
      setMenuItems(cached.menuItems);
      setCategories(cached.categories);
      setCustomizations(cached.customizations);
      setLoading(false);
      setError(null);
      void fetchMenu(true);
    } else {
      void fetchMenu(false);
    }
  }, [currentLocationId, locationLoading, fetchMenu]);

  const refetch = useCallback(() => fetchMenu(false), [fetchMenu]);

  const value: LocationMenuContextValue = {
    menuItems,
    categories,
    customizations,
    loading,
    error,
    refetch,
  };

  return (
    <LocationMenuContext.Provider value={value}>
      {children}
    </LocationMenuContext.Provider>
  );
}

export function useLocationMenuContext(): LocationMenuContextValue {
  const context = useContext(LocationMenuContext);
  if (context === undefined) {
    throw new Error(
      "useLocationMenuContext must be used within LocationMenuProvider"
    );
  }
  return context;
}
