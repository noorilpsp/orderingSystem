import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { customerLogout } from "@/app/actions/customer-auth";
import { db } from "@/db";
import {
  loyaltyAccounts,
  merchantLocations,
  merchants,
  normalizeLoyaltySettings,
} from "@/db/schema";
import { AccountRewardsPanel } from "@/components/mobile-ordering/account-rewards-panel";
import { listActivePublicLoyaltyRewards } from "@/lib/loyalty/listActivePublicLoyaltyRewards";
import { getLoggedInCustomer } from "@/lib/public-menu/getLoggedInCustomer";

export default async function AccountIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const params = await searchParams;
  const storeSlug = typeof params.store === "string" ? params.store : null;
  const customer = await getLoggedInCustomer(storeSlug);
  if (!customer) {
    redirect("/login");
  }

  let pointsRows: Array<{ merchantName: string; points: number; scopeLabel: string }> = [];
  let storeRewards: Awaited<ReturnType<typeof listActivePublicLoyaltyRewards>> = [];
  let storeBalance = 0;

  if (storeSlug && customer.loyaltyPoints !== null && customer.merchantId) {
    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.id, customer.merchantId),
      columns: { name: true, publicBrandName: true, loyaltySettings: true },
    });
    const settings = normalizeLoyaltySettings(merchant?.loyaltySettings);
    storeBalance = customer.loyaltyPoints;
    pointsRows = [
      {
        merchantName: merchant?.publicBrandName || merchant?.name || "This restaurant",
        points: customer.loyaltyPoints,
        scopeLabel:
          settings.pointsScope === "location" ? "This location" : "All locations",
      },
    ];
    if (settings.enabled && customer.locationId) {
      storeRewards = await listActivePublicLoyaltyRewards({
        merchantId: customer.merchantId,
        locationId: customer.locationId,
      });
    }
  } else {
    const accounts = await db.query.loyaltyAccounts.findMany({
      where: eq(loyaltyAccounts.userId, customer.userId),
      columns: { merchantId: true, locationId: true, balance: true },
      limit: 20,
    });
    if (accounts.length > 0) {
      const merchantIds = [...new Set(accounts.map((a) => a.merchantId))];
      const merchantRows = await db.query.merchants.findMany({
        where: inArray(merchants.id, merchantIds),
        columns: { id: true, name: true, publicBrandName: true, loyaltySettings: true },
      });
      const merchantById = new Map(merchantRows.map((m) => [m.id, m]));
      pointsRows = accounts
        .map((account) => {
          const merchant = merchantById.get(account.merchantId);
          const settings = normalizeLoyaltySettings(merchant?.loyaltySettings);
          return {
            merchantName: merchant?.publicBrandName || merchant?.name || "Restaurant",
            points: account.balance,
            scopeLabel:
              settings.pointsScope === "location" || account.locationId
                ? "Location balance"
                : "All locations",
          };
        })
        .sort((a, b) => b.points - a.points);
    }

    if (storeSlug) {
      const location = await db.query.merchantLocations.findFirst({
        where: eq(merchantLocations.storeSlug, storeSlug),
        columns: { id: true, merchantId: true },
      });
      if (location) {
        storeRewards = await listActivePublicLoyaltyRewards({
          merchantId: location.merchantId,
          locationId: location.id,
        });
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-10">
      <h1 className="text-2xl font-bold text-foreground">Your account</h1>
      <div className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm">
        <p className="text-base font-semibold text-foreground">{customer.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">{customer.email}</p>
      </div>

      <div className="space-y-3 rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Loyalty points</h2>
        {pointsRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sign in at a restaurant and complete an order to start earning points.
          </p>
        ) : (
          <ul className="space-y-2">
            {pointsRows.map((row, index) => (
              <li
                key={`${row.merchantName}-${row.scopeLabel}-${index}`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{row.merchantName}</p>
                  <p className="text-xs text-muted-foreground">{row.scopeLabel}</p>
                </div>
                <span className="shrink-0 font-semibold text-foreground">
                  {row.points} pts
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {storeSlug ? (
        <div className="space-y-3 rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Rewards</h2>
          <AccountRewardsPanel
            storeSlug={storeSlug}
            balance={storeBalance || pointsRows[0]?.points || 0}
            rewards={storeRewards}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Open your account from a restaurant menu to browse and select rewards.
        </p>
      )}

      <form
        action={async () => {
          "use server";
          await customerLogout("/login");
        }}
      >
        <button
          type="submit"
          className="flex h-11 w-full items-center justify-center rounded-xl border border-border/70 text-sm font-semibold text-foreground"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
