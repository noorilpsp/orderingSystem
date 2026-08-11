'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { z } from 'zod'
import { toast } from 'sonner'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { optimizeImage } from '@/lib/utils/imageOptimization'
import { uploadImage, updateMerchant } from '@/app/actions/merchants'

const businessTypes = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'bar', label: 'Bar' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'food_truck', label: 'Food Truck' },
  { value: 'other', label: 'Other' },
]

const merchantStatuses = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'inactive', label: 'Inactive' },
]

const subscriptionTiers = [
  { value: 'trial', label: 'Trial' },
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
]

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const formSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  legalName: z.string().min(1, 'Legal name is required'),
  contactEmail: z.string().email('Enter a valid email'),
  businessType: z.string().min(1, 'Business type is required'),
  status: z.string().min(1, 'Status is required'),
  notes: z.string().optional(),
  locationName: z.string().min(1, 'Location name is required'),
  phone: z.string().min(6, 'Phone is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  country: z.string().min(1, 'Country is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  ownerName: z.string().min(1, 'Owner name is required'),
  ownerEmail: z.string().email('Enter a valid owner email'),
  subscriptionTier: z.string().min(1, 'Subscription tier is required'),
  subscriptionExpiresAt: z.string().optional().or(z.literal('')),
  kdsEnabled: z.boolean(),
})

type MerchantFormValues = z.infer<typeof formSchema>

type Merchant = {
  id: string
  name: string
  legalName: string
  contactEmail: string
  phone: string
  address: string | null
  businessType: string
  status: string
  subscriptionTier: string
  subscriptionExpiresAt: Date | null
  timezone: string
  currency: string
  kdsEnabled: boolean
}

type Location = {
  id: string
  name: string
  address: string
  postalCode: string
  city: string
  phone: string
  email: string | null
  logoUrl: string | null
  bannerUrl: string | null
  status: string
}

type EditMerchantFormProps = {
  merchant: Merchant
  location?: Location
}

