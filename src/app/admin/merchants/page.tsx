import { getAdminMerchants } from '@/lib/queries'
import { MerchantsSearchable } from './components/MerchantsSearchable'

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

export default async function AdminMerchantsPage() {
  const merchants = await getAdminMerchants()

  // Format dates in Server Component
  const formattedMerchants = merchants.map((merchant) => {
    return {
      ...merchant,
      createdAtFormatted: formatDate(merchant.createdAt),
    }
  })

  return <MerchantsSearchable initialMerchants={formattedMerchants} />
}
