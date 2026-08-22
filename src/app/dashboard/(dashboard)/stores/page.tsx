"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { coerceTaxRatePercent } from "@/lib/tax-rate"
import { timezoneFromCountry } from "@/lib/timezone/fromCountry"
import { phoneCountryFromStoreCountry } from "@/lib/public-menu/guest-phone"
import { PhoneNumberField } from "@/components/shared/phone-number-field"
import {
  Save,
  X,
  MapPin,
  Clock,
  Globe,
  Globe2,
  ExternalLink,
  Settings,
  StoreIcon,
  Palette,
  Upload,
  AlertCircle,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTenant } from "@/lib/contexts/TenantContext"
import { useLocations } from "@/lib/hooks/useLocations"
import { useCurrentMerchant } from "@/lib/hooks/useCurrentMerchant"
import { buildPublicMenuUrl, GUEST_MENU_ORIGIN } from "@/lib/public-menu/buildPublicMenuUrl";
import type { Merchant } from "@/lib/db/schema/merchants"
import type { MerchantLocation, OpeningHours, OrderModes } from "@/lib/db/schema/merchant-locations"
import { DEFAULT_PICKUP_INSTRUCTIONS } from "@/lib/guest-menu/types"
import {
  mapMerchantLanguageToGuestLocale,
  merchantCurrencySymbol,
  normalizeAvailableGuestLocales,
} from "@/lib/merchant-localization"
import { StoreTablesManager } from "@/components/dashboard/store-tables-manager"
import { StoreMenuQrButton } from "@/components/dashboard/table-qr-dialog"
import { isReservedStoreSlug } from "@/lib/public-menu/guestMenuPaths"

// Zod Schema
const storeInfoSchema = z.object({
  storeName: z.string().min(1, "Store name is required").max(100),
  storeType: z.enum(["restaurant", "bar", "cafe", "grocery", "other"]),
  shortDescription: z.string().max(300).optional(),
  storeSlug: z
    .string()
    .min(1, "Store URL is required")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens")
    .refine((slug) => !isReservedStoreSlug(slug), "This URL is reserved"),
  address: z.object({
    street: z.string().optional().or(z.literal("")),
    apartment: z.string().optional(),
    postalCode: z.string().optional().or(z.literal("")),
    city: z.string().optional().or(z.literal("")),
    country: z.string().optional().or(z.literal("")),
  }),
  phoneNumber: z.string().optional().or(z.literal("")),
  publicEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  useBusinessEmail: z.boolean(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  tiktok: z.string().optional(),
  openingHours: z.array(
    z.object({
      day: z.number(),
      closed: z.boolean(),
      shifts: z.array(
        z.object({
          open: z.string(),
          close: z.string(),
        }),
      ),
    }),
  ),
  enableTables: z.boolean(),
  enableReservations: z.boolean(),
  requirePrepayment: z.boolean(),
  maxPartySize: z.number().min(1).max(50),
  bookingWindow: z.number().min(1).max(90),
  enableOnlineOrders: z.boolean(),
  orderModes: z.object({
    dineIn: z.boolean(),
    pickup: z.boolean(),
    delivery: z.boolean(),
    dineInGuestSessionMode: z.enum(["staff_seated", "self_service"]).default("staff_seated"),
    pickupInstructions: z.string().max(500).optional(),
  }),
  deliveryRadius: z.number().optional(),
  deliveryFee: z.number().optional(),
  minimumOrder: z.number().optional(),
  taxRate: z.number().min(0).max(100),
  storeStatus: z.enum(["active", "inactive", "coming-soon"]),
  publicListing: z.boolean(),
  timezone: z.string(),
  useBusinessTimezone: z.boolean(),
  primaryBrandColor: z.string().default("#0F172A"),
  accentColor: z.string().optional(),
  defaultCurrency: z.string().min(1),
  availableLanguages: z
    .array(z.enum(["en", "ar"]))
    .min(1, "Select at least one language"),
  defaultLanguage: z.enum(["en", "ar"]),
  dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
  numberFormat: z.enum(["1,234.56", "1.234,56"]),
}).superRefine((data, ctx) => {
  if (!data.availableLanguages.includes(data.defaultLanguage)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaultLanguage"],
      message: "Default language must be one of the selected languages",
    })
  }
})

type StoreInfoFormData = z.infer<typeof storeInfoSchema>

const storeTypes = [
  { value: "restaurant", label: "Restaurant", icon: "🍽️" },
  { value: "bar", label: "Bar", icon: "🍺" },
  { value: "cafe", label: "Café", icon: "☕" },
  { value: "grocery", label: "Grocery", icon: "🛒" },
  { value: "other", label: "Other", icon: "🏪" },
]

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const timeSlots = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2)
  const minute = i % 2 === 0 ? "00" : "30"
  return `${hour.toString().padStart(2, "0")}:${minute}`
})

const countries = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "FR", label: "France" },
  { value: "DE", label: "Germany" },
  { value: "ES", label: "Spain" },
  { value: "IT", label: "Italy" },
  { value: "LB", label: "Lebanon" },
  { value: "NL", label: "Netherlands" },
  { value: "BE", label: "Belgium" },
]

const commonPresets = [
  { name: "Restaurant hours (11:00-23:00)", open: "11:00", close: "23:00" },
  { name: "Bar hours (16:00-02:00)", open: "16:00", close: "02:00" },
  { name: "24/7 convenience store", open: "00:00", close: "23:59" },
]

// Day name mapping for opening hours conversion
const dayNameMap: Record<number, keyof OpeningHours> = {
  0: "monday",
  1: "tuesday",
  2: "wednesday",
  3: "thursday",
  4: "friday",
  5: "saturday",
  6: "sunday",
}

const dayIndexMap: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
}

// Helper: Convert form opening hours array to database JSONB format
function formOpeningHoursToDb(
  formHours: Array<{ day: number; closed: boolean; shifts: Array<{ open: string; close: string }> }>
): OpeningHours {
  const dbHours: OpeningHours = {}
  for (const item of formHours) {
    const dayName = dayNameMap[item.day]
    if (dayName) {
      // If closed, set empty array; otherwise use shifts
      dbHours[dayName] = item.closed ? [] : item.shifts
    }
  }
  return dbHours
}

// Helper: Convert database JSONB opening hours to form array format
function dbOpeningHoursToForm(
  dbHours: OpeningHours | null | undefined
): Array<{ day: number; closed: boolean; shifts: Array<{ open: string; close: string }> }> {
  return dayNames.map((_, index) => {
    const dayName = dayNameMap[index]
    const shifts = dbHours?.[dayName] ?? []
    return {
      day: index,
      closed: shifts.length === 0,
      shifts: shifts.length > 0 ? shifts : [{ open: "11:00", close: "23:00" }],
    }
  })
}

// Helper: Convert form order modes to database JSONB format
function formOrderModesToDb(
  formModes: {
    dineIn: boolean;
    pickup: boolean;
    delivery: boolean;
    dineInGuestSessionMode: "staff_seated" | "self_service";
    pickupInstructions?: string;
  },
  deliverySettings?: { radius?: number; fee?: number; minimumOrder?: number },
  existing?: OrderModes | null,
): OrderModes {
  const instructions = formModes.pickupInstructions?.trim() ?? "";
  return {
    dine_in: {
      enabled: formModes.dineIn,
      guest_session_mode: formModes.dineInGuestSessionMode,
    },
    pickup: {
      enabled: formModes.pickup,
      estimated_time_minutes: existing?.pickup?.estimated_time_minutes,
      instructions,
    },
    delivery: {
      enabled: formModes.delivery,
      radius_km: deliverySettings?.radius,
      delivery_fee: deliverySettings?.fee,
      minimum_order: deliverySettings?.minimumOrder,
      estimated_time_minutes: existing?.delivery?.estimated_time_minutes,
    },
  }
}

