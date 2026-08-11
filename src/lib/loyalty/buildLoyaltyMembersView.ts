import { and, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/lib/db/schema/orders";
import {
  loyaltyAccounts,
  loyaltyLedgerEntries,
  merchantLocations,
  merchants,
  normalizeLoyaltySettings,
} from "@/lib/db/schema";
import type { LoyaltyMembersView, LoyaltyMemberRow } from "@/lib/loyalty/loyaltyMembersView";

export type BuildLoyaltyMembersInput = {
  merchantId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  locationId?: string | null;
};

function pickBestCustomer(
  rows: Array<{
    name: string | null;
    email: string | null;
    phone: string | null;
  }>,
): { name: string; email: string | null; phone: string | null } {
  const sorted = [...rows].sort((a, b) => {
    const aScore = (a.email ? 2 : 0) + (a.name ? 1 : 0);
    const bScore = (b.email ? 2 : 0) + (b.name ? 1 : 0);
    return bScore - aScore;
  });
  const best = sorted[0];
  return {
    name: best?.name?.trim() || "Member",
    email: best?.email ?? null,
    phone: best?.phone ?? null,
  };
}

export async function buildLoyaltyMembersView(
  input: BuildLoyaltyMembersInput,
): Promise<LoyaltyMembersView | null> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  const search = input.search?.trim() ?? "";

  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, input.merchantId),
    columns: { id: true, loyaltySettings: true },
  });
  if (!merchant) return null;

  const settings = normalizeLoyaltySettings(merchant.loyaltySettings);
  const accountScope =
    settings.pointsScope === "location" && input.locationId
      ? and(
          eq(loyaltyAccounts.merchantId, input.merchantId),
          eq(loyaltyAccounts.locationId, input.locationId),
        )
      : and(
          eq(loyaltyAccounts.merchantId, input.merchantId),
          isNull(loyaltyAccounts.locationId),
        );

  const matchingUserIds =
    search.length > 0
      ? await db
          .selectDistinct({ userId: customers.userId })
          .from(customers)
          .innerJoin(
            merchantLocations,
            eq(customers.locationId, merchantLocations.id),
          )
          .where(
            and(
              eq(merchantLocations.merchantId, input.merchantId),
              isNotNull(customers.userId),
              or(
                ilike(customers.name, `%${search}%`),
                ilike(customers.email, `%${search}%`),
              ),
            ),
          )
      : null;

  const searchFilter =
    matchingUserIds && matchingUserIds.length > 0
      ? inArray(
          loyaltyAccounts.userId,
          matchingUserIds
            .map((row) => row.userId)
            .filter((id): id is string => typeof id === "string" && id.length > 0),
        )
      : matchingUserIds
        ? sql`false`
        : undefined;

  const whereClause =
    searchFilter !== undefined ? and(accountScope, searchFilter) : accountScope;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loyaltyAccounts)
    .where(whereClause);

  const totalCount = countRow?.count ?? 0;

  const accountRows = await db.query.loyaltyAccounts.findMany({
    where: whereClause,
    columns: {
      id: true,
      userId: true,
      balance: true,
      createdAt: true,
    },
    orderBy: [desc(loyaltyAccounts.balance), desc(loyaltyAccounts.updatedAt)],
    limit: pageSize,
    offset,
  });

  if (accountRows.length === 0) {
    return {
      merchantId: input.merchantId,
      members: [],
      totalCount,
      page,
      pageSize,
    };
  }

  const accountIds = accountRows.map((row) => row.id);
  const userIds = accountRows.map((row) => row.userId);

  const [customerRows, redeemCountRows] = await Promise.all([
    db
      .select({
        userId: customers.userId,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        customerId: customers.id,
      })
      .from(customers)
      .innerJoin(merchantLocations, eq(customers.locationId, merchantLocations.id))
      .where(
        and(
          eq(merchantLocations.merchantId, input.merchantId),
          inArray(customers.userId, userIds),
        ),
      ),
    db
      .select({
        accountId: loyaltyLedgerEntries.accountId,
        count: sql<number>`count(*)::int`,
      })
      .from(loyaltyLedgerEntries)
      .where(
        and(
          inArray(loyaltyLedgerEntries.accountId, accountIds),
          eq(loyaltyLedgerEntries.kind, "redeem"),
        ),
      )
      .groupBy(loyaltyLedgerEntries.accountId),
  ]);

  const customersByUserId = new Map<
    string,
    Array<{ name: string | null; email: string | null; phone: string | null }>
  >();
  const customerIdsByUserId = new Map<string, string[]>();
  for (const row of customerRows) {
    if (!row.userId) continue;
    const list = customersByUserId.get(row.userId) ?? [];
    list.push({
      name: row.name,
      email: row.email,
      phone: row.phone,
    });
    customersByUserId.set(row.userId, list);

    const ids = customerIdsByUserId.get(row.userId) ?? [];
    ids.push(row.customerId);
    customerIdsByUserId.set(row.userId, ids);
  }

  const allCustomerIds = customerRows.map((row) => row.customerId);
  const lastVisitByUserId = new Map<string, Date>();

  if (allCustomerIds.length > 0) {
    const completedOrders = await db
      .select({
        customerId: orders.customerId,
        completedAt: orders.completedAt,
        updatedAt: orders.updatedAt,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .innerJoin(merchantLocations, eq(orders.locationId, merchantLocations.id))
      .where(
        and(
          eq(merchantLocations.merchantId, input.merchantId),
          eq(orders.status, "completed"),
          inArray(orders.customerId, allCustomerIds),
        ),
      );

    const customerIdToUserId = new Map<string, string>();
    for (const [userId, ids] of customerIdsByUserId) {
      for (const customerId of ids) {
        customerIdToUserId.set(customerId, userId);
      }
    }

    for (const order of completedOrders) {
      if (!order.customerId) continue;
      const userId = customerIdToUserId.get(order.customerId);
      if (!userId) continue;
      const visitAt = order.completedAt ?? order.updatedAt ?? order.createdAt;
      const existing = lastVisitByUserId.get(userId);
      if (!existing || visitAt.getTime() > existing.getTime()) {
        lastVisitByUserId.set(userId, visitAt);
      }
    }
  }

  const redeemCountByAccountId = new Map<string, number>();
  for (const row of redeemCountRows) {
    redeemCountByAccountId.set(row.accountId, row.count);
  }

  const members: LoyaltyMemberRow[] = accountRows.map((account) => {
    const profile = pickBestCustomer(customersByUserId.get(account.userId) ?? []);
    const lastVisit = lastVisitByUserId.get(account.userId);
    return {
      id: account.id,
      userId: account.userId,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      balance: account.balance,
      joinedAt: account.createdAt.toISOString(),
      rewardsRedeemed: redeemCountByAccountId.get(account.id) ?? 0,
      lastVisitAt: lastVisit ? lastVisit.toISOString() : null,
    };
  });

  return {
    merchantId: input.merchantId,
    members,
    totalCount,
    page,
    pageSize,
  };
}
