import { Suspense } from "react";
import { CustomerAuthForm } from "@/components/mobile-ordering/customer-auth-form";

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const returnTo = typeof params.returnTo === "string" ? params.returnTo : undefined;
  return <CustomerAuthForm mode="login" returnTo={returnTo} />;
}

export default function CustomerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  return (
    <Suspense fallback={<div className="w-full max-w-2xl">Loading...</div>}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
