"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Loader2,
  LogIn,
  RotateCcw,
} from "lucide-react";
import { GuestDealBadge, guestDealKind } from "@/components/mobile-ordering/guest-deal-badge";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GuestTabPage } from "@/components/mobile-ordering/guest-tab-page";
import { OpsCustomizationDisplayLines } from "@/components/shared/customization-display-lines";
import { usePublicMenu } from "@/lib/contexts/PublicMenuContext";
import {
  buildGuestActiveOrderConfirmationPath,
  readGuestActiveOrders,
  recoverGuestActiveOrdersFromSession,
  type GuestActiveOrder,
} from "@/lib/public-menu/guest-active-order-storage";
import type { GuestOrderHistoryEntry } from "@/lib/public-menu/getGuestOrderHistory";
import { groupIdenticalGuestLines } from "@/lib/public-menu/groupGuestConfirmationItems";
import { isGuestOrderInProgress } from "@/lib/public-menu/deriveGuestOrderTrackStatus";
import { useGuestT } from "@/lib/guest-i18n";
import type { EnMessageKey } from "@/lib/guest-i18n/messages/en";
import { useGuestLocalization } from "@/lib/hooks/useGuestLocalization";
import { cn } from "@/lib/utils";

const PAST_PAGE_SIZE = 8;

function groupedHistoryItems(items: GuestOrderHistoryEntry["items"]) {
  return groupIdenticalGuestLines(
    items.map((item) => ({
      ...item,
      customizations: item.customizations ?? [],
    })),
  );
}