// Helper: Convert database JSONB order modes to form format
function dbOrderModesToForm(dbModes: OrderModes | null | undefined): {
  dineIn: boolean;
  pickup: boolean;
  delivery: boolean;
  dineInGuestSessionMode: "staff_seated" | "self_service";
  pickupInstructions: string;
} {
  const storedInstructions = dbModes?.pickup?.instructions;
  return {
    dineIn: dbModes?.dine_in?.enabled ?? true,
    pickup: dbModes?.pickup?.enabled ?? true,
    delivery: dbModes?.delivery?.enabled ?? false,
    dineInGuestSessionMode:
      dbModes?.dine_in?.guest_session_mode === "self_service" ? "self_service" : "staff_seated",
    pickupInstructions: storedInstructions ?? DEFAULT_PICKUP_INSTRUCTIONS,
  }
}

// Helper: Map database status to form status
function dbStatusToForm(dbStatus: string | null | undefined): "active" | "inactive" | "coming-soon" {
  switch (dbStatus) {
    case "active":
      return "active"
    case "inactive":
      return "inactive"
    case "coming_soon":
      return "coming-soon"
    case "temporarily_closed":
      return "inactive"
    default:
      return "active"
  }
}

// Helper: Map form status to database status
function formStatusToDb(formStatus: "active" | "inactive" | "coming-soon"): "active" | "inactive" | "coming_soon" {
  switch (formStatus) {
    case "active":
      return "active"
    case "inactive":
      return "inactive"
    case "coming-soon":
      return "coming_soon"
    default:
      return "active"
  }
}

type MerchantFormFields = Pick<
  StoreInfoFormData,
  | "primaryBrandColor"
  | "accentColor"
  | "defaultCurrency"
  | "availableLanguages"
  | "defaultLanguage"
  | "dateFormat"
  | "numberFormat"
>

function merchantFieldsForForm(
  merchant: Merchant | null | undefined,
  locationAccent?: string | null,
): MerchantFormFields {
  const dateFormatRaw = merchant?.dateFormat
  const dateFormat: MerchantFormFields["dateFormat"] =
    dateFormatRaw === "MM/DD/YYYY" || dateFormatRaw === "YYYY-MM-DD" || dateFormatRaw === "DD/MM/YYYY"
      ? dateFormatRaw
      : "DD/MM/YYYY"
  const numberFormatRaw = merchant?.numberFormat
  const numberFormat: MerchantFormFields["numberFormat"] =
    numberFormatRaw === "1.234,56" || numberFormatRaw === "1,234.56" ? numberFormatRaw : "1.234,56"

  const availableLanguages = normalizeAvailableGuestLocales(
    merchant?.availableLanguages,
    merchant?.defaultLanguage,
  )
  const mappedDefault =
    mapMerchantLanguageToGuestLocale(merchant?.defaultLanguage ?? "en")
  const defaultLanguage = availableLanguages.includes(mappedDefault)
    ? mappedDefault
    : (availableLanguages[0] ?? "en")

  const allowedCurrencies = new Set(["USD", "EUR", "GBP", "LBP", "CAD"])
  const rawCurrency = (merchant?.defaultCurrency ?? "EUR").trim().toUpperCase()
  const defaultCurrency = allowedCurrencies.has(rawCurrency) ? rawCurrency : "EUR"

  return {
    primaryBrandColor: merchant?.primaryBrandColor ?? "#0F172A",
    accentColor: locationAccent ?? merchant?.accentColor ?? "#f97316",
    defaultCurrency,
    availableLanguages,
    defaultLanguage,
    dateFormat,
    numberFormat,
  }
}

const emptyMerchantFields: MerchantFormFields = {
  primaryBrandColor: "#0F172A",
  accentColor: "#f97316",
  defaultCurrency: "EUR",
  availableLanguages: ["en", "ar"],
  defaultLanguage: "en",
  dateFormat: "DD/MM/YYYY",
  numberFormat: "1.234,56",
}

