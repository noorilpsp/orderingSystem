"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock,
  CreditCard,
  DollarSign,
  MapPin,
  Smartphone,
  Store,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneNumberField } from "@/components/shared/phone-number-field";
import { WalkingPersonLottie } from "@/components/ui/walking-person-lottie";
import { customizationGroups } from "@/lib/menu-item-modal-data";
import { EditTableModal } from "@/components/mobile-ordering/menu/edit-table-modal";

type OrderType = "dine-in" | "pickup";
type TipOption = "none" | "10" | "15" | "20" | "custom";
type PickupTimeMode = "asap" | "schedule";
type ThemeVariant = "classic" | "night" | "vivid";

interface OrderItem {
  quantity: number;
  name: string;
  variant: string | null;
  price: number;
  selectedOptions?: Record<string, string[]>;
  sauceQuantities?: Record<string, number>;
  specialInstructions?: string;
}

const restaurant = {
  name: "Pizza Palace",
  address: "123 Main Street, Brussels",
  distance: "1.2 km",
  tippingEnabled: true,
};

const orderSummary = {
  items: [
    {
      quantity: 1,
      name: "Margherita",
      variant: "Medium",
      price: 16.5,
      selectedOptions: {
        toppings: ["mushrooms", "olives"],
      },
      specialInstructions: "Extra crispy please",
    },
    {
      quantity: 2,
      name: "Pepperoni",
      variant: "Large",
      price: 19.0,
      selectedOptions: {
        toppings: ["extra-cheese"],
      },
      sauceQuantities: {
        "garlic-sauce": 2,
      },
    },
    { quantity: 1, name: "Coca-Cola", variant: null, price: 3.5 },
  ] satisfies OrderItem[],
  subtotal: 58.0,
  tax: 5.8,
};

const scheduleDays = [
  { label: "Today", date: "Jan 25", value: "2026-01-25" },
  { label: "Sat", date: "Jan 26", value: "2026-01-26" },
  { label: "Sun", date: "Jan 27", value: "2026-01-27" },
  { label: "Mon", date: "Jan 28", value: "2026-01-28" },
  { label: "Tue", date: "Jan 29", value: "2026-01-29" },
];

const timeSlots = [
  "11:00 - 11:30",
  "11:15 - 11:45",
  "11:30 - 12:00",
  "11:45 - 12:15",
  "12:00 - 12:30",
  "12:15 - 12:45",
  "12:30 - 13:00",
  "12:45 - 13:15",
];

function getCustomizationParts(
  groupId: string,
  optionIds: string[]
): { groupName: string; optionNames: string } | null {
  const group = customizationGroups.find((entry) => entry.id === groupId);
  if (!group) return null;

  const optionNames = optionIds
    .map((optionId) => group.options.find((option) => option.id === optionId)?.name || optionId)
    .join(", ");

  return { groupName: group.name, optionNames };
}

function to12HourRange(range: string) {
  const [start, end] = range.split(" - ");
  const convert = (value: string) => {
    const [hours, minutes] = value.split(":");
    const hourNumber = Number(hours);
    const suffix = hourNumber >= 12 ? "PM" : "AM";
    const hour12 = hourNumber % 12 || 12;
    return `${hour12}:${minutes} ${suffix}`;
  };
  return `${convert(start)} - ${convert(end)}`;
}

function euro(value: number) {
  return `€${value.toFixed(2)}`;
}

