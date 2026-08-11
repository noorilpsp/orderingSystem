export type LoyaltyMemberRow = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  balance: number;
  joinedAt: string;
  /** Count of ledger rows with kind=redeem for this account. */
  rewardsRedeemed: number;
  /** ISO timestamp of most recent completed order for this user at the merchant; null if none. */
  lastVisitAt: string | null;
};

export type LoyaltyMembersView = {
  merchantId: string;
  members: LoyaltyMemberRow[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export function isLoyaltyMembersView(value: unknown): value is LoyaltyMembersView {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.merchantId === "string" &&
    Array.isArray(record.members) &&
    typeof record.totalCount === "number"
  );
}
