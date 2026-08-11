import { Suspense } from "react";
import { CustomerResetPasswordForm } from "@/components/mobile-ordering/customer-reset-password-form";

function ResetPasswordFormSkeleton() {
  return (
    <div className="w-full max-w-2xl">
      <div className="p-6 sm:p-12 sm:shadow-xl sm:border sm:border-border/40 sm:bg-card sm:rounded-3xl">
        <div className="space-y-8">
          <div className="flex justify-center">
            <div className="w-28 h-28 relative bg-muted animate-pulse rounded" />
          </div>
          <div className="text-center space-y-4">
            <div className="h-8 bg-muted animate-pulse rounded w-64 mx-auto" />
            <div className="h-4 bg-muted animate-pulse rounded w-48 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFormSkeleton />}>
      <CustomerResetPasswordForm />
    </Suspense>
  );
}
