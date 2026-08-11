"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardList, Loader2, LogIn, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GuestTabPage } from "@/components/mobile-ordering/guest-tab-page";
import { usePublicMenu } from "@/lib/contexts/PublicMenuContext";
import {
  buildGuestActiveOrderConfirmationPath,
  readGuestActiveOrder,
  recoverGuestActiveOrderFromSession,
  type GuestActiveOrder,
} from "@/lib/public-menu/guest-active-order-storage";
import type { GuestOrderHistoryEntry } from "@/lib/public-menu/getGuestOrderHistory";
import { useGuestT } from "@/lib/guest-i18n";
import type { EnMessageKey } from "@/lib/guest-i18n/messages/en";
import { cn } from "@/lib/utils";

function euro(value: number) {
  return `€${value.toFixed(2)}`;
}

function formatOrderDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function GuestOrdersPage() {
  const router = useRouter();
  const t = useGuestT();
  const {
    storeSlug,
    restaurant,
    items,
    addToCart,
    customer,
    customerLoading,
    orderHistory,
    orderHistoryLoading,
    refetchOrderHistory,
    accountLoginPath,
    checkoutPath,
    menuPath,
  } = usePublicMenu();

  const [activeOrder, setActiveOrder] = useState<GuestActiveOrder | null>(null);

  const trackStatusLabel: Record<GuestOrderHistoryEntry["trackStatus"], EnMessageKey> = {
    scheduled: "confirm.scheduled",
    placed: "confirm.received",
    preparing: "confirm.preparing",
    ready: "confirm.ready",
    served: "orders.served",
    cancelled: "orders.cancelled",
    refunded: "orders.refunded",
  };

  useEffect(() => {
    setActiveOrder(
      readGuestActiveOrder(storeSlug) ?? recoverGuestActiveOrderFromSession(storeSlug),
    );
  }, [storeSlug]);

  useEffect(() => {
    if (customerLoading) return;
    void refetchOrderHistory();
  }, [customerLoading, refetchOrderHistory]);

  const handleReorder = (order: GuestOrderHistoryEntry) => {
    let added = 0;
    let unavailable = 0;

    for (const line of order.items) {
      const menuItem = line.itemId
        ? items.find((entry) => entry.id === line.itemId)
        : undefined;
      if (!menuItem) {
        unavailable += 1;
        continue;
      }
      for (let i = 0; i < Math.max(1, line.quantity); i += 1) {
        addToCart(menuItem);
      }
      added += 1;
    }

    if (added === 0) {
      toast.error(t("orders.noneAvailable"));
      return;
    }
    toast.success(
      unavailable > 0
        ? t("orders.addedPartial", { added, unavailable })
        : t("orders.addedToCart"),
    );
    router.push(checkoutPath);
  };

  const activeOrderPath = activeOrder
    ? buildGuestActiveOrderConfirmationPath(storeSlug, activeOrder)
    : null;

  const showLoading =
    customerLoading || (orderHistoryLoading && orderHistory.length === 0);

  return (
    <GuestTabPage title={t("orders.title")} subtitle={restaurant?.name ?? null}>
      {activeOrderPath ? (
        <Link
          href={activeOrderPath}
          className="flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 shadow-sm backdrop-blur-md"
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {t("orders.inProgress")}
            </p>
            <p className="truncate font-semibold text-foreground">
              Order #{activeOrder?.orderNumber}
            </p>
            <p className="text-xs text-muted-foreground">{t("orders.tapToTrack")}</p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-primary" />
        </Link>
      ) : null}

      {showLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !customer ? (
        <section className="rounded-2xl border border-border/70 bg-card/70 p-5 text-center shadow-sm backdrop-blur-md">
          <ClipboardList className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-base font-semibold text-foreground">
            {t("orders.keepHistory")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("orders.signInHint")}
          </p>
          <Link
            href={accountLoginPath}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
          >
            <LogIn className="h-4 w-4" />
            {t("account.signIn")}
          </Link>
        </section>
      ) : orderHistory.length === 0 ? (
        <section className="rounded-2xl border border-border/70 bg-card/70 p-5 text-center shadow-sm backdrop-blur-md">
          <p className="text-base font-semibold text-foreground">{t("orders.empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("orders.fromRestaurant", {
              name: restaurant?.name ?? t("account.thisRestaurant"),
            })}
          </p>
          <Link
            href={menuPath}
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-border/70 text-sm font-semibold text-foreground"
          >
            {t("cart.browseMenu")}
          </Link>
        </section>
      ) : (
        <ul className="space-y-3">
          {orderHistory.map((order) => (
            <li
              key={order.orderId}
              className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm backdrop-blur-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">#{order.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatOrderDate(order.createdAt)}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                    order.trackStatus === "cancelled"
                      ? "bg-rose-500/15 text-rose-800 dark:text-rose-200"
                      : order.trackStatus === "refunded"
                        ? "bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-200"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {t(trackStatusLabel[order.trackStatus])}
                </span>
              </div>

              <ul className="mt-3 space-y-1.5">
                {order.items.map((line, index) => (
                  <li
                    key={`${order.orderId}-${line.itemId ?? line.itemName}-${index}`}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-muted-foreground">
                        {line.quantity}× {line.itemName}
                      </p>
                      {line.notes ? (
                        <p className="mt-0.5 text-xs">
                          <span className="text-foreground/70">{t("common.instructions")}</span>{" "}
                          <span className="italic text-amber-700/90">{line.notes}</span>
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-muted-foreground">
                      {line.lineTotal === 0 ? t("common.free") : euro(line.lineTotal)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                <span className="text-sm font-semibold text-foreground">
                  {euro(order.total)}
                </span>
                <Button size="sm" variant="outline" onClick={() => handleReorder(order)}>
                  <RotateCcw className="h-4 w-4" />
                  {t("orders.reorder")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </GuestTabPage>
  );
}
