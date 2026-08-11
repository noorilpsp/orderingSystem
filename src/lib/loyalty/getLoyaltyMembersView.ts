import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { merchantUsers } from "@/lib/db/schema/merchant-users";
import { supabaseServer } from "@/lib/supabaseServer";
import { buildLoyaltyMembersView } from "@/lib/loyalty/buildLoyaltyMembersView";
import type { LoyaltyMembersView } from "@/lib/loyalty/loyaltyMembersView";

export type GetLoyaltyMembersViewResult =
  | { data: LoyaltyMembersView }
  | { error: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "BAD_REQUEST" };

export async function getLoyaltyMembersView(input: {
  merchantId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  locationId?: string | null;
  userId: string;
}): Promise<GetLoyaltyMembersViewResult> {
  if (!input.merchantId.trim()) {
    return { error: "BAD_REQUEST" };
  }

  const membership = await db.query.merchantUsers.findFirst({
    where: and(
      eq(merchantUsers.merchantId, input.merchantId),
      eq(merchantUsers.userId, input.userId),
      eq(merchantUsers.isActive, true),
    ),
    columns: { id: true },
  });
  if (!membership) {
    return { error: "FORBIDDEN" };
  }

  const view = await buildLoyaltyMembersView({
    merchantId: input.merchantId,
    page: input.page,
    pageSize: input.pageSize,
    search: input.search,
    locationId: input.locationId,
  });
  if (!view) {
    return { error: "NOT_FOUND" };
  }

  return { data: view };
}

export async function getLoyaltyMembersViewForRequest(input: {
  merchantId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  locationId?: string | null;
}): Promise<GetLoyaltyMembersViewResult> {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: "UNAUTHORIZED" };
  }

  return getLoyaltyMembersView({
    ...input,
    userId: user.id,
  });
}