export function EditMerchantForm({ merchant, location }: EditMerchantFormProps) {
  const router = useRouter()
  const [values, setValues] = useState<MerchantFormValues>({
    name: merchant.name,
    legalName: merchant.legalName,
    contactEmail: merchant.contactEmail,
    businessType: merchant.businessType,
    status: merchant.status,
    notes: '',
    locationName: location?.name || '',
    phone: location?.phone || merchant.phone,
    address: location?.address || merchant.address || '',
    city: location?.city || '',
    country: '',
    timezone: merchant.timezone,
    ownerName: '',
    ownerEmail: '',
    subscriptionTier: merchant.subscriptionTier,
    subscriptionExpiresAt: merchant.subscriptionExpiresAt
      ? new Date(merchant.subscriptionExpiresAt).toISOString().split('T')[0]
      : '',
    kdsEnabled: merchant.kdsEnabled,
  })

  const [errors, setErrors] = useState<Partial<Record<keyof MerchantFormValues, string>>>({})
  const [fileErrors, setFileErrors] = useState<{ logo?: string; banner?: string }>({})
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(location?.logoUrl?.trimEnd() || null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(location?.bannerUrl?.trimEnd() || null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitStatus, setSubmitStatus] = useState<string>('')

  const setField = <K extends keyof MerchantFormValues>(key: K, value: MerchantFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const validateFile = (file: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return 'Only JPG, PNG, or WEBP are allowed'
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File must be 2MB or smaller'
    }
    return ''
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    kind: 'logo' | 'banner',
  ) => {
    const file = event.target.files?.[0]
    if (!file) {
      setFileErrors((prev) => ({ ...prev, [kind]: undefined }))
      if (kind === 'logo') {
        setLogoFile(null)
        setLogoPreview(location?.logoUrl?.trimEnd() || null)
      }
      if (kind === 'banner') {
        setBannerFile(null)
        setBannerPreview(location?.bannerUrl?.trimEnd() || null)
      }
      return
    }

    // Validate original file
    const message = validateFile(file)
    if (message) {
      setFileErrors((prev) => ({ ...prev, [kind]: message }))
      if (kind === 'logo') {
        setLogoFile(null)
        setLogoPreview(location?.logoUrl?.trimEnd() || null)
      }
      if (kind === 'banner') {
        setBannerFile(null)
        setBannerPreview(location?.bannerUrl?.trimEnd() || null)
      }
      return
    }

    try {
      // Optimize the image before storing
      setSubmitStatus(`Optimizing ${kind}...`)
      const optimizedFile = await optimizeImage(file, kind)

      // Validate optimized file size (should be smaller, but check anyway)
      if (optimizedFile.size > MAX_FILE_SIZE) {
        setFileErrors((prev) => ({
          ...prev,
          [kind]: 'File is too large even after optimization',
        }))
        if (kind === 'logo') {
          setLogoFile(null)
          setLogoPreview(location?.logoUrl || null)
        }
        if (kind === 'banner') {
          setBannerFile(null)
          setBannerPreview(location?.bannerUrl || null)
        }
        setSubmitStatus('')
        return
      }

      // Create preview from optimized file
      const previewUrl = URL.createObjectURL(optimizedFile)
      if (kind === 'logo') {
        setLogoFile(optimizedFile)
        setLogoPreview(previewUrl)
      } else {
        setBannerFile(optimizedFile)
        setBannerPreview(previewUrl)
      }
      setFileErrors((prev) => ({ ...prev, [kind]: undefined }))
      setSubmitStatus('')

      // Show optimization feedback
      const sizeReduction = ((1 - optimizedFile.size / file.size) * 100).toFixed(0)
      if (sizeReduction !== '0') {
        toast.success(`${kind} optimized: ${sizeReduction}% smaller`)
      }
    } catch (error) {
      console.error(`[handleFileChange] Error optimizing ${kind}:`, error)
      setFileErrors((prev) => ({
        ...prev,
        [kind]: 'Failed to process image. Please try again.',
      }))
      if (kind === 'logo') {
        setLogoFile(null)
        setLogoPreview(location?.logoUrl?.trimEnd() || null)
      }
      if (kind === 'banner') {
        setBannerFile(null)
        setBannerPreview(location?.bannerUrl?.trimEnd() || null)
      }
      setSubmitStatus('')
    }
  }

  const uploadFile = async (file: File): Promise<string> => {
    // Upload file to Vercel Blob via Server Action
    const formData = new FormData()
    formData.append('file', file)

    const result = await uploadImage(formData)

    if (result.error) {
      throw new Error(result.error)
    }

    if (!result.url) {
      throw new Error('Failed to upload file')
    }

    return result.url
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitStatus('Validating form...')

    try {
      const parsed = formSchema.safeParse(values)
      if (!parsed.success) {
        const fieldErrors: Partial<Record<keyof MerchantFormValues, string>> = {}
        for (const [field, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
          if (messages?.[0]) {
            fieldErrors[field as keyof MerchantFormValues] = messages[0]
          }
        }
        setErrors(fieldErrors)
        setIsSubmitting(false)
        return
      }

      const newFileErrors: { logo?: string; banner?: string } = {}
      if (logoFile) {
        const message = validateFile(logoFile)
        if (message) newFileErrors.logo = message
      }
      if (bannerFile) {
        const message = validateFile(bannerFile)
        if (message) newFileErrors.banner = message
      }
      setFileErrors(newFileErrors)
      if (newFileErrors.logo || newFileErrors.banner) {
        setIsSubmitting(false)
        return
      }

      setErrors({})

      // Upload new files if provided
      let logoUrl: string | undefined
      let bannerUrl: string | undefined

      if (logoFile) {
        setSubmitStatus('Uploading logo...')
        logoUrl = await uploadFile(logoFile)
      } else if (location?.logoUrl) {
        // Keep existing logo if no new file uploaded
        logoUrl = location.logoUrl.trimEnd()
      }

      if (bannerFile) {
        setSubmitStatus('Uploading banner...')
        bannerUrl = await uploadFile(bannerFile)
      } else if (location?.bannerUrl) {
        // Keep existing banner if no new file uploaded
        bannerUrl = location.bannerUrl.trimEnd()
      }

      // Submit to Server Action to update the merchant
      setSubmitStatus('Updating merchant...')
      const result = await updateMerchant({
        ...parsed.data,
        id: merchant.id,
        logoUrl,
        bannerUrl,
        country: values.country,
        locationId: location?.id,
      })

      if (result.error) {
        // Handle specific error cases
        if (result.error.includes('Forbidden') || result.error.includes('permission')) {
          throw new Error('You do not have permission to update merchants')
        } else if (result.error.includes('Invalid') || result.error.includes('required')) {
          throw new Error(result.error || 'Invalid data. Please check all required fields.')
        } else if (result.error.includes('not found')) {
          throw new Error('Merchant not found')
        } else {
          throw new Error(result.error || 'Failed to update merchant')
        }
      }

      toast.success('Merchant updated successfully', {
        description: `${result.merchant?.name || 'Merchant'} has been updated.`,
      })

      // Redirect to merchant detail page
      setTimeout(() => {
        router.push(`/admin/merchants/${merchant.id}`)
      }, 500)
    } catch (error) {
      console.error('Error submitting form:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to update merchant'
      setSubmitError(errorMessage)
      setSubmitStatus('')

      toast.error('Failed to update merchant', {
        description: errorMessage,
      })
    } finally {
      setIsSubmitting(false)
      setSubmitStatus('')
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {submitError && (
        <div className="bg-destructive/10 text-destructive rounded-lg border border-destructive/20 p-3 text-sm">
          {submitError}
        </div>
      )}

      <Accordion type="multiple" defaultValue={['business', 'modules', 'location', 'owner']}>
        <AccordionItem value="business">
          <AccordionTrigger className="text-left text-lg font-semibold">
            Business Information
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Business name</Label>
                <Input
                  id="name"
                  name="name"
                  value={values.name}
                  onChange={(event) => setField('name', event.target.value)}
                  placeholder="BerryTap Bistro"
                />
                {errors.name && <p className="text-destructive text-sm">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalName">Legal name</Label>
                <Input
                  id="legalName"
                  name="legalName"
                  value={values.legalName}
                  onChange={(event) => setField('legalName', event.target.value)}
                  placeholder="BerryTap BV"
                />
                {errors.legalName && <p className="text-destructive text-sm">{errors.legalName}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact email</Label>
                <Input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  value={values.contactEmail}
                  onChange={(event) => setField('contactEmail', event.target.value)}
                  placeholder="contact@berrytap.com"
                />
                {errors.contactEmail && <p className="text-destructive text-sm">{errors.contactEmail}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessType">Business type</Label>
                <Select
                  name="businessType"
                  value={values.businessType}
                  onValueChange={(value) => setField('businessType', value)}
                >
                  <SelectTrigger id="businessType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.businessType && <p className="text-destructive text-sm">{errors.businessType}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select name="status" value={values.status} onValueChange={(value) => setField('status', value)}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchantStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.status && <p className="text-destructive text-sm">{errors.status}</p>}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  value={values.notes ?? ''}
                  onChange={(event) => setField('notes', event.target.value)}
                  placeholder="Internal notes..."
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="modules">
          <AccordionTrigger className="text-left text-lg font-semibold">
            Modules / Access
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div className="min-w-0 space-y-1">
                <Label htmlFor="kds-enabled" className="text-base font-medium">
                  Kitchen Display (KDS)
                </Label>
                <p className="text-muted-foreground text-sm">
                  When enabled, staff get KDS screens, station settings, and item prep-station
                  fields. When off, orders are not routed to KDS.
                </p>
              </div>
              <Switch
                id="kds-enabled"
                checked={values.kdsEnabled}
                onCheckedChange={(checked) => setField('kdsEnabled', checked)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="location">
          <AccordionTrigger className="text-left text-lg font-semibold">
            First Location
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="logo">Logo (2MB max, JPG/PNG/WEBP)</Label>
                <Input
                  id="logo"
                  name="logo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => handleFileChange(event, 'logo')}
                />
                {logoPreview && (
                  <div className="border-muted bg-muted/30 text-sm text-muted-foreground flex items-center gap-3 rounded-md border p-2">
                    <div className="relative size-12">
                      <Image
                        src={logoPreview.trimEnd()}
                        alt="Logo preview"
                        fill
                        className="rounded object-cover"
                        unoptimized={logoPreview.trimEnd().startsWith('data:')}
                      />
                    </div>
                    <span className="truncate">
                      {logoFile?.name || (location?.logoUrl ? 'Current logo' : 'No logo')}
                    </span>
                  </div>
                )}
                {fileErrors.logo && <p className="text-destructive text-sm">{fileErrors.logo}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner">Banner (2MB max, JPG/PNG/WEBP)</Label>
                <Input
                  id="banner"
                  name="banner"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => handleFileChange(event, 'banner')}
                />
                {bannerPreview && (
                  <div className="border-muted bg-muted/30 text-sm text-muted-foreground flex items-center gap-3 rounded-md border p-2">
                    <img src={bannerPreview.trimEnd()} alt="Banner preview" className="h-14 w-24 rounded object-cover" />
                    <span className="truncate">
                      {bannerFile?.name || (location?.bannerUrl ? 'Current banner' : 'No banner')}
                    </span>
                  </div>
                )}
                {fileErrors.banner && <p className="text-destructive text-sm">{fileErrors.banner}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationName">Location name</Label>
                <Input
                  id="locationName"
                  name="locationName"
                  value={values.locationName}
                  onChange={(event) => setField('locationName', event.target.value)}
                  placeholder="Central Station"
                />
                {errors.locationName && <p className="text-destructive text-sm">{errors.locationName}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={values.phone}
                  onChange={(event) => setField('phone', event.target.value)}
                  placeholder="+32 123 456 789"
                />
                {errors.phone && <p className="text-destructive text-sm">{errors.phone}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  name="address"
                  value={values.address}
                  onChange={(event) => setField('address', event.target.value)}
                  placeholder="123 Main Street"
                />
                {errors.address && <p className="text-destructive text-sm">{errors.address}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  value={values.city}
                  onChange={(event) => setField('city', event.target.value)}
                  placeholder="Brussels"
                />
                {errors.city && <p className="text-destructive text-sm">{errors.city}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  name="country"
                  value={values.country}
                  onChange={(event) => setField('country', event.target.value)}
                  placeholder="Belgium"
                />
                {errors.country && <p className="text-destructive text-sm">{errors.country}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  name="timezone"
                  value={values.timezone}
                  onChange={(event) => setField('timezone', event.target.value)}
                  placeholder="Europe/Brussels"
                />
                {errors.timezone && <p className="text-destructive text-sm">{errors.timezone}</p>}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="owner">
          <AccordionTrigger className="text-left text-lg font-semibold">
            Owner & Subscription
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ownerName">Owner full name</Label>
                <Input
                  id="ownerName"
                  name="ownerName"
                  value={values.ownerName}
                  onChange={(event) => setField('ownerName', event.target.value)}
                  placeholder="Noor Ilani"
                />
                {errors.ownerName && <p className="text-destructive text-sm">{errors.ownerName}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerEmail">Owner email</Label>
                <Input
                  id="ownerEmail"
                  name="ownerEmail"
                  type="email"
                  value={values.ownerEmail}
                  onChange={(event) => setField('ownerEmail', event.target.value)}
                  placeholder="owner@example.com"
                />
                {errors.ownerEmail && <p className="text-destructive text-sm">{errors.ownerEmail}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscriptionTier">Subscription tier</Label>
                <Select
                  name="subscriptionTier"
                  value={values.subscriptionTier}
                  onValueChange={(value) => setField('subscriptionTier', value)}
                >
                  <SelectTrigger id="subscriptionTier">
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {subscriptionTiers.map((tier) => (
                      <SelectItem key={tier.value} value={tier.value}>
                        {tier.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.subscriptionTier && <p className="text-destructive text-sm">{errors.subscriptionTier}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscriptionExpiresAt">Subscription expiry</Label>
                <Input
                  id="subscriptionExpiresAt"
                  name="subscriptionExpiresAt"
                  type="date"
                  value={values.subscriptionExpiresAt ?? ''}
                  onChange={(event) => setField('subscriptionExpiresAt', event.target.value)}
                />
                {errors.subscriptionExpiresAt && (
                  <p className="text-destructive text-sm">{errors.subscriptionExpiresAt}</p>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (submitStatus || 'Updating merchant...') : 'Update'}
        </Button>
      </div>
    </form>
  )
}

