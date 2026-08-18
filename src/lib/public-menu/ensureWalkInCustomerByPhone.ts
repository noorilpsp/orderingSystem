import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/lib/db/schema/orders";

export async function ensureWalkInCustomerByPhone(input: {
  locationId: string;
  phone: string;
}): Promise<string | null> {
  const phone = input.phone.trim();
  if (!phone) return null;

  const existing = await db.query.customers.findFirst({
    where: and(
      eq(customers.locationId, input.locationId),
      eq(customers.phone, phone),
      isNull(customers.userId),
    ),
    columns: { id: true },
  });
  if (existing?.id) return existing.id;

  const [inserted] = await db
    .insert(customers)
    .values({
      locationId: input.locationId,
      phone,
    })
    .returning({ id: customers.id });

  return inserted?.id ?? null;
}