export function GuestOrdersPage() {
  const router = useRouter();
  const t = useGuestT();
  const { formatMoney, formatDateTime } = useGuestLocalization();
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

  const [activeOrders, setActiveOrders] = useState<GuestActiveOrder[]>([]);
  const [pastPage, setPastPage] = useState(1);
  const [historyPage, setHistoryPage] = useState<GuestOrderHistoryEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPageLoading, setHistoryPageLoading] = useState(false);

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
    recoverGuestActiveOrdersFromSession(storeSlug);
    setActiveOrders(readGuestActiveOrders(storeSlug));
  }, [storeSlug]);

  useEffect(() => {
    setPastPage(1);
  }, [storeSlug, customer?.userId]);

  useEffect(() => {
    if (customerLoading) return;
    void refetchOrderHistory();
  }, [customerLoading, refetchOrderHistory]);

  useEffect(() => {
    if (customerLoading) return;
    if (!customer) {
      setHistoryPage([]);
      setHistoryTotal(0);
      setHistoryPageLoading(false);
      return;
    }

    let cancelled = false;
    const loadPage = async () => {
      setHistoryPageLoading(true);
      try {
        const params = new URLSearchParams({
          storeSlug,
          limit: String(PAST_PAGE_SIZE),
          offset: String((pastPage - 1) * PAST_PAGE_SIZE),
        });
        const response = await fetch(`/api/public/orders/history?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          data?: { orders?: GuestOrderHistoryEntry[]; total?: number };
        } | null;
        if (cancelled) return;
        if (response.ok && payload?.ok === true) {
          setHistoryPage(Array.isArray(payload.data?.orders) ? payload.data.orders : []);
          setHistoryTotal(Number(payload.data?.total) || 0);
        } else {
          setHistoryPage([]);
          setHistoryTotal(0);
        }
      } catch {
        if (!cancelled) {
          setHistoryPage([]);
          setHistoryTotal(0);
        }
      } finally {
        if (!cancelled) setHistoryPageLoading(false);
      }
    };

    void loadPage();
    return () => {
      cancelled = true;
    };
  }, [customer, customerLoading, pastPage, storeSlug]);

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

  const inProgressOrders = useMemo(() => {
    const byId = new Map<string, GuestActiveOrder>();
    for (const order of activeOrders) {
      byId.set(order.orderId, order);
    }
    for (const order of [...orderHistory, ...historyPage]) {
      if (!isGuestOrderInProgress(order.trackStatus)) continue;
      if (byId.has(order.orderId)) continue;
      byId.set(order.orderId, {
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        mode: order.orderType === "pickup" ? "pickup" : "on_site",
        tableNumber: null,
        etaMinutes: 15,
        savedAt: Date.parse(order.createdAt) || 0,
      });
    }
    return [...byId.values()].sort((a, b) => b.savedAt - a.savedAt);
  }, [activeOrders, historyPage, orderHistory]);

  const pastOrders = useMemo(
    () => historyPage.filter((order) => !isGuestOrderInProgress(order.trackStatus)),
    [historyPage],
  );
  const pastPageCount = Math.max(1, Math.ceil(historyTotal / PAST_PAGE_SIZE));
  const showPastPagination = Boolean(customer) && historyTotal > PAST_PAGE_SIZE;

  useEffect(() => {
    if (pastPage > pastPageCount) setPastPage(pastPageCount);
  }, [pastPage, pastPageCount]);

  const showLoading =
    customerLoading ||
    ((orderHistoryLoading || historyPageLoading) &&
      orderHistory.length === 0 &&
      historyPage.length === 0);

  return (
    <GuestTabPage title={t("orders.title")} subtitle={restaurant?.name ?? null}>
      {inProgressOrders.length > 0 ? (
        <section className="space-y-3">
          {inProgressOrders.map((order) => (
            <Link
              key={order.orderId}
              href={buildGuestActiveOrderConfirmationPath(storeSlug, order)}
              className="flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 shadow-sm backdrop-blur-md"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {t("orders.inProgress")}
                </p>
                <p className="truncate font-semibold text-foreground">
                  Order #{order.orderNumber}
                </p>
                <p className="text-xs text-muted-foreground">{t("orders.tapToTrack")}</p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-primary" />
            </Link>
          ))}
        </section>
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
      ) : !historyPageLoading && historyTotal === 0 && inProgressOrders.length === 0 ? (
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
        <>
          {historyPageLoading && pastOrders.length === 0 ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : null}
          {pastOrders.length > 0 ? (
        <ul className={cn("space-y-3", historyPageLoading ? "opacity-60" : null)}>
          {pastOrders.map((order) => (
            <li
              key={order.orderId}
              className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm backdrop-blur-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">#{order.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(order.createdAt)}
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
                {groupedHistoryItems(order.items).map((line, index) => (
                  <li
                    key={`${order.orderId}-${line.itemId ?? line.itemName}-${index}`}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-baseline text-muted-foreground">
                        <span className="truncate">
                          {line.quantity}× {line.itemName}
                        </span>
                        <GuestDealBadge
                          kind={guestDealKind({
                            promoKind: items.find((entry) => entry.id === line.itemId)
                              ?.promoKind,
                          })}
                        />
                      </p>
                      {(line.customizations?.length ?? 0) > 0 ? (
                        <OpsCustomizationDisplayLines
                          customizations={line.customizations}
                          surface="guest"
                          showPrice={false}
                          textSizeClassName="text-xs"
                        />
                      ) : null}
                      {line.notes ? (
                        <p className="mt-0.5 text-xs">
                          <span className="text-foreground/70">{t("common.instructions")}</span>{" "}
                          <span className="italic text-amber-700/90">{line.notes}</span>
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-muted-foreground">
                      {line.lineTotal === 0 ? t("common.free") : formatMoney(line.lineTotal)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                <span className="text-sm font-semibold text-foreground">
                  {formatMoney(order.total)}
                </span>
                <Button size="sm" variant="outline" onClick={() => handleReorder(order)}>
                  <RotateCcw className="h-4 w-4" />
                  {t("orders.reorder")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
          ) : null}
          {showPastPagination ? (
            <nav
              className="flex items-center justify-between gap-3 pt-1"
              aria-label={t("orders.title")}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={pastPage <= 1 || historyPageLoading}
                onClick={() => setPastPage((page) => Math.max(1, page - 1))}
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                {t("orders.previous")}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("orders.pageOf", { page: pastPage, pages: pastPageCount })}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={pastPage >= pastPageCount || historyPageLoading}
                onClick={() => setPastPage((page) => Math.min(pastPageCount, page + 1))}
              >
                {t("orders.next")}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </GuestTabPage>
  );
}
