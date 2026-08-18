import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AccountSettingsSection } from "@/components/mobile-ordering/account-settings-section";
import { getLoggedInCustomer } from "@/lib/public-menu/getLoggedInCustomer";

export default async function AccountSettingsPage({
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

  const backHref = storeSlug
    ? `/account?store=${encodeURIComponent(storeSlug)}`
    : "/account";

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-10">
      <div className="flex items-center gap-2">
        <Link
          href={backHref}
          aria-label="Back to account"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-foreground/10"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      <AccountSettingsSection
        email={customer.email}
        name={customer.name}
        phone={customer.phone}
        storeSlug={storeSlug}
      />
    </div>
  );
}
