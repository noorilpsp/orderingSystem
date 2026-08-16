"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addDays } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { updateMerchant } from "@/app/actions/merchants";
import {
  merchantOnboardingSchema,
  type MerchantOnboardingFormData,
} from "@/lib/validations/merchant-onboarding";

const storeTypes = [
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Cafe" },
  { value: "bar", label: "Bar" },
  { value: "bakery", label: "Bakery" },
  { value: "food_truck", label: "Food Truck" },
  { value: "fine_dining", label: "Fine Dining" },
  { value: "fast_food", label: "Fast Food" },
  { value: "other", label: "Other" },
] as const;

const countries = [
  { value: "Belgium", label: "Belgium" },
  { value: "France", label: "France" },
  { value: "Netherlands", label: "Netherlands" },
  { value: "Germany", label: "Germany" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "Spain", label: "Spain" },
  { value: "Italy", label: "Italy" },
  { value: "Lebanon", label: "Lebanon" },
  { value: "United States", label: "United States" },
  { value: "Canada", label: "Canada" },
] as const;

const subscriptionTiers = [
  { value: "trial", label: "Trial" },
  { value: "basic", label: "Basic" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
] as const;

const merchantStatuses = [
  { value: "onboarding", label: "Onboarding" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "inactive", label: "Inactive" },
] as const;

function emptyCreateDefaults(trialExpires: string): MerchantOnboardingFormData {
  return {
    storeName: "",
    storeType: "restaurant",
    address: "",
    addressLine2: "",
    postalCode: "",
    city: "",
    country: "Belgium",
    phone: "",
    publicEmail: "",
    legalName: "",
    kboNumber: "",
    contactEmail: "",
    subscriptionTier: "trial",
    trialExpires,
    status: "onboarding",
    kdsEnabled: false,
  };
}

export type MerchantOnboardingFormProps = {
  mode?: "create" | "edit";
  merchantId?: string;
  locationId?: string | null;
  defaultValues?: Partial<MerchantOnboardingFormData>;
};

export function MerchantOnboardingForm({
  mode = "create",
  merchantId,
  locationId,
  defaultValues,
}: MerchantOnboardingFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEdit = mode === "edit";

  const defaultTrialExpires = format(addDays(new Date(), 30), "yyyy-MM-dd");

  const form = useForm<MerchantOnboardingFormData>({
    resolver: zodResolver(merchantOnboardingSchema),
    defaultValues: {
      ...emptyCreateDefaults(defaultTrialExpires),
      ...defaultValues,
    },
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  const subscriptionTier = form.watch("subscriptionTier");
  const country = form.watch("country");
  const showTrialExpires = subscriptionTier === "trial";
  const isBelgium = country === "Belgium" || country === "BE";

  const createStore = async (data: MerchantOnboardingFormData) => {
    const merchantData = {
      name: data.storeName,
      legalName: data.legalName,
      kboNumber: data.kboNumber || null,
      contactEmail: data.contactEmail,
      contactPhone: data.phone,
      businessType: data.storeType ?? "restaurant",
      status: "onboarding" as const,
      subscriptionTier: data.subscriptionTier,
      subscriptionExpiresAt:
        data.subscriptionTier === "trial" && data.trialExpires
          ? new Date(data.trialExpires).toISOString()
          : null,
    };

    const locationData = {
      name: data.storeName,
      storeType: data.storeType ?? null,
      address: data.address,
      addressLine2: data.addressLine2?.trim() || null,
      postalCode: data.postalCode,
      city: data.city,
      country: data.country,
      phone: data.phone,
      email: data.publicEmail?.trim() || null,
    };

    const invitationData = {
      email: data.contactEmail,
      role: "admin" as const,
    };

    const formData = new FormData();
    formData.append("merchant", JSON.stringify(merchantData));
    formData.append("location", JSON.stringify(locationData));
    formData.append("invitation", JSON.stringify(invitationData));

    const response = await fetch("/api/admin/merchants", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to create store");
    }

    const createdId = result.merchantId as string | undefined;
    if (!createdId || createdId === "null" || createdId === "undefined") {
      throw new Error("Store created but no valid ID returned");
    }

    const ownerEmail = data.contactEmail?.trim() ?? "";
    toast.success(
      ownerEmail
        ? `Store created. Invitation sent to ${ownerEmail}`
        : "Store created.",
      {
        duration: 5000,
        action: {
          label: "View",
          onClick: () => router.push(`/admin/merchants/${createdId}`),
        },
      },
    );

    form.reset(emptyCreateDefaults(defaultTrialExpires));
  };

  const updateStore = async (data: MerchantOnboardingFormData) => {
    if (!merchantId) {
      throw new Error("Store ID is missing");
    }

    const result = await updateMerchant({
      id: merchantId,
      locationId: locationId ?? null,
      name: data.storeName,
      legalName: data.legalName,
      kboNumber: data.kboNumber?.trim() || null,
      contactEmail: data.contactEmail,
      businessType: data.storeType ?? "restaurant",
      status: data.status,
      storeType: data.storeType ?? null,
      phone: data.phone,
      address: data.address,
      addressLine2: data.addressLine2?.trim() || null,
      postalCode: data.postalCode,
      city: data.city,
      country: data.country,
      publicEmail: data.publicEmail?.trim() || null,
      subscriptionTier: data.subscriptionTier,
      subscriptionExpiresAt:
        data.subscriptionTier === "trial" && data.trialExpires
          ? new Date(data.trialExpires).toISOString()
          : null,
      kdsEnabled: data.kdsEnabled === true,
    });

    if (result.error) {
      throw new Error(result.error);
    }

    toast.success("Store updated.");
    router.push(`/admin/merchants/${merchantId}`);
    router.refresh();
  };

  const onSubmit = async (data: MerchantOnboardingFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (isEdit) {
        await updateStore(data);
      } else {
        await createStore(data);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : isEdit
            ? "Failed to update store"
            : "Failed to create store";
      setSubmitError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const countryValue = country?.trim() || "";
  const knownCountry = countries.some((entry) => entry.value === countryValue);

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Store basics</CardTitle>
            <CardDescription>
              Same idea as Dashboard → Stores. Hours, branding, and the public URL are set there
              after the owner signs in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="storeName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., La Brasserie" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="storeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {storeTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location & contact</CardTitle>
            <CardDescription>Where guests find this store.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Rue de la Loi 123"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="addressLine2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apartment / suite</FormLabel>
                  <FormControl>
                    <Input placeholder="Suite 100" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={isBelgium ? "1000" : "Postal code"}
                        maxLength={isBelgium ? 4 : undefined}
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    {isBelgium ? <FormDescription>4 digits</FormDescription> : null}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Brussels" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || undefined}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {!knownCountry && countryValue ? (
                        <SelectItem value={countryValue}>{countryValue}</SelectItem>
                      ) : null}
                      {countries.map((entry) => (
                        <SelectItem key={entry.value} value={entry.value}>
                          {entry.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="+32 2 123 45 67"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="publicEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Public email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="hello@store.com"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>Shown to guests.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Owner & company</CardTitle>
            <CardDescription>
              {isEdit
                ? "Legal details stay on the account."
                : "Legal details stay on the account. An invite is sent only if you add an owner email."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="legalName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Legal name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., La Brasserie BV" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="kboNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>KBO number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="1234567890"
                        maxLength={10}
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>Belgian company number (10 digits)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="contactEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Owner email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="owner@restaurant.com"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    {isEdit
                      ? "Account contact email."
                      : "Invitation is sent only if you fill this in."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>
              {isEdit ? "Plan for this store." : "Initial plan for this store."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="subscriptionTier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subscription tier</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || undefined}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subscription tier" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {subscriptionTiers.map((tier) => (
                        <SelectItem key={tier.value} value={tier.value}>
                          {tier.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showTrialExpires && (
              <FormField
                control={form.control}
                name="trialExpires"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trial expires</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        min={isEdit ? undefined : format(new Date(), "yyyy-MM-dd")}
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    {!isEdit ? (
                      <FormDescription>Default: 30 days from today</FormDescription>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {isEdit ? (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {merchantStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
          </CardContent>
        </Card>

        {isEdit ? (
          <Card>
            <CardHeader>
              <CardTitle>Modules</CardTitle>
              <CardDescription>Platform features for this store.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="kdsEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-start justify-between gap-4 rounded-lg border p-4">
                    <div className="space-y-1">
                      <FormLabel className="text-base font-medium">Kitchen Display (KDS)</FormLabel>
                      <FormDescription>
                        When on, staff get KDS screens, station settings, and item prep-station
                        fields.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value === true}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        ) : null}

        {submitError ? (
          <div className="rounded-md bg-destructive/15 p-4 text-sm text-destructive">
            {submitError}
          </div>
        ) : null}

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="min-w-[140px]">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSubmitting
              ? isEdit
                ? "Saving..."
                : "Creating..."
              : isEdit
                ? "Save store"
                : "Create store"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
