import { Suspense } from "react";
import { CustomerAuthForm } from "@/components/mobile-ordering/customer-auth-form";

async function SignupContent({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const returnTo = typeof params.returnTo === "string" ? params.returnTo : undefined;
  return <CustomerAuthForm mode="signup" returnTo={returnTo} />;
}

export default function CustomerSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  return (
    <Suspense fallback={<div className="w-full max-w-2xl">Loading...</div>}>
      <SignupContent searchParams={searchParams} />
    </Suspense>
  );
}
