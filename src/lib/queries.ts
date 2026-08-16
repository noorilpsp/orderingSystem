import {
  fastCategories,
  merchants,
  products,
  subcategories,
  subcollections,
  users,
  platformPersonnel,
} from "@/db/schema";
import { db } from "@/db";
import { eq, and, count, desc } from "drizzle-orm";
import { unstable_cache } from "./unstable-cache";
import { sql } from "drizzle-orm";
import { supabaseServer } from "./supabaseServer";

export async function getUser() {
  const supabase = await supabaseServer();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  const dbUser = await db
    .select()
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);

  if (dbUser.length === 0) {
    return null;
  }

  return dbUser[0];
}

export const getProductsForSubcategory = unstable_cache(
  (subcategorySlug: string) =>
    db.query.products.findMany({
      where: (products, { eq, and }) =>
        and(eq(products.subcategory_slug, subcategorySlug)),
      orderBy: (products, { asc }) => asc(products.slug),
    }),
  ["subcategory-products"],
  {
    revalidate: 60 * 60 * 2, // two hours,
  },
);

export const getCollections = unstable_cache(
  () =>
    db.query.collections.findMany({
      with: {
        categories: true,
      },
      orderBy: (collections, { asc }) => asc(collections.name),
    }),
  ["collections"],
  {
    revalidate: 60 * 60 * 2, // two hours,
  },
);

export const getMerchantWithLocations = unstable_cache(
  (merchantId: string) =>
    db.query.merchants.findFirst({
      where: (merchants, { eq }) => eq(merchants.id, merchantId),
      with: {
        locations: true,
      },
    }),
  ["merchant-detail"],
  {
    revalidate: 60 * 60 * 2, // two hours,
  },
);

export const getMerchantLocations = unstable_cache(
  (merchantId: string) =>
    db.query.merchantLocations.findMany({
      where: (merchantLocations, { eq }) => eq(merchantLocations.merchantId, merchantId),
      orderBy: (merchantLocations, { desc }) => [desc(merchantLocations.createdAt)],
      limit: 50,
    }),
  ["merchant-locations"],
  {
    revalidate: 60 * 60 * 2, // two hours,
  },
);

export const getMerchantsList = unstable_cache(
  () =>
    db.query.merchants.findMany({
      columns: { id: true, name: true },
      with: {
        locations: {
          columns: {
            logoUrl: true,
            bannerUrl: true,
          },
          orderBy: (merchantLocations, { desc }) => [
            desc(merchantLocations.createdAt),
          ],
        },
      },
      orderBy: (merchants, { asc }) => asc(merchants.name),
    }),
  ["merchants-list"],
  {
    revalidate: 60 * 60 * 2, // two hours,
  },
);

export const ADMIN_MERCHANTS_CACHE_TAG = "admin-merchants-list";

export const getAdminMerchants = unstable_cache(
  () =>
    db.query.merchants.findMany({
      columns: {
        id: true,
        name: true,
        status: true,
        businessType: true,
        createdAt: true,
      },
      with: {
        locations: {
          columns: {
            logoUrl: true,
            bannerUrl: true,
          },
          orderBy: (merchantLocations, { desc }) => [
            desc(merchantLocations.createdAt),
          ],
        },
      },
      orderBy: (merchants, { desc }) => [desc(merchants.createdAt)],
      limit: 100,
    }),
  ["admin-merchants-list"],
  {
    revalidate: 60 * 60 * 2, // two hours
    tags: [ADMIN_MERCHANTS_CACHE_TAG],
  },
);

export const getProductDetails = unstable_cache(
  (productSlug: string) =>
    db.query.products.findFirst({
      where: (products, { eq }) => eq(products.slug, productSlug),
    }),
  ["product"],
  {
    revalidate: 60 * 60 * 2, // two hours,
  },
);

export const getSubcategory = unstable_cache(
  (subcategorySlug: string) =>
    db.query.subcategories.findFirst({
      where: (subcategories, { eq }) => eq(subcategories.slug, subcategorySlug),
    }),
  ["subcategory"],
  {
    revalidate: 60 * 60 * 2, // two hours,
  },
);

export const getCategory = unstable_cache(
  (categorySlug: string) =>
    db.query.fastCategories.findFirst({
      where: (fastCategories, { eq }) => eq(fastCategories.slug, categorySlug),
      with: {
        subcollections: {
          with: {
            subcategories: true,
          },
        },
      },
    }),
  ["category"],
  {
    revalidate: 60 * 60 * 2, // two hours,
  },
);

