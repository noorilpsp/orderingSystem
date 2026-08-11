import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { merchantUsers } from "@/lib/db/schema/merchant-users";
import { getPosUserId } from "@/lib/pos/posAuth";
import { supabaseServer } from "@/lib/supabaseServer";

export type OrdersStaffProfile = {
  name: string;
  email: string | null;
  roleLabel: string | null;
  initials: string;
};

function formatRoleLabel(role: string): string {
  if (!role) return role;
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function buildInitials(name: string, email: string | null): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0]!.length >= 2) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  if (email?.trim()) {
    return email.trim().slice(0, 2).toUpperCase();
  }
  return "U";
}

/** Resolve the signed-in staff profile for the orders header menu. */
export async function getOrdersStaffProfile(): Promise<OrdersStaffProfile | null> {
  const supabase = await supabaseServer();
  const authResult = await getPosUserId(supabase);
  if (!authResult.ok) return null;

  const userId = authResult.userId;

  const [profile] = await db
    .select({
      fullName: users.fullName,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [membership] = await db
    .select({ role: merchantUsers.role })
    .from(merchantUsers)
    .where(and(eq(merchantUsers.userId, userId), eq(merchantUsers.isActive, true)))
    .limit(1);

  const email = profile?.email ?? null;
  const name =
    profile?.fullName?.trim() ||
    email?.split("@")[0] ||
    "Staff";

  return {
    name,
    email,
    roleLabel: membership?.role ? formatRoleLabel(membership.role) : null,
    initials: buildInitials(name, email),
  };
}
