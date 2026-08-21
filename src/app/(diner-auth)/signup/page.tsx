import { Suspense } from "react";
import { cookies } from "next/headers";
import { CustomerAuthForm } from "@/components/mobile-ordering/customer-auth-form";
import { getPublicStoreCountry } from "@/lib/public-menu/getPublicStoreCountry";
import {
  GUEST_LAST_STORE_COOKIE,
  storeSlugFromGuestPath,
} from "@/lib/public-menu/guest-last-store";

async function SignupContent({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; store?: string }>;
}) {
  const params = await searchParams;
  const returnTo = typeof params.returnTo === "string" ? params.returnTo : undefined;
  const storeFromQuery = typeof params.store === "string" ? params.store : null;
  const cookieStore = await cookies();
  const storeFromCookie = cookieStore.get(GUEST_LAST_STORE_COOKIE)?.value ?? null;
  const storeSlug =
    storeFromQuery ?? storeSlugFromGuestPath(returnTo) ?? storeFromCookie;
  const storeCountry = await getPublicStoreCountry(storeSlug);
  return (
    <CustomerAuthForm
      mode="signup"
      returnTo={returnTo}
      storeSlug={storeSlug}
      defaultPhoneCountry={storeCountry}
    />
  );
}

export default function CustomerSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; store?: string }>;
}) {
  return (
    <Suspense fallback={<div className="w-full max-w-2xl">Loading...</div>}>
      <SignupContent searchParams={searchParams} />
    </Suspense>
  );
}
