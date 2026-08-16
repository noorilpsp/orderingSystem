import { notFound } from "next/navigation";
import { getMerchantWithLocations } from "@/lib/queries";
import { EditMerchantForm } from "./components/EditMerchantForm";
import { Link } from "@/components/ui/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditMerchantPage({ params }: PageProps) {
  const { id } = await params;

  if (!id) {
    return notFound();
  }

  const merchantId = decodeURIComponent(id);
  const merchant = await getMerchantWithLocations(merchantId);

  if (!merchant || !merchant.id) {
    return notFound();
  }

  const firstLocation = merchant.locations?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/admin/merchants/${merchant.id}`}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to store</span>
          </Link>
        </Button>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Edit store</h1>
          <p className="text-muted-foreground">
            Same fields as onboarding. Hours, branding, and the public menu URL stay in Dashboard →
            Stores.
          </p>
        </div>
      </div>

      <EditMerchantForm
        merchant={{
          id: merchant.id,
          name: merchant.name,
          legalName: merchant.legalName,
          kboNumber: merchant.kboNumber ?? null,
          contactEmail: merchant.contactEmail,
          phone: merchant.contactPhone,
          businessType: merchant.businessType,
          status: merchant.status,
          subscriptionTier: merchant.subscriptionTier,
          subscriptionExpiresAt: merchant.subscriptionExpiresAt,
          kdsEnabled: merchant.features?.kds === true,
        }}
        location={
          firstLocation
            ? {
                id: firstLocation.id,
                name: firstLocation.name,
                address: firstLocation.address,
                addressLine2: firstLocation.addressLine2 ?? null,
                postalCode: firstLocation.postalCode,
                city: firstLocation.city,
                country: firstLocation.country,
                phone: firstLocation.phone,
                email: firstLocation.email ?? null,
                storeType: firstLocation.storeType ?? null,
              }
            : undefined
        }
      />
    </div>
  );
}
