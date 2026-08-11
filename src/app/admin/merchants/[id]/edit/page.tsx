import { notFound } from 'next/navigation'
import { getMerchantWithLocations } from '@/lib/queries'
import { EditMerchantForm } from './components/EditMerchantForm'
import { Link } from '@/components/ui/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function EditMerchantPage({ params }: PageProps) {
  const { id } = await params

  if (!id) {
    return notFound()
  }

  const merchantId = decodeURIComponent(id)
  const merchant = await getMerchantWithLocations(merchantId)

  if (!merchant || !merchant.id) {
    return notFound()
  }

  // Get the first location (or undefined if none)
  const firstLocation = merchant.locations?.[0]

  return (
    <div className="container space-y-6 p-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/admin/merchants/${merchant.id}`}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to merchant</span>
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Edit Merchant</h1>
          <p className="text-muted-foreground mt-1">{merchant.name}</p>
        </div>
      </div>

      <EditMerchantForm
        merchant={{
          id: merchant.id,
          name: merchant.name,
          legalName: merchant.legalName,
          contactEmail: merchant.contactEmail,
          phone: merchant.contactPhone,
          address: merchant.registeredAddressLine1 ?? '',
          businessType: merchant.businessType,
          status: merchant.status,
          subscriptionTier: merchant.subscriptionTier,
          subscriptionExpiresAt: merchant.subscriptionExpiresAt,
          timezone: merchant.defaultTimezone,
          currency: merchant.defaultCurrency,
          kdsEnabled: merchant.features?.kds === true,
        }}
        location={
          firstLocation
            ? {
                id: firstLocation.id,
                name: firstLocation.name,
                address: firstLocation.address,
                postalCode: firstLocation.postalCode,
                city: firstLocation.city,
                phone: firstLocation.phone,
                email: firstLocation.email ?? null,
                logoUrl: firstLocation.logoUrl ?? null,
                bannerUrl: firstLocation.bannerUrl ?? null,
                status: firstLocation.status,
              }
            : undefined
        }
      />
    </div>
  )
}
