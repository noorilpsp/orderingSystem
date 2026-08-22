import { Building2, Calendar, Mail, MapPin, Phone, Tag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

type Merchant = {
  legalName: string
  kboNumber: string | null
  contactEmail: string
  contactPhone: string
  registeredAddressLine1: string | null
  subscriptionTier: string
  subscriptionExpiresAt: Date | string | null
  defaultTimezone: string
  defaultCurrency: string
  createdAt: Date | string
  updatedAt: Date | string
}

type MerchantInfoCardsProps = {
  merchant: Merchant
}

function formatDate(value: Date | string | null) {
  if (!value) return '-'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function MerchantInfoCards({ merchant }: MerchantInfoCardsProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Merchant Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-5" />
            Business Information
          </CardTitle>
          <CardDescription>Core merchant details and contact information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Legal Name</div>
            <div className="text-sm">{merchant.legalName || '-'}</div>
          </div>
          {merchant.kboNumber && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">KBO Number</div>
              <div className="text-sm">{merchant.kboNumber}</div>
            </div>
          )}
          <Separator />
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Contact Email</div>
            <div className="text-sm flex items-center gap-2">
              <Mail className="size-4" />
              <a href={`mailto:${merchant.contactEmail}`} className="hover:underline">
                {merchant.contactEmail}
              </a>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Phone</div>
            <div className="text-sm flex items-center gap-2">
              <Phone className="size-4" />
              <a href={`tel:${merchant.contactPhone}`} className="hover:underline">
                {merchant.contactPhone}
              </a>
            </div>
          </div>
          {merchant.registeredAddressLine1 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Address</div>
              <div className="text-sm flex items-center gap-2">
                <MapPin className="size-4" />
                {merchant.registeredAddressLine1}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscription & Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="size-5" />
            Subscription & Settings
          </CardTitle>
          <CardDescription>Subscription tier and business configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Subscription Tier</div>
            <Badge variant="outline" className="capitalize">
              {merchant.subscriptionTier}
            </Badge>
          </div>
          {merchant.subscriptionExpiresAt && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Subscription Expires</div>
              <div className="text-sm flex items-center gap-2">
                <Calendar className="size-4" />
                {formatDate(merchant.subscriptionExpiresAt)}
              </div>
            </div>
          )}
          <Separator />
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Timezone</div>
            <div className="text-sm">{merchant.defaultTimezone}</div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Currency</div>
            <div className="text-sm">{merchant.defaultCurrency}</div>
          </div>
          <Separator />
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Created</div>
            <div className="text-sm flex items-center gap-2">
              <Calendar className="size-4" />
              {formatDate(merchant.createdAt)}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Last Updated</div>
            <div className="text-sm flex items-center gap-2">
              <Calendar className="size-4" />
              {formatDate(merchant.updatedAt)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