export default function MobileCheckoutPage() {
  const router = useRouter();
  const [themeVariant, setThemeVariant] = useState<ThemeVariant>("classic");

  const [orderType, setOrderType] = useState<OrderType>("dine-in");
  const [tableNumber, setTableNumber] = useState("5");
  const [isEditTableOpen, setIsEditTableOpen] = useState(false);
  const [pickupTimeMode, setPickupTimeMode] = useState<PickupTimeMode>("asap");
  const [selectedDay, setSelectedDay] = useState(scheduleDays[0].value);
  const [selectedTime, setSelectedTime] = useState(timeSlots[0]);
  const [tipOption, setTipOption] = useState<TipOption>("none");
  const [customTip, setCustomTip] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pay-now");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saveDetails, setSaveDetails] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const itemCount = useMemo(
    () => orderSummary.items.reduce((sum, item) => sum + item.quantity, 0),
    []
  );
  const collapsedVisibleCount = orderSummary.items[0]?.quantity ?? 0;
  const hiddenItemCount = Math.max(itemCount - collapsedVisibleCount, 0);

  const paymentMethods = useMemo(
    () =>
      orderType === "dine-in"
        ? [
            { id: "pay-now", label: "Pay now (Card)", icon: CreditCard },
            { id: "pay-counter", label: "Pay at counter", icon: DollarSign },
            { id: "pay-table", label: "Pay at table", icon: Smartphone },
          ]
        : [
            { id: "pay-now", label: "Pay now (Card)", icon: CreditCard },
            { id: "pay-pickup", label: "Pay at pickup", icon: DollarSign },
          ],
    [orderType]
  );

  useEffect(() => {
    const availableIds = paymentMethods.map((method) => method.id);
    if (!availableIds.includes(paymentMethod)) {
      setPaymentMethod(availableIds[0]);
    }
  }, [paymentMethod, paymentMethods]);

  const tipAmount = useMemo(() => {
    if (tipOption === "10") return orderSummary.subtotal * 0.1;
    if (tipOption === "15") return orderSummary.subtotal * 0.15;
    if (tipOption === "20") return orderSummary.subtotal * 0.2;
    if (tipOption === "custom" && customTip) return Math.max(0, Number(customTip) || 0);
    return 0;
  }, [customTip, tipOption]);

  const total = orderSummary.subtotal + orderSummary.tax + tipAmount;
  const selectedDayObj = scheduleDays.find((day) => day.value === selectedDay);

  const isFormComplete = useMemo(() => {
    if (orderType === "dine-in") return true;
    return Boolean(name.trim() && phone.trim());
  }, [name, orderType, phone]);

  const cardClass =
    "liquid-glass rounded-2xl border border-white/20 bg-card/70 p-4 shadow-[0_16px_32px_rgba(0,0,0,0.2)] backdrop-blur-xl";
  const selectCardClass =
    "sheen-overlay relative rounded-xl border px-3 py-2.5 text-left transition-all";
  const activeSelectClass =
    "border-white/45 bg-black/80 text-white ring-1 ring-white/12 dark:border-blue-300/45 dark:bg-blue-900/70 dark:text-blue-100 vivid:border-white/65 vivid:bg-white/84 vivid:text-black";
  const idleSelectClass =
    "border-border bg-card/55 text-foreground hover:border-foreground/40";
  const ctaButtonClass =
    "sheen-overlay relative min-h-12 w-full rounded-xl border border-white/26 bg-black/78 px-4 py-3 text-white backdrop-blur-2xl shadow-[0_14px_30px_rgba(0,0,0,0.42)] ring-1 ring-white/10 transition-transform duration-200 hover:bg-black/84 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:hover:bg-blue-900/70 vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:hover:bg-white/84";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const resolveTheme = (): ThemeVariant => {
      if (root.classList.contains("vivid")) return "vivid";
      if (root.classList.contains("dark")) return "night";
      return "classic";
    };

    setThemeVariant(resolveTheme());

    const observer = new MutationObserver(() => {
      setThemeVariant(resolveTheme());
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  const isPickupSelected = orderType === "pickup";
  const pickupIconTone: "white" | "black" =
    themeVariant === "night"
      ? "white"
      : themeVariant === "vivid"
        ? isPickupSelected
          ? "black"
          : "white"
        : isPickupSelected
          ? "white"
          : "black";

  return (
    <div className="checkout-page min-h-screen pb-28">
      <header className="checkout-header sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Link href="/mobile" className="rounded-full p-1 text-foreground hover:bg-foreground/10" aria-label="Back to menu">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Checkout</p>
            <h1 className="text-base font-semibold text-foreground">Review & Confirm</h1>
          </div>
          <div className="rounded-full border border-border bg-card/70 px-2 py-1 text-xs font-medium text-foreground">
            {itemCount} items
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 pb-2 pt-4">
        <div>
          <div className="liquid-glass rounded-2xl border border-white/20 bg-card/72 p-1 shadow-[0_12px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setOrderType("dine-in")}
                className={`${selectCardClass} ${
                  orderType === "dine-in" ? activeSelectClass : idleSelectClass
                } text-center`}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <Store className="dine-icon-float h-5 w-5" />
                  On-site
                </span>
              </button>
              <button
                type="button"
                onClick={() => setOrderType("pickup")}
                className={`${selectCardClass} ${
                  orderType === "pickup" ? activeSelectClass : idleSelectClass
                } text-center`}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <WalkingPersonLottie className="h-8 w-8" tone={pickupIconTone} />
                  Pickup
                </span>
              </button>
            </div>
          </div>
        </div>

        {orderType === "dine-in" ? (
          <section className={cardClass}>
            <button
              type="button"
              onClick={() => setIsEditTableOpen(true)}
              className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-card/45 px-3 py-3 text-left transition-colors hover:border-foreground/35"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full border border-border/70 p-2">
                  <Store className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    On-site Session
                  </p>
                  <p className="text-base font-semibold text-foreground">Table {tableNumber}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Tap to change</p>
            </button>
          </section>
        ) : (
          <section className={`${cardClass} space-y-3`}>
            <div className="flex items-start gap-3">
              <div className="rounded-full border border-border/70 p-2">
                <Store className="h-4 w-4 text-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-foreground">{restaurant.name}</p>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="truncate">{restaurant.address}</span>
                </div>
              </div>
              <span className="rounded-full border border-border/70 px-2 py-1 text-xs text-muted-foreground">
                {restaurant.distance}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPickupTimeMode("asap")}
                className={`${selectCardClass} ${
                  pickupTimeMode === "asap" ? activeSelectClass : idleSelectClass
                }`}
              >
                <p className="text-sm font-semibold">ASAP</p>
                <p
                  className={`text-xs ${
                    pickupTimeMode === "asap"
                      ? "text-white dark:text-blue-100 vivid:text-black"
                      : "text-muted-foreground"
                  }`}
                >
                  10-15 min
                </p>
              </button>
              <button
                type="button"
                onClick={() => setPickupTimeMode("schedule")}
                className={`${selectCardClass} ${
                  pickupTimeMode === "schedule" ? activeSelectClass : idleSelectClass
                }`}
              >
                <p className="text-sm font-semibold">Schedule</p>
                <p
                  className={`text-xs ${
                    pickupTimeMode === "schedule"
                      ? "text-white dark:text-blue-100 vivid:text-black"
                      : "text-muted-foreground"
                  }`}
                >
                  {selectedDayObj?.label} {selectedDayObj?.date}
                </p>
              </button>
            </div>

            {pickupTimeMode === "schedule" && (
              <div className="space-y-2 rounded-xl border border-border/70 bg-card/45 p-2.5">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Select day and time
                </div>

                <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {scheduleDays.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => setSelectedDay(day.value)}
                      className={`${selectCardClass} min-w-[82px] px-2 py-2 text-center ${
                        selectedDay === day.value ? activeSelectClass : idleSelectClass
                      }`}
                    >
                      <p className="text-xs font-semibold">{day.label}</p>
                      <p
                        className={`text-[11px] ${
                          selectedDay === day.value
                            ? "text-white dark:text-blue-100 vivid:text-black"
                            : "text-muted-foreground"
                        }`}
                      >
                        {day.date}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className={`${selectCardClass} px-2 py-2 text-xs ${
                        selectedTime === slot ? activeSelectClass : idleSelectClass
                      }`}
                    >
                      {to12HourRange(slot)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {orderType === "pickup" && (
          <section className={`${cardClass} space-y-3`}>
            <div>
              <p className="text-base font-semibold text-foreground">Your Details</p>
              <p className="text-xs text-muted-foreground">Required for pickup handoff.</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="name" className="text-xs text-muted-foreground">
                  Name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your full name"
                  className="mt-1 h-10 border-border/80 bg-card/45"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-xs text-muted-foreground">
                  Phone
                </Label>
                <PhoneNumberField
                  id="phone"
                  value={phone}
                  onChange={setPhone}
                  placeholder="Mobile number"
                  className="mt-1"
                  inputClassName="h-10 border-border/80 bg-card/45"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-xs text-muted-foreground">
                  Email (optional)
                </Label>
                <Input
                  id="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@email.com"
                  className="mt-1 h-10 border-border/80 bg-card/45"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSaveDetails((prev) => !prev)}
              className="flex items-center gap-2 text-left"
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded border ${
                  saveDetails
                    ? "border-foreground bg-foreground text-background"
                    : "border-border/80 text-transparent"
                }`}
              >
                <Check className="h-3 w-3" />
              </span>
              <span className="text-xs text-foreground">Save details for next time</span>
            </button>
          </section>
        )}

        <section className={`checkout-order-summary liquid-glass rounded-2xl border border-white/20 bg-card/70 p-3 shadow-[0_16px_32px_rgba(0,0,0,0.2)] backdrop-blur-xl space-y-3`}>
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold text-foreground">Order Summary</p>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
                {itemCount} items
              </span>
              <button
                type="button"
                onClick={() => setSummaryExpanded((prev) => !prev)}
                className="rounded-full border border-border/70 bg-card/55 p-1 text-foreground hover:border-foreground/35"
                aria-expanded={summaryExpanded}
                aria-label={summaryExpanded ? "Collapse order summary" : "Expand order summary"}
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    summaryExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {(summaryExpanded
              ? orderSummary.items
              : orderSummary.items.slice(0, 1)
            ).map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="rounded-xl border border-border/70 bg-card/45 px-2.5 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {item.quantity}x {item.name}
                      {item.variant ? ` (${item.variant})` : ""}
                    </p>

                    {(item.selectedOptions || item.sauceQuantities || item.specialInstructions) && (
                      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {item.selectedOptions &&
                          Object.entries(item.selectedOptions).map(([groupId, optionIds]) => {
                            const parts = getCustomizationParts(groupId, optionIds);
                            if (!parts) return null;
                            return (
                              <p key={groupId}>
                                {parts.groupName}: {parts.optionNames}
                              </p>
                            );
                          })}
                        {item.sauceQuantities &&
                          Object.entries(item.sauceQuantities).map(([sauceId, qty]) =>
                            qty > 0 ? <p key={sauceId}>Extra Sauce: {sauceId} x{qty}</p> : null
                          )}
                        {item.specialInstructions ? (
                          <p>Note: {item.specialInstructions}</p>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <span className="text-sm font-semibold text-foreground">
                    {euro(item.price * item.quantity)}
                  </span>
                </div>
              </div>
            ))}
            {!summaryExpanded && hiddenItemCount > 0 && (
              <button
                type="button"
                onClick={() => setSummaryExpanded(true)}
                className="w-full rounded-xl border border-border/70 bg-card/40 px-2.5 py-2 text-xs text-muted-foreground hover:border-foreground/35"
              >
                +{hiddenItemCount} more item{hiddenItemCount !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        </section>

        {restaurant.tippingEnabled && (
          <section className={`${cardClass} space-y-3`}>
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-foreground">Tip</p>
              <span className="text-xs text-muted-foreground">Optional</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {(["none", "10", "15", "20"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setTipOption(option);
                    if (option !== "custom") setCustomTip("");
                  }}
                  className={`${selectCardClass} px-2 py-2 text-center ${
                    tipOption === option ? activeSelectClass : idleSelectClass
                  }`}
                >
                  <span className="text-xs font-semibold">
                    {option === "none" ? "No tip" : `${option}%`}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-[84px_1fr] items-center gap-2">
              <button
                type="button"
                onClick={() => setTipOption("custom")}
                className={`${selectCardClass} px-2 py-2 text-center ${
                  tipOption === "custom" ? activeSelectClass : idleSelectClass
                }`}
              >
                <span className="text-xs font-semibold">Custom</span>
              </button>
              <Input
                value={customTip}
                onChange={(event) => {
                  setTipOption("custom");
                  setCustomTip(event.target.value);
                }}
                placeholder="Custom tip amount"
                type="number"
                min="0"
                step="0.01"
                className="h-10 border-border/80 bg-card/45"
              />
            </div>
          </section>
        )}

        <section className={`${cardClass} space-y-2`}>
          <p className="text-base font-semibold text-foreground">Payment</p>
          {paymentMethods.map((method) => {
            const Icon = method.icon;
            const selected = paymentMethod === method.id;
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => setPaymentMethod(method.id)}
                className={`${selectCardClass} flex w-full items-center justify-between ${
                  selected ? activeSelectClass : idleSelectClass
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{method.label}</span>
                </div>
                <span
                  className={`h-4 w-4 rounded-full border ${
                    selected ? "border-current bg-current/20" : "border-border/80"
                  }`}
                />
              </button>
            );
          })}
        </section>

        <section className={`${cardClass} space-y-2`}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium text-foreground">{euro(orderSummary.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span className="font-medium text-foreground">{euro(orderSummary.tax)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tip</span>
            <span className="font-medium text-foreground">{euro(tipAmount)}</span>
          </div>
          <div className="my-2 h-px bg-border/80" />
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-foreground">Total</span>
            <span className="text-2xl font-bold text-foreground">{euro(total)}</span>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto max-w-md pb-[calc(env(safe-area-inset-bottom)+2px)]">
          <div className="item-modal-footer liquid-glass rounded-t-2xl border-t border-border/70 bg-card/85 px-4 pt-3 pb-3 shadow-lg shadow-black/30 backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between px-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {orderType === "dine-in"
                    ? `Table ${tableNumber}`
                    : pickupTimeMode === "asap"
                      ? "Pickup in 10-15 min"
                      : `${selectedDayObj?.label} · ${to12HourRange(selectedTime)}`}
                </span>
              </div>
              <span>{itemCount} items</span>
            </div>

            <button
              type="button"
              disabled={!isFormComplete}
              className={ctaButtonClass}
              onClick={() => {
                const params = new URLSearchParams();
                params.set("mode", orderType === "dine-in" ? "on_site" : "pickup");
                params.set("table", tableNumber);
                params.set("eta", "15");

                if (orderType === "pickup") {
                  const pickupLabel =
                    pickupTimeMode === "asap"
                      ? "Pickup in 10-15 min"
                      : `${selectedDayObj?.label} · ${to12HourRange(selectedTime)}`;
                  params.set("pickupLabel", pickupLabel);
                }

                router.push(`/mobile/order-confirmation?${params.toString()}`);
              }}
            >
              Place Order • {euro(total)}
            </button>
          </div>
        </div>
      </div>

      <EditTableModal
        open={isEditTableOpen}
        onOpenChange={setIsEditTableOpen}
        tableNumber={tableNumber}
        onConfirm={setTableNumber}
      />
    </div>
  );
}