export default function StoresPage() {
  // Tenant and locations hooks
  const { currentMerchantId, loading: tenantLoading } = useTenant()
  const { locations, loading: locationsLoading, error: locationsError } = useLocations()
  const { merchant, loading: merchantLoading, refetch: refetchMerchant } = useCurrentMerchant()
  
  // Current location state (for editing)
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null)
  const [currentLocation, setCurrentLocation] = useState<MerchantLocation | null>(null)
  
  // UI state
  const [urlCopied, setUrlCopied] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)
  const [formKey, setFormKey] = useState(0) // Key to force Select remount on form reset
  const [error, setError] = useState<string | null>(null)
  
  // Image upload state
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>("/placeholder.svg")
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null | undefined>(undefined)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string>("/placeholder.svg")
  const [bannerUploading, setBannerUploading] = useState(false)
  const [bannerUrl, setBannerUrl] = useState<string | null | undefined>(undefined)
  const [imagesDirty, setImagesDirty] = useState(false)

  const form = useForm<StoreInfoFormData>({
    resolver: zodResolver(storeInfoSchema),
    defaultValues: {
      storeName: "",
      storeType: "restaurant",
      shortDescription: "",
      storeSlug: "",
      address: {
        street: "",
        apartment: "",
        postalCode: "",
        city: "",
        country: "BE",
      },
      phoneNumber: "",
      publicEmail: "",
      useBusinessEmail: false,
      website: "",
      instagram: "",
      facebook: "",
      tiktok: "",
      openingHours: dayNames.map((_, index) => ({
        day: index,
        closed: false,
        shifts: [{ open: "11:00", close: "23:00" }],
      })),
      enableTables: false,
      enableReservations: false,
      requirePrepayment: false,
      maxPartySize: 8,
      bookingWindow: 30,
      enableOnlineOrders: true,
      orderModes: {
        dineIn: true,
        pickup: true,
        delivery: false,
        dineInGuestSessionMode: "staff_seated",
        pickupInstructions: DEFAULT_PICKUP_INSTRUCTIONS,
      },
      deliveryRadius: 5,
      deliveryFee: 5.99,
      minimumOrder: 15,
      taxRate: 0,
      storeStatus: "active",
      publicListing: true,
      timezone: "Europe/Brussels",
      useBusinessTimezone: true,
      ...emptyMerchantFields,
    },
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isDirty },
  } = form

  const hasUnsavedChanges = isDirty || imagesDirty

  const storeName = watch("storeName")
  const storeType = watch("storeType")
  const shortDescription = watch("shortDescription")
  const storeSlug = watch("storeSlug")
  const openingHours = watch("openingHours")
  const enableOnlineOrders = watch("enableOnlineOrders")
  const orderModes = watch("orderModes")
  const storeStatus = watch("storeStatus")
  const deliveryRadius = watch("deliveryRadius")
  const deliveryFee = watch("deliveryFee")
  const minimumOrder = watch("minimumOrder")
  const defaultCurrency = (watch("defaultCurrency") || "EUR").trim().toUpperCase()
  const currencySymbol = merchantCurrencySymbol(defaultCurrency) || defaultCurrency

  // Select first location when locations are loaded
  useEffect(() => {
    if (locations.length > 0 && !currentLocationId) {
      setCurrentLocationId(locations[0].id)
    }
  }, [locations, currentLocationId])

  // Load location + merchant data into form when current location (or merchant) changes
  useEffect(() => {
    if (!currentLocationId) {
      setCurrentLocation(null)
      return
    }

    const location = locations.find((l) => l.id === currentLocationId)
    if (!location) {
      setCurrentLocation(null)
      return
    }

    setCurrentLocation(location)

    // Map location data to form fields
    const orderModesData = dbOrderModesToForm(location.orderModes)
    const openingHoursData = dbOpeningHoursToForm(location.openingHours)
    const storeNameValue = location.name ?? ""
    const merchantFields = merchantFieldsForForm(merchant, location.accentColor)

    form.reset({
      storeName: storeNameValue,
      storeType: (location.storeType as "restaurant" | "bar" | "cafe" | "grocery" | "other") ?? "restaurant",
      shortDescription: location.description ?? "",
      storeSlug: location.storeSlug ?? "",
      address: {
        street: location.address ?? "",
        apartment: location.addressLine2 ?? "",
        postalCode: location.postalCode ?? "",
        city: location.city ?? "",
        country: phoneCountryFromStoreCountry(location.country),
      },
      phoneNumber: location.phone ?? "",
      publicEmail: location.email ?? "",
      useBusinessEmail: false,
      website: location.websiteUrl ?? "",
      instagram: location.instagramHandle ?? "",
      facebook: location.facebookUrl ?? "",
      tiktok: location.tiktokHandle ?? "",
      openingHours: openingHoursData,
      enableTables: location.enableTables ?? false,
      enableReservations: location.enableReservations ?? false,
      requirePrepayment: false, // Not in DB schema
      maxPartySize: location.maxPartySize ?? 8,
      bookingWindow: location.bookingWindowDays ?? 30,
      enableOnlineOrders: location.enableOnlineOrders ?? true,
      orderModes: orderModesData,
      deliveryRadius: location.orderModes?.delivery?.radius_km ?? 5,
      deliveryFee: location.orderModes?.delivery?.delivery_fee ?? 5.99,
      minimumOrder: location.orderModes?.delivery?.minimum_order ?? 15,
      taxRate: coerceTaxRatePercent(location.taxRate),
      storeStatus: dbStatusToForm(location.status),
      publicListing: location.visibleInDirectory ?? true,
      timezone: location.timezone ?? "Europe/Brussels",
      useBusinessTimezone: !location.timezone,
      ...merchantFields,
    })

    // Force Select components to remount by updating key
    setFormKey((prev) => prev + 1)

    // Effective images: location override, else merchant branding
    const effectiveLogo = location.logoUrl ?? merchant?.logoUrl ?? null
    const effectiveBanner = location.bannerUrl ?? merchant?.bannerUrl ?? null

    if (effectiveLogo) {
      setLogoUrl(effectiveLogo)
      setLogoPreview(effectiveLogo)
    } else {
      setLogoUrl(undefined)
      setLogoPreview("/placeholder.svg")
    }
    setLogoFile(null)

    if (effectiveBanner) {
      setBannerUrl(effectiveBanner)
      setBannerPreview(effectiveBanner)
    } else {
      setBannerUrl(undefined)
      setBannerPreview("/placeholder.svg")
    }
    setBannerFile(null)
    setImagesDirty(false)
  }, [currentLocationId, locations, form]) // merchant synced separately below to avoid wiping currency on refetch

  // When merchant loads after location, fill merchant-only fields if not dirty
  useEffect(() => {
    if (!merchant || merchantLoading) return
    if (isSaving) return

    const dirty = form.formState.dirtyFields
    const fields = merchantFieldsForForm(merchant, form.getValues("accentColor"))

    if (!dirty.primaryBrandColor) {
      setValue("primaryBrandColor", fields.primaryBrandColor, { shouldDirty: false })
    }
    if (!dirty.defaultCurrency) {
      setValue("defaultCurrency", fields.defaultCurrency || "EUR", { shouldDirty: false })
    }
    if (!dirty.availableLanguages) {
      setValue("availableLanguages", fields.availableLanguages, { shouldDirty: false })
    }
    if (!dirty.defaultLanguage) {
      setValue("defaultLanguage", fields.defaultLanguage, { shouldDirty: false })
    }
    if (!dirty.dateFormat) {
      setValue("dateFormat", fields.dateFormat, { shouldDirty: false })
    }
    if (!dirty.numberFormat) {
      setValue("numberFormat", fields.numberFormat, { shouldDirty: false })
    }
    if (!dirty.accentColor && !currentLocation?.accentColor) {
      setValue("accentColor", fields.accentColor, { shouldDirty: false })
    }

    // Backfill images from merchant when location has none and no image chosen yet
    if (!currentLocation?.logoUrl && merchant.logoUrl) {
      setLogoUrl((prev) => (prev === undefined ? merchant.logoUrl! : prev))
      setLogoPreview((prev) => (prev === "/placeholder.svg" ? merchant.logoUrl! : prev))
    }
    if (!currentLocation?.bannerUrl && merchant.bannerUrl) {
      setBannerUrl((prev) => (prev === undefined ? merchant.bannerUrl! : prev))
      setBannerPreview((prev) => (prev === "/placeholder.svg" ? merchant.bannerUrl! : prev))
    }
  }, [merchant, merchantLoading, currentLocation, form, setValue, isSaving])

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim()
    setValue("storeSlug", slug, { shouldValidate: true, shouldDirty: true })
  }

  const copyStoreUrl = () => {
    navigator.clipboard.writeText(buildPublicMenuUrl({ storeSlug, origin: GUEST_MENU_ORIGIN }))
    setUrlCopied(true)
    toast.success("Store URL copied to clipboard")
    setTimeout(() => setUrlCopied(false), 2000)
  }

  const onSubmit = useCallback(async (data: StoreInfoFormData) => {
    if (!currentMerchantId) {
      toast.error("No merchant selected")
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      // Get current image URLs - null clears; undefined leaves unchanged
      const currentLogoUrl = logoUrl
      const currentBannerUrl = bannerUrl

      // Convert form data to API format
      const apiData: Record<string, unknown> = {
        merchantId: currentMerchantId,
        storeName: data.storeName,
        storeType: data.storeType,
        shortDescription: data.shortDescription,
        storeSlug: data.storeSlug,
        address: data.address,
        phoneNumber: data.phoneNumber,
        publicEmail: data.publicEmail,
        website: data.website,
        instagram: data.instagram,
        facebook: data.facebook,
        tiktok: data.tiktok,
        openingHours: formOpeningHoursToDb(data.openingHours),
        enableTables: data.enableTables,
        enableReservations: data.enableReservations,
        maxPartySize: data.maxPartySize,
        bookingWindow: data.bookingWindow,
        enableOnlineOrders: data.enableOnlineOrders,
        orderModes: formOrderModesToDb(
          data.orderModes,
          {
            radius: data.deliveryRadius,
            fee: data.deliveryFee,
            minimumOrder: data.minimumOrder,
          },
          currentLocation?.orderModes,
        ),
        taxRate: data.taxRate,
        storeStatus: formStatusToDb(data.storeStatus),
        publicListing: data.publicListing,
        timezone: timezoneFromCountry(data.address.country),
        accentColor: data.accentColor || null,
      }

      if (currentLogoUrl !== undefined) {
        apiData.logoUrl = currentLogoUrl
      } else if (logoPreview && logoPreview !== "/placeholder.svg") {
        apiData.logoUrl = logoPreview
      }

      if (currentBannerUrl !== undefined) {
        apiData.bannerUrl = currentBannerUrl
      } else if (bannerPreview && bannerPreview !== "/placeholder.svg") {
        apiData.bannerUrl = bannerPreview
      }

      let response: Response

      if (currentLocationId) {
        // Update existing location
        response = await fetch(`/api/locations/${encodeURIComponent(currentLocationId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(apiData),
        })
      } else {
        // Create new location
        response = await fetch("/api/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(apiData),
        })
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to save location: ${response.status}`)
      }

      const savedLocation: MerchantLocation = await response.json()
      console.log("[StoresPage] Saved location:", savedLocation)

      // Sync merchant (business) fields - fail whole save if this fails (before success toast)
      const resolvedLogoUrl =
        currentLogoUrl === null
          ? null
          : currentLogoUrl !== undefined
            ? currentLogoUrl
            : (savedLocation.logoUrl ?? null)
      const resolvedBannerUrl =
        currentBannerUrl === null
          ? null
          : currentBannerUrl !== undefined
            ? currentBannerUrl
            : (savedLocation.bannerUrl ?? null)

      const merchantResponse = await fetch(`/api/merchants/${encodeURIComponent(currentMerchantId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          businessName: data.storeName,
          primaryEmail: data.publicEmail || merchant?.contactEmail,
          primaryPhone: data.phoneNumber,
          primaryBrandColor: data.primaryBrandColor,
          accentColor: data.accentColor,
          logoUrl: resolvedLogoUrl,
          bannerUrl: resolvedBannerUrl,
          defaultCurrency: data.defaultCurrency,
          defaultTimezone: timezoneFromCountry(data.address.country),
          defaultLanguage: data.defaultLanguage,
          availableLanguages: data.availableLanguages,
          dateFormat: data.dateFormat,
          numberFormat: data.numberFormat,
        }),
      })

      if (!merchantResponse.ok) {
        const errorData = await merchantResponse.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to save business info: ${merchantResponse.status}`)
      }

      const savedMerchant = (await merchantResponse.json().catch(() => null)) as Merchant | null
      await refetchMerchant().catch(() => null)

      // Update current location ID if this was a new location
      if (!currentLocationId) {
        setCurrentLocationId(savedLocation.id)
      }

      // Reset form with saved data to clear isDirty state
      const savedOrderModes = dbOrderModesToForm(savedLocation.orderModes)
      const savedOpeningHours = dbOpeningHoursToForm(savedLocation.openingHours)
      const savedMerchantFields: MerchantFormFields = savedMerchant
        ? merchantFieldsForForm(savedMerchant, savedLocation.accentColor)
        : {
            primaryBrandColor: data.primaryBrandColor,
            accentColor: data.accentColor ?? savedLocation.accentColor ?? "#f97316",
            defaultCurrency: data.defaultCurrency || "EUR",
            availableLanguages: data.availableLanguages,
            defaultLanguage: data.defaultLanguage,
            dateFormat: data.dateFormat,
            numberFormat: data.numberFormat,
          }

      form.reset({
        storeName: savedLocation.name ?? "",
        storeType: (savedLocation.storeType as "restaurant" | "bar" | "cafe" | "grocery" | "other") ?? "restaurant",
        shortDescription: savedLocation.description ?? "",
        storeSlug: savedLocation.storeSlug ?? "",
        address: {
          street: savedLocation.address ?? "",
          apartment: savedLocation.addressLine2 ?? "",
          postalCode: savedLocation.postalCode ?? "",
          city: savedLocation.city ?? "",
          country: phoneCountryFromStoreCountry(savedLocation.country),
        },
        phoneNumber: savedLocation.phone ?? "",
        publicEmail: savedLocation.email ?? "",
        useBusinessEmail: false,
        website: savedLocation.websiteUrl ?? "",
        instagram: savedLocation.instagramHandle ?? "",
        facebook: savedLocation.facebookUrl ?? "",
        tiktok: savedLocation.tiktokHandle ?? "",
        openingHours: savedOpeningHours,
        enableTables: savedLocation.enableTables ?? false,
        enableReservations: savedLocation.enableReservations ?? false,
        requirePrepayment: false,
        maxPartySize: savedLocation.maxPartySize ?? 8,
        bookingWindow: savedLocation.bookingWindowDays ?? 30,
        enableOnlineOrders: savedLocation.enableOnlineOrders ?? true,
        orderModes: savedOrderModes,
        deliveryRadius: savedLocation.orderModes?.delivery?.radius_km ?? 5,
        deliveryFee: savedLocation.orderModes?.delivery?.delivery_fee ?? 5.99,
        minimumOrder: savedLocation.orderModes?.delivery?.minimum_order ?? 15,
        taxRate: coerceTaxRatePercent(savedLocation.taxRate),
        storeStatus: dbStatusToForm(savedLocation.status),
        publicListing: savedLocation.visibleInDirectory ?? true,
        timezone: savedLocation.timezone ?? "Europe/Brussels",
        useBusinessTimezone: !savedLocation.timezone,
        ...savedMerchantFields,
      })

      // Update image states with saved values
      if (resolvedLogoUrl) {
        setLogoUrl(resolvedLogoUrl)
        setLogoPreview(resolvedLogoUrl)
      } else if (resolvedLogoUrl === null) {
        setLogoUrl(null)
        setLogoPreview("/placeholder.svg")
      }
      if (resolvedBannerUrl) {
        setBannerUrl(resolvedBannerUrl)
        setBannerPreview(resolvedBannerUrl)
      } else if (resolvedBannerUrl === null) {
        setBannerUrl(null)
        setBannerPreview("/placeholder.svg")
      }

      // Update currentLocation with saved data so discard works correctly
      setCurrentLocation(savedLocation)

      setImagesDirty(false)
      setFormKey((prev) => prev + 1)
      toast.success("Store information saved successfully!")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save location"
      setError(errorMessage)
      toast.error(errorMessage)
      console.error("[StoresPage] Error saving location:", err)
    } finally {
      setIsSaving(false)
    }
  }, [currentMerchantId, currentLocationId, currentLocation, logoUrl, bannerUrl, logoPreview, bannerPreview, merchant, form, refetchMerchant])

  const handleDiscard = useCallback(() => {
    // Re-load current location data
    if (currentLocation) {
      const orderModesData = dbOrderModesToForm(currentLocation.orderModes)
      const openingHoursData = dbOpeningHoursToForm(currentLocation.openingHours)
      const storeNameValue = currentLocation.name ?? ""
      const merchantFields = merchantFieldsForForm(merchant, currentLocation.accentColor)

      form.reset({
        storeName: storeNameValue,
        storeType: (currentLocation.storeType as "restaurant" | "bar" | "cafe" | "grocery" | "other") ?? "restaurant",
        shortDescription: currentLocation.description ?? "",
        storeSlug: currentLocation.storeSlug ?? "",
        address: {
          street: currentLocation.address ?? "",
          apartment: currentLocation.addressLine2 ?? "",
          postalCode: currentLocation.postalCode ?? "",
          city: currentLocation.city ?? "",
          country: phoneCountryFromStoreCountry(currentLocation.country),
        },
        phoneNumber: currentLocation.phone ?? "",
        publicEmail: currentLocation.email ?? "",
        useBusinessEmail: false,
        website: currentLocation.websiteUrl ?? "",
        instagram: currentLocation.instagramHandle ?? "",
        facebook: currentLocation.facebookUrl ?? "",
        tiktok: currentLocation.tiktokHandle ?? "",
        openingHours: openingHoursData,
        enableTables: currentLocation.enableTables ?? false,
        enableReservations: currentLocation.enableReservations ?? false,
        requirePrepayment: false,
        maxPartySize: currentLocation.maxPartySize ?? 8,
        bookingWindow: currentLocation.bookingWindowDays ?? 30,
        enableOnlineOrders: currentLocation.enableOnlineOrders ?? true,
        orderModes: orderModesData,
        deliveryRadius: currentLocation.orderModes?.delivery?.radius_km ?? 5,
        deliveryFee: currentLocation.orderModes?.delivery?.delivery_fee ?? 5.99,
        minimumOrder: currentLocation.orderModes?.delivery?.minimum_order ?? 15,
        taxRate: coerceTaxRatePercent(currentLocation.taxRate),
        storeStatus: dbStatusToForm(currentLocation.status),
        publicListing: currentLocation.visibleInDirectory ?? true,
        timezone: currentLocation.timezone ?? "Europe/Brussels",
        useBusinessTimezone: !currentLocation.timezone,
        ...merchantFields,
      })
      setFormKey((prev) => prev + 1)

      // Reset image states (location first, else merchant)
      const effectiveLogo = currentLocation.logoUrl ?? merchant?.logoUrl ?? null
      const effectiveBanner = currentLocation.bannerUrl ?? merchant?.bannerUrl ?? null

      if (effectiveLogo) {
        setLogoUrl(effectiveLogo)
        setLogoPreview(effectiveLogo)
      } else {
        setLogoUrl(undefined)
        setLogoPreview("/placeholder.svg")
      }
      setLogoFile(null)

      if (effectiveBanner) {
        setBannerUrl(effectiveBanner)
        setBannerPreview(effectiveBanner)
      } else {
        setBannerUrl(undefined)
        setBannerPreview("/placeholder.svg")
      }
      setBannerFile(null)
      setImagesDirty(false)
    } else {
      form.reset()
      // Reset image states
      setLogoFile(null)
      setLogoPreview("/placeholder.svg")
      setLogoUrl(undefined)
      setBannerFile(null)
      setBannerPreview("/placeholder.svg")
      setBannerUrl(undefined)
      setImagesDirty(false)
    }

    toast.info("Changes discarded")
  }, [currentLocation, merchant, form])

  // Image upload handlers
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!currentLocationId) {
      toast.error("No location selected")
      return
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPG, PNG, or WEBP images are allowed")
      return
    }

    // Validate file size (2MB max)
    const MAX_FILE_SIZE = 2 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be 2MB or smaller")
      return
    }

    // Show preview immediately
    setLogoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setLogoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Upload to server
    setLogoUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/locations/${encodeURIComponent(currentLocationId)}/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to upload logo')
      }

      const data = await response.json()
      setLogoUrl(data.url)
      setImagesDirty(true)
      toast.success("Logo uploaded successfully")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload logo")
      // Reset preview on error
      setLogoPreview(currentLocation?.logoUrl || "/placeholder.svg")
      setLogoFile(null)
    } finally {
      setLogoUploading(false)
    }
  }

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!currentLocationId) {
      toast.error("No location selected")
      return
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPG, PNG, or WEBP images are allowed")
      return
    }

    // Validate file size (2MB max)
    const MAX_FILE_SIZE = 2 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be 2MB or smaller")
      return
    }

    // Show preview immediately
    setBannerFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setBannerPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Upload to server
    setBannerUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/locations/${encodeURIComponent(currentLocationId)}/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to upload banner')
      }

      const data = await response.json()
      setBannerUrl(data.url)
      setImagesDirty(true)
      toast.success("Banner uploaded successfully")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload banner")
      // Reset preview on error
      setBannerPreview(currentLocation?.bannerUrl || "/placeholder.svg")
      setBannerFile(null)
    } finally {
      setBannerUploading(false)
    }
  }

  const toggleDayClosed = (dayIndex: number) => {
    const current = openingHours[dayIndex].closed
    setValue(`openingHours.${dayIndex}.closed`, !current, { shouldDirty: true })
  }

  const addShift = (dayIndex: number) => {
    const currentShifts = openingHours[dayIndex].shifts
    setValue(`openingHours.${dayIndex}.shifts`, [...currentShifts, { open: "11:00", close: "23:00" }], {
      shouldDirty: true,
    })
  }

  const removeShift = (dayIndex: number, shiftIndex: number) => {
    const currentShifts = openingHours[dayIndex].shifts
    if (currentShifts.length > 1) {
      setValue(
        `openingHours.${dayIndex}.shifts`,
        currentShifts.filter((_, i) => i !== shiftIndex),
        { shouldDirty: true },
      )
    }
  }

  const applyPreset = (preset: (typeof commonPresets)[0]) => {
    openingHours.forEach((_, index) => {
      if (!openingHours[index].closed) {
        setValue(`openingHours.${index}.shifts`, [{ open: preset.open, close: preset.close }], { shouldDirty: true })
      }
    })
    toast.success(`Applied ${preset.name} to all open days`)
  }

  const copyToAllDays = (dayIndex: number) => {
    const sourceDay = openingHours[dayIndex]
    openingHours.forEach((_, index) => {
      setValue(`openingHours.${index}.closed`, sourceDay.closed, { shouldDirty: true })
      setValue(`openingHours.${index}.shifts`, sourceDay.shifts, { shouldDirty: true })
    })
    toast.success("Applied to all days")
  }

  const applyToWeekdays = (dayIndex: number) => {
    const sourceDay = openingHours[dayIndex]
    ;[0, 1, 2, 3, 4].forEach((index) => {
      setValue(`openingHours.${index}.closed`, sourceDay.closed, { shouldDirty: true })
      setValue(`openingHours.${index}.shifts`, sourceDay.shifts, { shouldDirty: true })
    })
    toast.success("Applied to weekdays (Mon-Fri)")
  }

  const applyToWeekend = (dayIndex: number) => {
    const sourceDay = openingHours[dayIndex]
    ;[5, 6].forEach((index) => {
      setValue(`openingHours.${index}.closed`, sourceDay.closed, { shouldDirty: true })
      setValue(`openingHours.${index}.shifts`, sourceDay.shifts, { shouldDirty: true })
    })
    toast.success("Applied to weekend (Sat-Sun)")
  }

  const getCurrentStatus = () => {
    // Simple logic to determine if currently open
    const now = new Date()
    const currentDay = (now.getDay() + 6) % 7 // Convert to Mon=0 format
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`

    const todayHours = openingHours[currentDay]
    if (todayHours.closed) return "closed"

    for (const shift of todayHours.shifts) {
      if (currentTime >= shift.open && currentTime <= shift.close) {
        return "open"
      }
    }
    return "closed"
  }

  const isCurrentlyOpen = getCurrentStatus() === "open"

  // Keyboard shortcut for save (Cmd+S / Ctrl+S)
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault()
      handleSubmit(onSubmit)()
    }
  }

  useState(() => {
    window.addEventListener("keydown", handleKeyDown as any)
    return () => window.removeEventListener("keydown", handleKeyDown as any)
  })

  // Loading state
  if (tenantLoading || locationsLoading) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading store information...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (locationsError) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 p-8 bg-destructive/10 rounded-lg border border-destructive/20">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-destructive font-medium">Error loading stores</p>
          <p className="text-sm text-muted-foreground">{locationsError}</p>
        </div>
      </div>
    )
  }

  // No merchant state
  if (!currentMerchantId) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 p-8">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground font-medium">No merchant selected</p>
          <p className="text-sm text-muted-foreground">Please select a merchant to manage stores.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background">
      {/* Fixed top save bar - always in view when there are unsaved changes */}
      {hasUnsavedChanges ? (
        <div className="fixed inset-x-0 top-14 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 shadow-sm">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
              <span className="font-medium text-foreground">You have unsaved changes</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleDiscard}
                disabled={isSaving}
                className="flex-1 sm:flex-none"
              >
                Discard
              </Button>
              <Button
                onClick={handleSubmit(onSubmit)}
                disabled={isSaving}
                className="flex-1 gap-2 sm:flex-none"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Save changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Page header - scrolls with content (not sticky) to avoid overlapping the save bar */}
      <div className={cn("border-b bg-background", hasUnsavedChanges && "pt-16 sm:pt-14")}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground">Store</h1>
              <p className="text-sm text-muted-foreground mt-1 hidden sm:block">
                Configure your store details and what customers see
              </p>

              {/* Mobile: Status pill below title */}
              <div className="flex flex-wrap items-center gap-2 mt-3 md:hidden">
                <Badge variant={storeStatus === "active" ? "default" : "secondary"} className="capitalize">
                  {storeStatus === "active" ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                      Active
                    </>
                  ) : storeStatus === "inactive" ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-muted-foreground mr-2" />
                      Inactive
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                      Coming Soon
                    </>
                  )}
                </Badge>
              </div>
            </div>

            {/* Desktop: Status pill on the right */}
            <div className="hidden md:flex items-center gap-4">
              <Badge variant={storeStatus === "active" ? "default" : "secondary"} className="capitalize">
                {storeStatus === "active" ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                    Active
                  </>
                ) : storeStatus === "inactive" ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-muted-foreground mr-2" />
                    Inactive
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                    Coming Soon
                  </>
                )}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Store Basics */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <StoreIcon className="w-5 h-5 text-orange-600" />
                  <CardTitle>Store Basics</CardTitle>
                </div>
                <CardDescription>Essential information about your store</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Store Name */}
                <div className="space-y-2">
                  <Label htmlFor="storeName">
                    Store Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="storeName"
                    {...register("storeName")}
                    onChange={(e) => {
                      register("storeName").onChange(e)
                      handleNameChange(e)
                    }}
                    className={cn(errors.storeName && "border-red-500")}
                  />
                  <div className="flex justify-between text-xs">
                    {errors.storeName && <span className="text-red-500">{errors.storeName.message}</span>}
                    <span className={cn("ml-auto", storeName.length > 100 ? "text-red-500" : "text-gray-500")}>
                      {storeName.length}/100
                    </span>
                  </div>
                </div>

                {/* Store Type */}
                <div className="space-y-2">
                  <Label>
                    Store Type <span className="text-red-500">*</span>
                  </Label>
                  <RadioGroup
                    key={`storeType-${formKey}`}
                    value={storeType}
                    onValueChange={(value) => setValue("storeType", value as any, { shouldDirty: true })}
                    className="grid grid-cols-3 sm:grid-cols-5 gap-2"
                  >
                    {storeTypes.map((type) => (
                      <div key={type.value}>
                        <RadioGroupItem value={type.value} id={type.value} className="peer sr-only" />
                        <Label
                          htmlFor={type.value}
                          className="flex flex-col items-center justify-center rounded-lg border-2 border-border bg-background p-3 hover:bg-accent peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-accent cursor-pointer transition-all min-h-[80px]"
                        >
                          <span className="text-2xl mb-1">{type.icon}</span>
                          <span className="text-xs font-medium text-center break-words">{type.label}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Short Description */}
                <div className="space-y-2">
                  <Label htmlFor="shortDescription">Short Description</Label>
                  <Textarea
                    id="shortDescription"
                    {...register("shortDescription")}
                    rows={3}
                    placeholder="Brief description of your store..."
                    className={cn(errors.shortDescription && "border-red-500")}
                  />
                  <div className="flex justify-between text-xs">
                    {errors.shortDescription && <span className="text-red-500">{errors.shortDescription.message}</span>}
                    <span
                      className={cn(
                        "ml-auto",
                        (shortDescription?.length || 0) > 300 ? "text-red-500" : "text-muted-foreground",
                      )}
                    >
                      {shortDescription?.length || 0}/300
                    </span>
                  </div>
                </div>

                {/* Store Slug/URL */}
                <div className="space-y-2">
                  <Label htmlFor="storeSlug">
                    Store URL <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted border rounded-lg">
                      <span className="text-sm text-muted-foreground">/</span>
                      <Input
                        id="storeSlug"
                        {...register("storeSlug")}
                        className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                      />
                    </div>
                    <Button type="button" variant="outline" size="icon" onClick={copyStoreUrl}>
                      {urlCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  {errors.storeSlug && <p className="text-xs text-red-500">{errors.storeSlug.message}</p>}
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Changing this will break existing links
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Location & Contact */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-orange-600" />
                  <CardTitle>Location & Contact</CardTitle>
                </div>
                <CardDescription>Store address and contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Address */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="street">Street Address</Label>
                    <Input
                      id="street"
                      {...register("address.street")}
                      placeholder="123 Main Street"
                      className={cn(errors.address?.street && "border-red-500")}
                    />
                    {errors.address?.street && <p className="text-xs text-red-500">{errors.address.street.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="apartment">Apartment / Suite (Optional)</Label>
                    <Input id="apartment" {...register("address.apartment")} placeholder="Suite 100" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">Postal Code</Label>
                      <Input
                        id="postalCode"
                        {...register("address.postalCode")}
                        className={cn(errors.address?.postalCode && "border-red-500")}
                      />
                      {errors.address?.postalCode && (
                        <p className="text-xs text-red-500">{errors.address.postalCode.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        {...register("address.city")}
                        className={cn(errors.address?.city && "border-red-500")}
                      />
                      {errors.address?.city && <p className="text-xs text-red-500">{errors.address.city.message}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Select
                      key={`country-${formKey}`}
                      value={watch("address.country") || undefined}
                      onValueChange={(val) => setValue("address.country", val, { shouldDirty: true })}
                    >
                      <SelectTrigger className={cn(errors.address?.country && "border-red-500")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((country) => (
                          <SelectItem key={country.value} value={country.value}>
                            {country.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.address?.country && (
                      <p className="text-xs text-red-500">{errors.address.country.message}</p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Phone Number */}
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">
                    <Phone className="w-4 h-4 inline mr-2" />
                    Phone Number
                  </Label>
                  <Controller
                    name="phoneNumber"
                    control={control}
                    render={({ field }) => (
                      <PhoneNumberField
                        id="phoneNumber"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        defaultCountry={watch("address.country")}
                        invalid={Boolean(errors.phoneNumber)}
                        placeholder="Mobile number"
                      />
                    )}
                  />
                  {errors.phoneNumber && <p className="text-xs text-red-500">{errors.phoneNumber.message}</p>}
                </div>

                {/* Public Email */}
                <div className="space-y-2">
                  <Label htmlFor="publicEmail">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Public Email
                  </Label>
                  <Input
                    id="publicEmail"
                    type="email"
                    {...register("publicEmail")}
                    placeholder="hello@store.com"
                    className={cn(errors.publicEmail && "border-red-500")}
                  />
                  {errors.publicEmail && <p className="text-xs text-red-500">{errors.publicEmail.message}</p>}
                </div>

                <Separator />

                {/* Website & Social Media */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Globe className="w-4 h-4" />
                    Website & Social Media
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="website">
                        <Globe className="w-4 h-4 inline mr-2" />
                        Website URL
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="website"
                          type="url"
                          {...register("website")}
                          placeholder="https://your-store.com"
                          className={cn("flex-1", errors.website && "border-red-500")}
                        />
                        {watch("website") && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => window.open(watch("website"), "_blank")}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      {errors.website && <p className="text-xs text-red-500">{errors.website.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="instagram">Instagram</Label>
                      <div className="flex gap-2">
                        <span className="inline-flex items-center px-3 border border-r-0 rounded-l-lg bg-gray-50 text-gray-600">
                          @
                        </span>
                        <Input
                          id="instagram"
                          {...register("instagram")}
                          placeholder="username"
                          className="rounded-l-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="facebook">Facebook</Label>
                      <Input id="facebook" {...register("facebook")} placeholder="Facebook page URL or username" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tiktok">TikTok</Label>
                      <div className="flex gap-2">
                        <span className="inline-flex items-center px-3 border border-r-0 rounded-l-lg bg-gray-50 text-gray-600">
                          @
                        </span>
                        <Input
                          id="tiktok"
                          {...register("tiktok")}
                          placeholder="username"
                          className="rounded-l-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Opening Hours */}
            <Card>
              <CardHeader>
                {/* Make opening hours header responsive */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-orange-600" />
                    <div>
                      <CardTitle>Opening Hours</CardTitle>
                      <CardDescription className="hidden sm:block">
                        When your store is open for business
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={isCurrentlyOpen ? "default" : "secondary"}>
                    {isCurrentlyOpen ? "Currently Open" : "Currently Closed"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preset Buttons */}
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Quick apply:</span>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {commonPresets.map((preset) => (
                      <Button
                        key={preset.name}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyPreset(preset)}
                        className="text-xs"
                      >
                        {preset.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Days Table */}
                <div className="space-y-2">
                  {openingHours.map((day, dayIndex) => (
                    <div
                      key={`day-${dayIndex}-${formKey}`}
                      className={cn(
                        "border rounded-lg p-3 sm:p-4 space-y-3",
                        (new Date().getDay() + 6) % 7 === dayIndex &&
                          "bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800",
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="font-medium w-20 sm:w-24">{dayNames[dayIndex]}</span>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              key={`closed-${dayIndex}-${formKey}`}
                              id={`closed-${dayIndex}`}
                              checked={day.closed}
                              onCheckedChange={() => toggleDayClosed(dayIndex)}
                            />
                            <Label htmlFor={`closed-${dayIndex}`} className="text-sm font-normal cursor-pointer">
                              Closed
                            </Label>
                          </div>
                        </div>

                        {!day.closed && (
                          <div className="flex flex-wrap gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => copyToAllDays(dayIndex)}
                              className="text-xs h-8 px-3"
                            >
                              <Copy className="w-3 h-3 mr-1.5" />
                              Copy to all
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => applyToWeekdays(dayIndex)}
                              className="text-xs h-8 px-3 hidden sm:inline-flex"
                            >
                              Mon–Fri
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => applyToWeekend(dayIndex)}
                              className="text-xs h-8 px-3 hidden sm:inline-flex"
                            >
                              Sat–Sun
                            </Button>
                          </div>
                        )}
                      </div>

                      {!day.closed && (
                        <div className="space-y-2 sm:pl-28">
                          {day.shifts.map((shift, shiftIndex) => (
                            <div key={`${dayIndex}-${shiftIndex}-${formKey}`} className="flex items-center gap-2">
                              <Select
                                key={`open-${dayIndex}-${shiftIndex}-${formKey}`}
                                value={shift.open}
                                onValueChange={(val) =>
                                  setValue(`openingHours.${dayIndex}.shifts.${shiftIndex}.open`, val, {
                                    shouldDirty: true,
                                  })
                                }
                              >
                                <SelectTrigger className="w-24 sm:w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {timeSlots.map((time) => (
                                    <SelectItem key={time} value={time}>
                                      {time}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <span className="text-muted-foreground">–</span>
                              <Select
                                key={`close-${dayIndex}-${shiftIndex}-${formKey}`}
                                value={shift.close}
                                onValueChange={(val) =>
                                  setValue(`openingHours.${dayIndex}.shifts.${shiftIndex}.close`, val, {
                                    shouldDirty: true,
                                  })
                                }
                              >
                                <SelectTrigger className="w-24 sm:w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {timeSlots.map((time) => (
                                    <SelectItem key={time} value={time}>
                                      {time}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {day.shifts.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => removeShift(dayIndex, shiftIndex)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addShift(dayIndex)}
                            className="text-xs"
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            Add hours
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Branding */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-orange-600" />
                  <div>
                    <CardTitle>Branding</CardTitle>
                    <CardDescription>Visual identity for your store</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo */}
                <div className="space-y-3">
                  <Label>Store Logo</Label>
                  <div className="relative h-24 w-24 rounded-lg border-2 border-dashed border-border overflow-hidden bg-muted">
                    <img
                      src={logoPreview || "/placeholder.svg"}
                      alt="Logo preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("store-logo-upload")?.click()}
                      disabled={logoUploading}
                    >
                      {logoUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          {logoFile || logoUrl ? "Replace" : "Upload"}
                        </>
                      )}
                    </Button>
                    {(logoFile || logoUrl || currentLocation?.logoUrl || merchant?.logoUrl) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setLogoFile(null)
                          setLogoPreview("/placeholder.svg")
                          setLogoUrl(null)
                          setImagesDirty(true)
                        }}
                        disabled={logoUploading}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Recommended: 200x200px, square format</p>
                  <input
                    id="store-logo-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={logoUploading}
                  />
                </div>

                <Separator />

                {/* Banner */}
                <div className="space-y-3">
                  <Label>Store Banner</Label>
                  <div className="relative aspect-video min-h-48 w-full overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted lg:min-h-56">
                    <img
                      src={bannerPreview || "/placeholder.svg"}
                      alt="Banner preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("store-banner-upload")?.click()}
                      disabled={bannerUploading}
                    >
                      {bannerUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          {bannerFile || bannerUrl ? "Replace" : "Upload"}
                        </>
                      )}
                    </Button>
                    {(bannerFile || bannerUrl || currentLocation?.bannerUrl || merchant?.bannerUrl) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBannerFile(null)
                          setBannerPreview("/placeholder.svg")
                          setBannerUrl(null)
                          setImagesDirty(true)
                        }}
                        disabled={bannerUploading}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Recommended: 1920x1080px, 16:9 aspect ratio</p>
                  <input
                    id="store-banner-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleBannerUpload}
                    disabled={bannerUploading}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Localization */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Globe2 className="w-5 h-5 text-orange-600" />
                  <div>
                    <CardTitle>Localization</CardTitle>
                    <CardDescription>Currency, language, and display formats</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="defaultCurrency">
                      Default Currency <span className="text-red-500">*</span>
                    </Label>
                    <Controller
                      name="defaultCurrency"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value || "EUR"}
                          onValueChange={(val) => field.onChange(val)}
                        >
                          <SelectTrigger
                            id="defaultCurrency"
                            className={cn(errors.defaultCurrency && "border-red-500")}
                          >
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD - US Dollar</SelectItem>
                            <SelectItem value="EUR">EUR - Euro</SelectItem>
                            <SelectItem value="GBP">GBP - British Pound</SelectItem>
                            <SelectItem value="LBP">LBP - Lebanese Pound</SelectItem>
                            <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.defaultCurrency && (
                      <p className="text-xs text-red-500">{errors.defaultCurrency.message}</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>
                        Available languages <span className="text-red-500">*</span>
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Choose which languages appear on your public guest menu. If only one is selected, guests cannot switch.
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                        {([
                          { id: "en", label: "English" },
                          { id: "ar", label: "Arabic" },
                        ] as const).map((lang) => {
                          const selected = watch("availableLanguages") ?? []
                          const checked = selected.includes(lang.id)
                          return (
                            <label
                              key={lang.id}
                              htmlFor={`available-lang-${lang.id}`}
                              className="flex items-center gap-2 text-sm"
                            >
                              <Checkbox
                                id={`available-lang-${lang.id}`}
                                checked={checked}
                                onCheckedChange={(value) => {
                                  const isOn = value === true
                                  const next = (["en", "ar"] as const).filter((code) => {
                                    if (code === lang.id) return isOn
                                    return selected.includes(code)
                                  })
                                  if (next.length === 0) {
                                    toast.error("Select at least one language")
                                    return
                                  }
                                  setValue("availableLanguages", [...next], {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                  })
                                  const currentDefault = watch("defaultLanguage")
                                  if (!next.includes(currentDefault)) {
                                    setValue("defaultLanguage", next[0]!, {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    })
                                  }
                                }}
                              />
                              {lang.label}
                            </label>
                          )
                        })}
                      </div>
                      {errors.availableLanguages && (
                        <p className="text-xs text-red-500">{errors.availableLanguages.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="defaultLanguage">
                        Default language <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        key={`language-${formKey}-${(watch("availableLanguages") ?? []).join("-")}`}
                        value={watch("defaultLanguage")}
                        onValueChange={(val) =>
                          setValue("defaultLanguage", val as "en" | "ar", { shouldDirty: true, shouldValidate: true })
                        }
                      >
                        <SelectTrigger className={cn(errors.defaultLanguage && "border-red-500")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(watch("availableLanguages") ?? []).includes("en") ? (
                            <SelectItem value="en">English</SelectItem>
                          ) : null}
                          {(watch("availableLanguages") ?? []).includes("ar") ? (
                            <SelectItem value="ar">Arabic</SelectItem>
                          ) : null}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Used when a guest first opens your menu.
                      </p>
                      {errors.defaultLanguage && (
                        <p className="text-xs text-red-500">{errors.defaultLanguage.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateFormat">
                      Date Format <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      key={`date-format-${formKey}`}
                      value={watch("dateFormat")}
                      onValueChange={(val) =>
                        setValue("dateFormat", val as StoreInfoFormData["dateFormat"], { shouldDirty: true })
                      }
                    >
                      <SelectTrigger className={cn(errors.dateFormat && "border-red-500")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.dateFormat && (
                      <p className="text-xs text-red-500">{errors.dateFormat.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="numberFormat">
                      Number Format <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      key={`number-format-${formKey}`}
                      value={watch("numberFormat")}
                      onValueChange={(val) =>
                        setValue("numberFormat", val as StoreInfoFormData["numberFormat"], { shouldDirty: true })
                      }
                    >
                      <SelectTrigger className={cn(errors.numberFormat && "border-red-500")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1,234.56">1,234.56</SelectItem>
                        <SelectItem value="1.234,56">1.234,56</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.numberFormat && (
                      <p className="text-xs text-red-500">{errors.numberFormat.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Operational Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-orange-600" />
                  <CardTitle>Operational Settings</CardTitle>
                </div>
                <CardDescription>Configure what features are enabled for this store</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Enable Online Orders */}
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="enableOnlineOrders" className="text-base">
                        Enable Online Orders
                      </Label>
                      <p className="text-sm text-muted-foreground">Allow customers to place orders online</p>
                      {!enableOnlineOrders && (
                        <p className="text-xs text-amber-600">Store still visible but order button is hidden</p>
                      )}
                    </div>
                    <Switch
                      id="enableOnlineOrders"
                      checked={enableOnlineOrders}
                      onCheckedChange={(checked) => setValue("enableOnlineOrders", checked, { shouldDirty: true })}
                    />
                  </div>

                  {enableOnlineOrders && (
                    <div className="pl-6 space-y-4 border-l-2 border-orange-200 dark:border-orange-800">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Order Modes *</Label>
                        <div className="space-y-2">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="dineIn"
                              checked={orderModes.dineIn}
                              onCheckedChange={(checked) =>
                                setValue("orderModes.dineIn", !!checked, { shouldDirty: true })
                              }
                            />
                            <div className="flex-1">
                              <Label htmlFor="dineIn" className="text-sm font-normal cursor-pointer">
                                Dine-in
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Order at table - choose self pickup or delivery to table
                              </p>
                            </div>
                          </div>

                          {orderModes.dineIn && (
                            <div className="ml-7 space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
                              <Label className="text-xs font-medium text-muted-foreground">
                                How guests get their order
                              </Label>
                              <RadioGroup
                                value={orderModes.dineInGuestSessionMode}
                                onValueChange={(value) =>
                                  setValue(
                                    "orderModes.dineInGuestSessionMode",
                                    value as "staff_seated" | "self_service",
                                    { shouldDirty: true },
                                  )
                                }
                                className="space-y-2"
                              >
                                <div className="flex items-start gap-2">
                                  <RadioGroupItem
                                    value="staff_seated"
                                    id="dineInGuestSessionStaffSeated"
                                    className="mt-0.5"
                                  />
                                  <div>
                                    <Label
                                      htmlFor="dineInGuestSessionStaffSeated"
                                      className="text-sm font-normal cursor-pointer"
                                    >
                                      Delivery to table
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                      Staff bring the order to the guest&apos;s table (tray / table service)
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <RadioGroupItem
                                    value="self_service"
                                    id="dineInGuestSessionSelfService"
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <Label
                                        htmlFor="dineInGuestSessionSelfService"
                                        className="text-sm font-normal cursor-pointer"
                                      >
                                        Self pickup
                                      </Label>
                                      {orderModes.dineInGuestSessionMode === "self_service" ? (
                                        <StoreMenuQrButton
                                          storeSlug={storeSlug}
                                          variant="dine-in"
                                          label="Dine-in QR"
                                        />
                                      ) : null}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      Guests order from the table QR and pick up the order themselves
                                    </p>
                                  </div>
                                </div>
                              </RadioGroup>
                            </div>
                          )}

                          {orderModes.dineIn ? (
                            <div className="ml-7">
                              <StoreTablesManager
                                locationId={currentLocationId}
                                storeSlug={storeSlug}
                              />
                            </div>
                          ) : null}

                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="pickup"
                              checked={orderModes.pickup}
                              onCheckedChange={(checked) =>
                                setValue("orderModes.pickup", !!checked, { shouldDirty: true })
                              }
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <Label htmlFor="pickup" className="text-sm font-normal cursor-pointer">
                                  Pickup
                                </Label>
                                {orderModes.pickup ? (
                                  <StoreMenuQrButton
                                    storeSlug={storeSlug}
                                    variant="pickup"
                                    label="Pickup QR"
                                  />
                                ) : null}
                              </div>
                              <p className="text-xs text-muted-foreground">Order ahead, pick up at store</p>
                            </div>
                          </div>

                          {orderModes.pickup ? (
                            <div className="ml-8 space-y-2 border-l-2 border-border/70 pl-4">
                              <Label htmlFor="pickupInstructions">Pickup instructions</Label>
                              <Textarea
                                id="pickupInstructions"
                                rows={2}
                                maxLength={500}
                                placeholder={DEFAULT_PICKUP_INSTRUCTIONS}
                                {...register("orderModes.pickupInstructions")}
                              />
                              <p className="text-xs text-muted-foreground">
                                Shown in the guest menu when pickup is selected. Leave blank to hide.
                              </p>
                            </div>
                          ) : null}

                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="delivery"
                              checked={orderModes.delivery}
                              onCheckedChange={(checked) =>
                                setValue("orderModes.delivery", !!checked, { shouldDirty: true })
                              }
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <Label htmlFor="delivery" className="text-sm font-normal cursor-pointer">
                                  Delivery
                                </Label>
                                {orderModes.delivery ? (
                                  <StoreMenuQrButton
                                    storeSlug={storeSlug}
                                    variant="delivery"
                                    label="Delivery QR"
                                  />
                                ) : null}
                              </div>
                              <p className="text-xs text-muted-foreground">Order for delivery</p>
                            </div>
                          </div>
                        </div>

                        {orderModes.delivery && (
                          <div className="pl-8 space-y-3 pt-2 border-l-2 border-orange-100 dark:border-orange-900">
                            <div className="space-y-2">
                              <Label htmlFor="deliveryFee">Delivery Fee ({currencySymbol})</Label>
                              <Input
                                id="deliveryFee"
                                type="number"
                                min="0"
                                step="0.01"
                                {...register("deliveryFee", { valueAsNumber: true })}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="minimumOrder">Minimum Order ({currencySymbol})</Label>
                              <Input
                                id="minimumOrder"
                                type="number"
                                min="0"
                                step="0.01"
                                {...register("minimumOrder", { valueAsNumber: true })}
                              />
                            </div>
                          </div>
                        )}

                        {!orderModes.dineIn && !orderModes.pickup && !orderModes.delivery && (
                          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                            <AlertCircle className="w-4 h-4" />
                            <span>Must select at least one order mode</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-4 space-y-2">
                    <Label htmlFor="taxRate">Tax rate (%)</Label>
                    <Input
                      id="taxRate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className="max-w-xs"
                      {...register("taxRate", { valueAsNumber: true })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Applied to guest cart, checkout, and placed orders for this store.
                    </p>
                    {errors.taxRate ? (
                      <p className="text-xs text-red-600">{errors.taxRate.message}</p>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
        </form>
      </div>
    </div>
  )
}