export const getCollectionDetails = unstable_cache(
  async (collectionSlug: string) =>
    db.query.collections.findMany({
      with: {
        categories: true,
      },
      where: (collections, { eq }) => eq(collections.slug, collectionSlug),
      orderBy: (collections, { asc }) => asc(collections.slug),
    }),
  ["collection"],
  {
    revalidate: 60 * 60 * 2, // two hours,
  },
);

export const getProductCount = unstable_cache(
  () => db.select({ count: count() }).from(products),
  ["total-product-count"],
  {
    revalidate: 60 * 60 * 2, // two hours,
  },
);

export const getMerchantsCount = unstable_cache(
  () => db.select({ count: count() }).from(merchants),
  ["total-merchants-count"],
  {
    revalidate: 60 * 60 * 2, // two hours,
  },
);

// could be optimized by storing category slug on the products table
export const getCategoryProductCount = unstable_cache(
  (categorySlug: string) =>
    db
      .select({ count: count() })
      .from(fastCategories)
      .leftJoin(
        subcollections,
        eq(fastCategories.slug, subcollections.category_slug),
      )
      .leftJoin(
        subcategories,
        eq(subcollections.id, subcategories.subcollection_id),
      )
      .leftJoin(products, eq(subcategories.slug, products.subcategory_slug))
      .where(eq(fastCategories.slug, categorySlug)),
  ["category-product-count"],
  {
    revalidate: 60 * 60 * 2, // two hours,
  },
);

export const getSubcategoryProductCount = unstable_cache(
  (subcategorySlug: string) =>
    db
      .select({ count: count() })
      .from(products)
      .where(eq(products.subcategory_slug, subcategorySlug)),
  ["subcategory-product-count"],
  {
    revalidate: 60 * 60 * 2, // two hours,
  },
);

export const getSearchResults = unstable_cache(
  async (searchTerm: string) => {
    let results;

    // do we really need to do this hybrid search pattern?

    if (searchTerm.length <= 2) {
      // If the search term is short (e.g., "W"), use ILIKE for prefix matching
      results = await db
        .select()
        .from(products)
        .where(sql`${products.name} ILIKE ${searchTerm + "%"}`) // Prefix match
        .limit(5)
        .innerJoin(
          subcategories,
          sql`${products.subcategory_slug} = ${subcategories.slug}`,
        )
        .innerJoin(
          subcollections,
          sql`${subcategories.subcollection_id} = ${subcollections.id}`,
        )
        .innerJoin(
          fastCategories,
          sql`${subcollections.category_slug} = ${fastCategories.slug}`,
        );
    } else {
      // For longer search terms, use full-text search with tsquery
      const formattedSearchTerm = searchTerm
        .split(" ")
        .filter((term) => term.trim() !== "") // Filter out empty terms
        .map((term) => `${term}:*`)
        .join(" & ");

      results = await db
        .select()
        .from(products)
        .where(
          sql`to_tsvector('english', ${products.name}) @@ to_tsquery('english', ${formattedSearchTerm})`,
        )
        .limit(5)
        .innerJoin(
          subcategories,
          sql`${products.subcategory_slug} = ${subcategories.slug}`,
        )
        .innerJoin(
          subcollections,
          sql`${subcategories.subcollection_id} = ${subcollections.id}`,
        )
        .innerJoin(
          fastCategories,
          sql`${subcollections.category_slug} = ${fastCategories.slug}`,
        );
    }

    return results;
  },
  ["search-results"],
  { revalidate: 60 * 60 * 2 }, // two hours
);

export const getAdminPersonnel = unstable_cache(
  async () =>
    db
      .select({
        userId: platformPersonnel.userId,
        role: platformPersonnel.role,
        department: platformPersonnel.department,
        isActive: platformPersonnel.isActive,
        lastLoginAt: platformPersonnel.lastLoginAt,
        createdAt: platformPersonnel.createdAt,
        user: {
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
          isActive: users.isActive,
          createdAt: users.createdAt,
        },
      })
      .from(platformPersonnel)
      .leftJoin(users, sql`${users.id} = ${platformPersonnel.userId}::text`)
      .orderBy(desc(platformPersonnel.createdAt))
      .limit(100),
  ["admin-personnel-list"],
  {
    revalidate: 60 * 60 * 2, // two hours
  },
);
