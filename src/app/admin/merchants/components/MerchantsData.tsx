import { Link } from '@/components/ui/link'
import { getAdminMerchants } from '@/lib/queries'
import { NewMerchantButton } from './NewMerchantButton'
import { Badge } from '@/components/ui/badge'

// Optimized date formatting - only format what we need
function formatDate(value: Date | string | null) {
  if (!value) return '-'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export async function MerchantsData() {
  const merchants = await getAdminMerchants()

  // Format dates in Server Component
  const formattedMerchants = merchants.map((merchant) => ({
    ...merchant,
    createdAtFormatted: formatDate(merchant.createdAt),
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Merchants</h1>
          <p className="text-muted-foreground">
            View and search merchants. Click a merchant to open details.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <NewMerchantButton />
        </div>
      </div>

      <div className="w-full p-4">
        <div className="mb-2 w-full flex-grow border-b-[1px] border-accent1 text-sm font-semibold text-black">
          {merchants.length.toLocaleString()} {merchants.length === 1 ? 'merchant' : 'merchants'}
        </div>
        <div className="flex flex-row flex-wrap justify-center gap-4 border-b-2 py-4 sm:justify-start">
          {formattedMerchants.map((merchant) => (
            <Link
              prefetch={true}
              key={merchant.id}
              className="flex w-[200px] flex-col items-start rounded-lg border p-4 hover:bg-accent2 transition-colors"
              href={`/admin/merchants/${merchant.id}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-base">{merchant.name}</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {merchant.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="capitalize">Type: {merchant.businessType}</div>
                <div>Created: {merchant.createdAtFormatted}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

