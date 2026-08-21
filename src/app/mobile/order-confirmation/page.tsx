"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  Clock3,
  CookingPot,
  MapPin,
  Phone,
  Receipt,
  Store,
} from "lucide-react";
import { useDisplayPhone } from "@/lib/public-menu/use-display-phone";

type OrderType = "on_site" | "pickup";
type StatusId = "placed" | "confirmed" | "preparing" | "ready";

interface StatusStep {
  id: StatusId;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

const order = {
  orderNumber: "ORD-1234",
  orderType: "on_site" as OrderType,
  tableNumber: "5",
  etaMinutes: 15,
  placedAt: "Today, 7:24 PM",
};

const restaurant = {
  name: "Pizza Palace",
  address: "123 Main Street, Brussels",
  phone: "+32 123 456 789",
};

const items = [
  { quantity: 1, name: "Margherita (Medium)", price: 16.5 },
  { quantity: 2, name: "Pepperoni (Large)", price: 38.0 },
  { quantity: 1, name: "Coca-Cola", price: 3.5 },
];

const statusSteps: StatusStep[] = [
  { id: "placed", label: "Placed", subtitle: "Order received", icon: CheckCheck },
  { id: "confirmed", label: "Confirmed", subtitle: "Kitchen accepted", icon: Check },
  { id: "preparing", label: "Preparing", subtitle: "Being made now", icon: CookingPot },
  { id: "ready", label: "Ready", subtitle: "Ready to serve", icon: CheckCheck },
];

const statusTiming: Array<{ afterMs: number; status: StatusId }> = [
  { afterMs: 5000, status: "confirmed" },
  { afterMs: 15000, status: "preparing" },
  { afterMs: 25000, status: "ready" },
];

function euro(value: number) {
  return `€${value.toFixed(2)}`;
}

export default function MobileOrderConfirmationPage() {
  const displayPhone = useDisplayPhone();
  const router = useRouter();
  const [orderType, setOrderType] = useState<OrderType>(order.orderType);
  const [tableNumber, setTableNumber] = useState(order.tableNumber);
  const [etaMinutes, setEtaMinutes] = useState(order.etaMinutes);
  const [pickupLabel, setPickupLabel] = useState("On the way");

  const [currentStatus, setCurrentStatus] = useState<StatusId>("placed");
  const [secondsLeft, setSecondsLeft] = useState(etaMinutes * 60);
  const [expandedSummary, setExpandedSummary] = useState(false);
  const [pulseReady, setPulseReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setOrderType(params.get("mode") === "pickup" ? "pickup" : "on_site");
    setTableNumber(params.get("table") || order.tableNumber);
    setEtaMinutes(Number(params.get("eta") || order.etaMinutes));
    setPickupLabel(params.get("pickupLabel") || "On the way");
  }, []);

