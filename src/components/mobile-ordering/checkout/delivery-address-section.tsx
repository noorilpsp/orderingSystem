"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Bike, MapPin, MessageSquare, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useGuestT, type EnMessageKey } from "@/lib/guest-i18n";
import { GuestPhoneCountrySelect } from "@/components/mobile-ordering/checkout/guest-phone-country-select";
import { useDisplayPhone } from "@/lib/public-menu/use-display-phone";
import {
  composeGuestPhone,
  DEFAULT_GUEST_PHONE_COUNTRY,
  parseGuestPhoneParts,
  phoneCountryFromStoreCountry,
} from "@/lib/public-menu/guest-phone";
import {
  deleteSavedGuestDeliveryAddress,
  firstMissingGuestDeliveryAddressField,
  guestDeliveryDisplayLines,
  normalizeGuestDeliveryAddress,
  readSavedGuestDeliveryAddresses,
  upsertSavedGuestDeliveryAddress,
  writeSelectedGuestDeliveryAddressId,
  type GuestDeliveryAddress,
  type GuestDeliveryRequiredField,
} from "@/lib/public-menu/guest-delivery-address";

type SheetView = "list" | "form";

const EMPTY_FORM = {
  nickname: "",
  line1: "",
  building: "",
  line2: "",
  city: "",
  intercom: "",
  phone: "",
  phoneCountry: DEFAULT_GUEST_PHONE_COUNTRY,
  postalCode: "",
  instructions: "",
};

function GuestDeliveryAddressLines({
  nickname,
  lines,
}: {
  nickname?: string | null;
  lines: { place: string; contact: string; instructions: string | null };
}) {
  return (
    <span className="min-w-0 flex-1">
      {nickname ? (
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Bike className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{nickname}</span>
        </span>
      ) : null}
      {lines.place ? (
        <span className={cn("flex items-start gap-2 text-sm text-foreground", nickname && "mt-1.5")}>
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{lines.place}</span>
        </span>
      ) : null}
      {lines.contact ? (
        <span className="mt-1.5 flex items-center gap-2 text-sm text-foreground">
          <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{lines.contact}</span>
        </span>
      ) : null}
      {lines.instructions ? (
        <span className="mt-1.5 flex items-start gap-2 text-xs text-muted-foreground">
          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{lines.instructions}</span>
        </span>
      ) : null}
    </span>
  );
}

function emptyFormWithPhone(defaultCountry = DEFAULT_GUEST_PHONE_COUNTRY) {
  return {
    ...EMPTY_FORM,
    phoneCountry: phoneCountryFromStoreCountry(defaultCountry),
  };
}

function formFromAddress(address: GuestDeliveryAddress) {
  const parts = parseGuestPhoneParts(address.phone);
  return {
    nickname: address.nickname,
    line1: address.line1,
    building: address.building,
    line2: address.line2,
    city: address.city,
    intercom: address.intercom,
    phone: parts.national,
    phoneCountry: parts.countryCode,
    postalCode: address.postalCode,
    instructions: address.instructions,
  };
}

const inputClass =
  "mt-1.5 h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const REQUIRED_FIELD_ERROR_KEYS: Record<GuestDeliveryRequiredField, EnMessageKey> = {
  nickname: "checkout.addressNicknameRequired",
  line1: "checkout.addressStreetRequired",
  building: "checkout.addressBuildingRequired",
  line2: "checkout.addressAptRequired",
  intercom: "checkout.addressIntercomRequired",
  phone: "checkout.phoneRequired",
};

type DeliveryAddressSectionProps = {
  selected: GuestDeliveryAddress | null;
  error: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (address: GuestDeliveryAddress | null) => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  defaultCountry?: string;
};

