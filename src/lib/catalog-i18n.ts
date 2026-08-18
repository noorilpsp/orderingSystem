/**
 * Optional non-English catalog overrides.
 * Canonical `name` / `description` columns stay English (staff / kitchen).
 */
export type CatalogLocaleFields = {
  name?: string;
  description?: string;
  /** Used by customization groups (guest-facing hint under the group title). */
  customerInstructions?: string;
};

export type CatalogI18n = {
  ar?: CatalogLocaleFields;
};

export function normalizeCatalogI18n(raw: unknown): CatalogI18n | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const arRaw = record.ar;
  if (arRaw == null || typeof arRaw !== "object" || Array.isArray(arRaw)) {
    return null;
  }
  const arObj = arRaw as Record<string, unknown>;
  const name = typeof arObj.name === "string" ? arObj.name.trim() : "";
  const description =
    typeof arObj.description === "string" ? arObj.description.trim() : "";
  const customerInstructions =
    typeof arObj.customerInstructions === "string"
      ? arObj.customerInstructions.trim()
      : "";
  if (!name && !description && !customerInstructions) return null;
  return {
    ar: {
      ...(name ? { name } : {}),
      ...(description ? { description } : {}),
      ...(customerInstructions ? { customerInstructions } : {}),
    },
  };
}

/** Build catalog i18n from Arabic CSV/form strings. Empty values are omitted. */
export function catalogI18nFromArFields(fields: {
  name?: string | null;
  description?: string | null;
  customerInstructions?: string | null;
}): CatalogI18n | null {
  return normalizeCatalogI18n({
    ar: {
      name: fields.name ?? "",
      description: fields.description ?? "",
      customerInstructions: fields.customerInstructions ?? "",
    },
  });
}

export function catalogArField(
  i18n: CatalogI18n | null | undefined,
  field: keyof CatalogLocaleFields,
): string {
  const value = i18n?.ar?.[field];
  return typeof value === "string" ? value.trim() : "";
}

export function resolveCatalogText(
  locale: "en" | "ar",
  base: { name: string; description?: string | null },
  i18n?: CatalogI18n | null,
): { name: string; description: string } {
  const fallbackName = base.name || "";
  const fallbackDescription = base.description ?? "";
  if (locale !== "ar") {
    return { name: fallbackName, description: fallbackDescription };
  }
  const ar = i18n?.ar;
  return {
    name: ar?.name?.trim() || fallbackName,
    description: ar?.description?.trim() || fallbackDescription,
  };
}

export function resolveCatalogInstructions(
  locale: "en" | "ar",
  base: string | null | undefined,
  i18n?: CatalogI18n | null,
): string {
  const fallback = base ?? "";
  if (locale !== "ar") return fallback;
  return i18n?.ar?.customerInstructions?.trim() || fallback;
}

/** Built-in Arabic labels for common tag names (case-insensitive key). */
const DEFAULT_TAG_AR: Record<string, string> = {
  vegetarian: "نباتي",
  vegan: "نباتي صرف",
  "gluten-free": "خالي من الغلوتين",
  "gluten free": "خالي من الغلوتين",
  spicy: "حار",
  popular: "شائع",
  new: "جديد",
  "chef-pick": "اختيار الشيف",
  "chef pick": "اختيار الشيف",
  "dairy-free": "خالي من الألبان",
  "nut-free": "خالي من المكسرات",
};

/** Built-in Arabic labels for common allergen names (case-insensitive key). */
const DEFAULT_ALLERGEN_AR: Record<string, string> = {
  dairy: "ألبان",
  milk: "حليب",
  gluten: "غلوتين",
  eggs: "بيض",
  egg: "بيض",
  soy: "صويا",
  nuts: "مكسرات",
  peanuts: "فول سوداني",
  "tree nuts": "مكسرات شجرية",
  shellfish: "محار",
  fish: "سمك",
  sesame: "سمسم",
  mustard: "خردل",
  celery: "كرفس",
  lupin: "ترمس",
  molluscs: "رخويات",
};

export function resolveTagLabel(
  locale: "en" | "ar",
  tagName: string,
  i18n?: CatalogI18n | null,
): string {
  if (locale !== "ar") return tagName;
  const fromDb = i18n?.ar?.name?.trim();
  if (fromDb) return fromDb;
  const key = tagName.trim().toLowerCase();
  return DEFAULT_TAG_AR[key] ?? tagName;
}

export function resolveAllergenLabel(
  locale: "en" | "ar",
  allergenName: string,
): string {
  if (locale !== "ar") return allergenName;
  const key = allergenName.trim().toLowerCase();
  return DEFAULT_ALLERGEN_AR[key] ?? allergenName;
}