  useEffect(() => {
    setSecondsLeft(etaMinutes * 60);
  }, [etaMinutes]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const timers = statusTiming.map((entry) =>
      window.setTimeout(() => setCurrentStatus(entry.status), entry.afterMs)
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (currentStatus !== "ready") return;
    setPulseReady(true);
    const timer = window.setTimeout(() => setPulseReady(false), 1800);
    if ("vibrate" in navigator) navigator.vibrate([120, 60, 120]);
    return () => window.clearTimeout(timer);
  }, [currentStatus]);

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    []
  );
  const collapsedVisibleCount = items[0]?.quantity ?? 0;
  const hiddenItemCount = Math.max(itemCount - collapsedVisibleCount, 0);
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    []
  );
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  const statusIndex = statusSteps.findIndex((step) => step.id === currentStatus);
  const progress = ((statusIndex + 1) / statusSteps.length) * 100;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  const statusMessage =
    currentStatus === "placed"
      ? "We received your order."
      : currentStatus === "confirmed"
        ? "Order confirmed. Kitchen is on it."
        : currentStatus === "preparing"
          ? "Your food is being prepared."
          : "Your order is ready.";

  const pillClass =
    "sheen-overlay relative rounded-xl border border-white/24 bg-black/76 px-3 py-2 text-white backdrop-blur-2xl ring-1 ring-white/10 dark:border-blue-300/28 dark:bg-blue-900/58 dark:text-blue-100 vivid:border-white/55 vivid:bg-white/76 vivid:text-black";

  return (
    <div className="min-h-screen pb-34">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Link href="/mobile" className="rounded-full p-1 text-foreground hover:bg-foreground/10">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Order Confirmed
            </p>
            <h1 className="text-base font-semibold text-foreground">{order.orderNumber}</h1>
          </div>
          <div className="w-7" />
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 pb-3 pt-4">
        <section className="liquid-glass overflow-hidden rounded-2xl border border-white/20 bg-card/72 p-4 shadow-[0_18px_38px_rgba(0,0,0,0.22)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Live Status
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">{statusMessage}</p>
              <p className="mt-1 text-xs text-muted-foreground">Placed {order.placedAt}</p>
            </div>

            <div
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                currentStatus === "ready"
                  ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100 dark:text-emerald-100 vivid:text-emerald-900"
                  : "border-border bg-card/55 text-foreground"
              } ${pulseReady ? "animate-pulse" : ""}`}
            >
              {currentStatus.toUpperCase()}
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-card/65">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500/85 via-cyan-500/75 to-blue-500/75 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className={pillClass}>
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                <p className="text-xs uppercase tracking-[0.16em] text-white/70 dark:text-blue-100/70 vivid:text-black/65">
                  ETA
                </p>
              </div>
              <p className="mt-1 text-lg font-semibold">
                {minutes}:{seconds.toString().padStart(2, "0")}
              </p>
            </div>

            <div className={pillClass}>
              <div className="flex items-center gap-2">
                {orderType === "on_site" ? (
                  <Store className="h-4 w-4" />
                ) : (
                  <CalendarClock className="h-4 w-4" />
                )}
                <p className="text-xs uppercase tracking-[0.16em] text-white/70 dark:text-blue-100/70 vivid:text-black/65">
                  {orderType === "on_site" ? "On-site" : "Pickup"}
                </p>
              </div>
              <p className="mt-1 text-lg font-semibold">
                {orderType === "on_site" ? `Table ${tableNumber}` : pickupLabel}
              </p>
            </div>
          </div>
        </section>

        <section className="liquid-glass rounded-2xl border border-white/20 bg-card/72 p-4 shadow-[0_16px_30px_rgba(0,0,0,0.2)]">
          <p className="mb-3 text-base font-semibold text-foreground">Progress</p>
          <div className="space-y-2.5">
            {statusSteps.map((step, index) => {
              const StepIcon = step.icon;
              const complete = index <= statusIndex;
              const current = step.id === currentStatus;

              return (
                <div
                  key={step.id}
                  className={`rounded-xl border px-3 py-2 transition-all ${
                    complete
                      ? "border-white/35 bg-black/72 text-white dark:border-blue-300/30 dark:bg-blue-900/58 dark:text-blue-100 vivid:border-white/50 vivid:bg-white/80 vivid:text-black"
                      : "border-border/80 bg-card/45 text-foreground"
                  } ${current ? "ring-1 ring-white/12 dark:ring-blue-300/20 vivid:ring-black/12" : ""}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                        complete
                          ? "border-white/35 bg-white/12 dark:border-blue-300/35 dark:bg-blue-400/15 vivid:border-black/18 vivid:bg-black/10"
                          : "border-border/80"
                      }`}
                    >
                      <StepIcon className="h-4 w-4" />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{step.label}</p>
                      <p className="text-xs opacity-80">{step.subtitle}</p>
                    </div>
                    {complete ? <Check className="h-4 w-4" /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="liquid-glass rounded-2xl border border-white/20 bg-card/72 p-4 shadow-[0_16px_30px_rgba(0,0,0,0.2)]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-base font-semibold text-foreground">Order Summary</p>
            <button
              type="button"
              onClick={() => setExpandedSummary((prev) => !prev)}
              className="rounded-full border border-border/80 bg-card/55 p-1 text-foreground"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${expandedSummary ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          <div className="space-y-2">
            {(expandedSummary ? items : items.slice(0, 1)).map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="rounded-xl border border-border/70 bg-card/45 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {item.quantity}x {item.name}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {euro(item.price * item.quantity)}
                  </p>
                </div>
              </div>
            ))}
            {!expandedSummary && hiddenItemCount > 0 && (
              <button
                type="button"
                onClick={() => setExpandedSummary(true)}
                className="w-full rounded-xl border border-border/70 bg-card/40 px-3 py-2 text-xs text-muted-foreground hover:border-foreground/35"
              >
                +{hiddenItemCount} more item{hiddenItemCount !== 1 ? "s" : ""}
              </button>
            )}
          </div>

          <div className="mt-3 space-y-1.5 rounded-xl border border-border/70 bg-card/45 px-3 py-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium text-foreground">{euro(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-medium text-foreground">{euro(tax)}</span>
            </div>
            <div className="h-px bg-border/80" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Total</span>
              <span className="text-xl font-bold text-foreground">{euro(total)}</span>
            </div>
          </div>
        </section>

        <section className="liquid-glass rounded-2xl border border-white/20 bg-card/72 p-4 shadow-[0_16px_30px_rgba(0,0,0,0.2)]">
          <p className="mb-2 text-base font-semibold text-foreground">Restaurant</p>
          <div className="space-y-2 text-sm text-foreground">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-muted-foreground" />
              <span>{restaurant.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{restaurant.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{displayPhone(restaurant.phone)}</span>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto max-w-md pb-[calc(env(safe-area-inset-bottom)+2px)]">
          <div className="item-modal-footer liquid-glass rounded-t-2xl border-t border-border/70 bg-card/85 px-4 pt-3 pb-3 shadow-lg shadow-black/30 backdrop-blur-xl">
            <div className="mb-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="sheen-overlay relative rounded-xl border border-white/24 bg-black/76 px-3 py-2.5 text-sm font-semibold text-white backdrop-blur-2xl ring-1 ring-white/10 dark:border-blue-300/28 dark:bg-blue-900/58 dark:text-blue-100 vivid:border-white/55 vivid:bg-white/76 vivid:text-black"
                onClick={() => window.open(`tel:${restaurant.phone}`, "_self")}
              >
                Call Restaurant
              </button>
              <button
                type="button"
                className="rounded-xl border border-border/80 bg-card/55 px-3 py-2.5 text-sm font-semibold text-foreground hover:border-foreground/35"
                onClick={() => alert("Receipt export preview")}
              >
                <span className="inline-flex items-center gap-1">
                  <Receipt className="h-4 w-4" />
                  Receipt
                </span>
              </button>
            </div>

            <button
              type="button"
              className="sheen-overlay relative min-h-12 w-full rounded-xl border border-white/26 bg-black/78 px-4 py-3 text-white backdrop-blur-2xl shadow-[0_14px_30px_rgba(0,0,0,0.42)] ring-1 ring-white/10 transition-transform duration-200 hover:bg-black/84 active:scale-[0.99] dark:border-blue-300/25 dark:bg-blue-900/55 dark:text-blue-100 dark:hover:bg-blue-900/70 vivid:border-white/55 vivid:bg-white/72 vivid:text-black vivid:hover:bg-white/84"
              onClick={() => router.push("/mobile")}
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
