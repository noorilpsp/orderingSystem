import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/lib/db/schema/orders";
import { resolvePublicLocationBySlug } from "@/lib/public-menu/buildPublicMenuView";

export type EnsuredCustomer = {
  customerId: string;
  locationId: string;
  name: string | null;
  email: string | null;
};

/**
 * Lazily upsert a per-location CRM customer row for an authenticated diner.
 * Auth identity is platform-wide; customers rows remain location-scoped.
 */
export async function ensureCustomerForUser(input: {
  userId: string;
  storeSlug: string;
  name?: string | null;
  email?: string | null;
}): Promise<EnsuredCustomer | null> {
  const storeSlug = input.storeSlug.trim().toLowerCase();
  if (!storeSlug || !input.userId.trim()) return null;

  const location = await resolvePublicLocationBySlug(storeSlug);
  if (!location?.id) return null;

  const userId = input.userId.trim();
  const existing = await db.query.customers.findFirst({
    where: and(eq(customers.userId, userId), eq(customers.locationId, location.id)),
    columns: { id: true, name: true, email: true },
  });

  if (existing) {
    const nextName = input.name?.trim() || existing.name;
    const nextEmail = input.email?.trim() || existing.email;
    if (
      (nextName && nextName !== existing.name) ||
      (nextEmail && nextEmail !== existing.email)
    ) {
      await db
        .update(customers)
        .set({
          name: nextName ?? existing.name,
          email: nextEmail ?? existing.email,
        })
        .where(eq(customers.id, existing.id));
    }
    return {
      customerId: existing.id,
      locationId: location.id,
      name: nextName ?? existing.name,
      email: nextEmail ?? existing.email,
    };
  }

  const [inserted] = await db
    .insert(customers)
    .values({
      userId,
      locationId: location.id,
      name: input.name?.trim() || null,
      email: input.email?.trim() || null,
    })
    .returning({ id: customers.id, name: customers.name, email: customers.email });

  if (!inserted) return null;

  return {
    customerId: inserted.id,
    locationId: location.id,
    name: inserted.name,
    email: inserted.email,
  };
}
