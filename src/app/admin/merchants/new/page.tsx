import { MerchantOnboardingForm } from "./components/MerchantOnboardingForm";

export default function NewMerchantPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Onboard a store</h1>
        <p className="text-muted-foreground">
          Create a store with whatever you have. Invite the owner if you have their email. They
          finish hours, branding, and the public menu URL in Dashboard → Stores.
        </p>
      </div>

      <MerchantOnboardingForm />
    </div>
  );
}