export function DeliveryAddressSection({
  selected,
  error,
  open,
  onOpenChange,
  onSelect,
  buttonRef,
  defaultCountry = DEFAULT_GUEST_PHONE_COUNTRY,
}: DeliveryAddressSectionProps) {
  const t = useGuestT();
  const displayPhone = useDisplayPhone();
  const [saved, setSaved] = useState<GuestDeliveryAddress[]>([]);
  const [view, setView] = useState<SheetView>("list");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [missingField, setMissingField] = useState<GuestDeliveryRequiredField | null>(null);
  const fieldRefs = useRef<Record<GuestDeliveryRequiredField, HTMLInputElement | null>>({
    nickname: null,
    line1: null,
    building: null,
    line2: null,
    intercom: null,
    phone: null,
  });

  useEffect(() => {
    setSaved(readSavedGuestDeliveryAddresses());
  }, []);

  useEffect(() => {
    if (!open) return;
    const nextSaved = readSavedGuestDeliveryAddresses();
    setSaved(nextSaved);
    setForm(emptyFormWithPhone(defaultCountry));
    setEditingId(null);
    setMissingField(null);
    setView(nextSaved.length > 0 ? "list" : "form");
  }, [defaultCountry, open]);

  const handleSelect = (address: GuestDeliveryAddress) => {
    writeSelectedGuestDeliveryAddressId(address.id);
    onSelect(address);
    onOpenChange(false);
  };

  const clearFieldError = () => {
    if (missingField) setMissingField(null);
  };

  const payloadForSave = () => ({
    ...form,
    phone: composeGuestPhone(form.phoneCountry, form.phone),
  });

  const handleSave = () => {
    const payload = payloadForSave();
    const missing = firstMissingGuestDeliveryAddressField(payload);
    if (missing) {
      setMissingField(missing);
      const field = fieldRefs.current[missing];
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      field?.focus({ preventScroll: true });
      return;
    }
    const normalized = normalizeGuestDeliveryAddress(payload, editingId ?? undefined);
    if (!normalized) return;
    const next = upsertSavedGuestDeliveryAddress(normalized);
    setSaved(next);
    const savedRow = next[0];
    if (savedRow) handleSelect(savedRow);
  };

  const handleDelete = (id: string) => {
    const next = deleteSavedGuestDeliveryAddress(id);
    setSaved(next);
    if (selected?.id === id) {
      onSelect(next[0] ?? null);
    }
    if (next.length === 0) setView("form");
  };

  const selectedLines = selected
    ? guestDeliveryDisplayLines(selected, displayPhone)
    : null;
  const requiredInputClass = (field: GuestDeliveryRequiredField) =>
    cn(
      inputClass,
      missingField === field &&
        "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20",
    );
  const fieldError = (field: GuestDeliveryRequiredField) =>
    missingField === field ? (
      <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-300">
        {t(REQUIRED_FIELD_ERROR_KEYS[field])}
      </p>
    ) : null;

  return (
    <>
      <div className="mt-4">
        <p className="mb-1.5 inline-flex items-center gap-1.5 text-sm text-foreground">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          {t("checkout.deliveryAddress")}
        </p>
        <button
          ref={buttonRef}
          type="button"
          id="guest-checkout-address"
          aria-invalid={error}
          onClick={() => onOpenChange(true)}
          className={cn(
            "flex w-full scroll-mt-24 items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
            error
              ? "border-rose-500 bg-rose-500/5"
              : "border-border/70 bg-background hover:border-foreground/30",
          )}
        >
          {selected ? (
            <>
              <GuestDeliveryAddressLines
                nickname={selected.nickname}
                lines={selectedLines ?? { place: "", contact: "", instructions: null }}
              />
              <span className="shrink-0 text-sm font-semibold text-primary">
                {t("checkout.changeAddress")}
              </span>
            </>
          ) : (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Plus className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {t("checkout.addDeliveryAddress")}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t("checkout.deliveryAddressHint")}
                </span>
              </span>
            </>
          )}
        </button>
        {error ? (
          <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-300">
            {t("checkout.deliveryAddressRequired")}
          </p>
        ) : null}
      </div>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showClose={false}
          className="h-auto max-h-[85vh] overflow-hidden rounded-t-2xl border-border bg-card p-0 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3"
        >
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
          <SheetHeader className="bg-transparent px-6 pb-2 text-left">
            <SheetTitle>
              {view === "form"
                ? editingId
                  ? t("checkout.editAddress")
                  : t("checkout.newDeliveryAddress")
                : t("checkout.deliveryAddress")}
            </SheetTitle>
          </SheetHeader>

          {view === "list" ? (
            <div className="flex max-h-[70vh] flex-col">
              <div className="min-h-0 space-y-2 overflow-y-auto px-6">
                {saved.map((address) => {
                  const isSelected = selected?.id === address.id;
                  const lines = guestDeliveryDisplayLines(address, displayPhone);
                  return (
                    <div
                      key={address.id}
                      className={cn(
                        "flex items-start gap-2 rounded-xl border px-3 py-3",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border/70 bg-background/40",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelect(address)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <GuestDeliveryAddressLines
                          nickname={address.nickname}
                          lines={lines}
                        />
                      </button>
                      <button
                        type="button"
                        aria-label={t("checkout.editAddress")}
                        onClick={() => {
                          setForm(formFromAddress(address));
                          setEditingId(address.id);
                          setMissingField(null);
                          setView("form");
                        }}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={t("checkout.deleteAddress")}
                        onClick={() => handleDelete(address.id)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="px-6">
                <Button
                  type="button"
                  className="mt-4 h-12 w-full text-base font-semibold"
                  onClick={() => {
                    setForm(emptyFormWithPhone(defaultCountry));
                    setEditingId(null);
                    setMissingField(null);
                    setView("form");
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {t("checkout.addDeliveryAddress")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex max-h-[70vh] flex-col">
              <div className="min-h-0 space-y-3 overflow-y-auto px-6">
                <label className="block text-sm text-foreground">
                  {t("checkout.addressNickname")}
                  <input
                    ref={(node) => {
                      fieldRefs.current.nickname = node;
                    }}
                    type="text"
                    autoComplete="off"
                    value={form.nickname}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, nickname: event.target.value }));
                      clearFieldError();
                    }}
                    placeholder={t("checkout.addressNicknamePlaceholder")}
                    maxLength={40}
                    className={requiredInputClass("nickname")}
                    aria-invalid={missingField === "nickname"}
                  />
                  {fieldError("nickname")}
                </label>
                <label className="block text-sm text-foreground">
                  {t("checkout.addressStreet")}
                  <input
                    ref={(node) => {
                      fieldRefs.current.line1 = node;
                    }}
                    type="text"
                    autoComplete="address-line1"
                    value={form.line1}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, line1: event.target.value }));
                      clearFieldError();
                    }}
                    placeholder={t("checkout.addressStreetPlaceholder")}
                    maxLength={255}
                    className={requiredInputClass("line1")}
                    aria-invalid={missingField === "line1"}
                  />
                  {fieldError("line1")}
                </label>
                <label className="block text-sm text-foreground">
                  {t("checkout.addressBuilding")}
                  <input
                    ref={(node) => {
                      fieldRefs.current.building = node;
                    }}
                    type="text"
                    autoComplete="off"
                    value={form.building}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, building: event.target.value }));
                      clearFieldError();
                    }}
                    placeholder={t("checkout.addressBuildingPlaceholder")}
                    maxLength={255}
                    className={requiredInputClass("building")}
                    aria-invalid={missingField === "building"}
                  />
                  {fieldError("building")}
                </label>
                <label className="block text-sm text-foreground">
                  {t("checkout.addressApt")}
                  <input
                    ref={(node) => {
                      fieldRefs.current.line2 = node;
                    }}
                    type="text"
                    autoComplete="address-line2"
                    value={form.line2}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, line2: event.target.value }));
                      clearFieldError();
                    }}
                    placeholder={t("checkout.addressAptPlaceholder")}
                    maxLength={255}
                    className={requiredInputClass("line2")}
                    aria-invalid={missingField === "line2"}
                  />
                  {fieldError("line2")}
                </label>
                <label className="block text-sm text-foreground">
                  {t("checkout.addressIntercom")}
                  <input
                    ref={(node) => {
                      fieldRefs.current.intercom = node;
                    }}
                    type="text"
                    autoComplete="off"
                    value={form.intercom}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, intercom: event.target.value }));
                      clearFieldError();
                    }}
                    placeholder={t("checkout.addressIntercomPlaceholder")}
                    maxLength={255}
                    className={requiredInputClass("intercom")}
                    aria-invalid={missingField === "intercom"}
                  />
                  {fieldError("intercom")}
                </label>
                <label className="block text-sm text-foreground">
                  {t("checkout.addressPhone")}
                  <div className="mt-1.5 flex gap-2" dir="ltr">
                    <GuestPhoneCountrySelect
                      value={form.phoneCountry}
                      onChange={(countryCode) => {
                        setForm((prev) => ({ ...prev, phoneCountry: countryCode }));
                        clearFieldError();
                      }}
                      invalid={missingField === "phone"}
                    />
                    <input
                      ref={(node) => {
                        fieldRefs.current.phone = node;
                      }}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={(event) => {
                        setForm((prev) => ({ ...prev, phone: event.target.value }));
                        clearFieldError();
                      }}
                      placeholder={t("checkout.addressPhonePlaceholder")}
                      maxLength={50}
                      className={cn(requiredInputClass("phone"), "mt-0 flex-1")}
                      aria-invalid={missingField === "phone"}
                    />
                  </div>
                  {fieldError("phone")}
                </label>
                <label className="block text-sm text-foreground">
                  {t("checkout.addressInstructions")}
                  <textarea
                    value={form.instructions}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, instructions: event.target.value }))
                    }
                    placeholder={t("checkout.addressInstructionsPlaceholder")}
                    rows={2}
                    maxLength={500}
                    className="mt-1.5 w-full resize-none rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </label>
              </div>
              <div className="mt-4 space-y-2 px-6">
                <Button
                  type="button"
                  className="h-12 w-full text-base font-semibold"
                  onClick={handleSave}
                >
                  {t("checkout.useThisAddress")}
                </Button>
                {saved.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full"
                    onClick={() => setView("list")}
                  >
                    {t("checkout.backToAddresses")}
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
