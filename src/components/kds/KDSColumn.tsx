"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { KDSTicket } from "./KDSTicket";
import { KDSEmptyState } from "./KDSEmptyState";
import { useDisplayMode } from "./DisplayModeContext";
import type { Station } from "./StationSwitcher";
import { cn } from "@/lib/utils";
import {
  getArrivalTimestamp,
  getAgeTimestampForColumn,
} from "@/lib/kds/agingHelpers";

type OrderStatus = "pending" | "preparing" | "ready";

interface OrderItem {
  id: string;
  name: string;
  variant: string | null;
  quantity: number;
  customizations: string[];
  stationId?: string;
  status?: "pending" | "preparing" | "ready" | "served";
  sentToKitchenAt?: string | null;
  startedAt?: string | null;
  readyAt?: string | null;
  prepGroup?: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  orderType: "dine_in" | "pickup";
  tableNumber: string | null;
  customerName: string | null;
  status: OrderStatus;
  createdAt: string;
  firedAt?: string | null;
  items: OrderItem[];
  specialInstructions?: string;
  stationStatuses?: Record<string, OrderStatus>;
  isRemake?: boolean;
  isSnoozed?: boolean;
  snoozedAt?: string;
  snoozeUntil?: string;
  wasSnoozed?: boolean;
  /** Work group for split tickets. Set for NEW work-group entries. */
  prepGroup?: string | null;
  /** Order-level station statuses (for waiting-on when order is work-group entry). */
  stationStatusesFull?: Record<string, OrderStatus>;
}

interface KDSColumnProps {
  title: string;
  /** Optional emoji or icon character shown before the title in the column header */
  titleIcon?: string;
  status: OrderStatus;
  orders: Order[];
  onAction: (orderId: string, newStatus: OrderStatus | "served", itemIds?: string[]) => void;
  onRefire?: (orderId: string, item: import("./KDSTicket").OrderItem, reason: string) => void;
  onVoidItem?: (orderId: string, itemId: string) => void;
  onClearModified?: (orderId: string) => void;
  onSnooze?: (orderId: string, durationSeconds: number) => void;
  onWakeUp?: (orderId: string) => void;
  onSplitToNewTicket?: (orderId: string, itemId: string) => void;
  onUnsplitToMain?: (orderId: string, itemId: string) => void;
  allowSplitUnsplit?: boolean;
  highlightedTicketId?: string | null;
  currentStationId?: string;
  stations?: Station[];
  isMobile?: boolean;
  isReady?: boolean;
  transitioningTickets?: Map<string, { from: OrderStatus; to: OrderStatus }>;
  highlightedBatch?: import("./KDSColumns").HighlightedBatch | null;
  /** When true, do not filter orders by status (parent passes pre-filtered list, e.g. READY). */
  disableStatusFilter?: boolean;
  /** For READY + kitchen: derive substation summary per order. */
  getReadySubstationSummary?: (
    order: Order
  ) => import("@/lib/kds/derivePreparingLaneEntries").ReadySubstationSummary | null;
  /** When true, hide the column header (parent provides it, e.g. PREPARING fallback). */
  hideHeader?: boolean;
  /** Full station-visible orders for queue numbering. Uses firedAt ?? createdAt for arrival order. */
  allOrdersForQueue?: Order[];
  /** Optional message for empty state. Default derived from status if not provided. */
  emptyStateMessage?: string;
  /** Use composite key (orderId::prepGroup) for work-group tickets in NEW. */
  useWorkGroupKey?: boolean;
}

function getElapsedMinutes(ts: string): number {
  return Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
}

/** Group aggregate status for work-group scoping. */
function statusFromItems(items: { status?: string }[]): "pending" | "preparing" | "ready" | "served" {
  if (items.length === 0) return "pending";
  const hasPending = items.some((i) => i.status === "pending");
  const hasPreparing = items.some((i) => i.status === "preparing");
  const hasReady = items.some((i) => i.status === "ready");
  if (hasPending && !hasPreparing && !hasReady) return "pending";
  if (hasPending && (hasReady || hasPreparing)) return "preparing";
  if (hasPreparing) return "preparing";
  if (hasReady) return "ready";
  return "served";
}

/** READY: items that are ready/served AND belong to a work-group that is ready or served. */
function getReadyWorkGroupScopedItems(items: OrderItem[]): OrderItem[] {
  const MAIN = "main";
  const byGroup = new Map<string, OrderItem[]>();
  for (const item of items) {
    const g = item.prepGroup && String(item.prepGroup).trim() ? item.prepGroup : MAIN;
    const list = byGroup.get(g) ?? [];
    list.push(item);
    byGroup.set(g, list);
  }
  const readyOrServedGroups = new Set<string>();
  for (const [g, groupItems] of byGroup) {
    const st = statusFromItems(groupItems);
    if (st === "ready" || st === "served") readyOrServedGroups.add(g);
  }
  return items.filter((i) => {
    const g = i.prepGroup && String(i.prepGroup).trim() ? i.prepGroup : MAIN;
    if (!readyOrServedGroups.has(g)) return false;
    return i.status === "ready" || i.status === "served";
  });
}

function sortByUrgency(orders: Order[]): Order[] {
  return orders.sort((a, b) => {
    const aTs = getArrivalTimestamp(a);
    const bTs = getArrivalTimestamp(b);
    // Remake tickets at top (highest priority)
    if (a.isRemake && !b.isRemake) return -1;
    if (!a.isRemake && b.isRemake) return 1;
    if (a.isRemake && b.isRemake) {
      return new Date(aTs).getTime() - new Date(bTs).getTime();
    }

    const aMinutes = getElapsedMinutes(aTs);
    const bMinutes = getElapsedMinutes(bTs);

    const aUrgency = aMinutes >= 10 ? 2 : aMinutes >= 5 ? 1 : 0;
    const bUrgency = bMinutes >= 10 ? 2 : bMinutes >= 5 ? 1 : 0;

    // Sort by urgency tier first
    if (aUrgency !== bUrgency) return bUrgency - aUrgency;

    // Within same tier, snoozed tickets at bottom
    if (a.isSnoozed && !b.isSnoozed) return 1;
    if (!a.isSnoozed && b.isSnoozed) return -1;
    if (a.isSnoozed && b.isSnoozed) {
      return new Date(aTs).getTime() - new Date(bTs).getTime();
    }

    // Within same tier, oldest first
    return new Date(aTs).getTime() - new Date(bTs).getTime();
  });
}

/** 1-based queue position using firedAt ?? createdAt (global arrival order). */
function getQueuePosition(order: Order, allOrders: Order[]): number {
  const sorted = [...allOrders].sort(
    (a, b) =>
      new Date(getArrivalTimestamp(a)).getTime() -
      new Date(getArrivalTimestamp(b)).getTime()
  );
  const index = sorted.findIndex((o) => o.id === order.id);
  return index !== -1 ? index + 1 : 0;
}

export function KDSColumn({ 
  title, 
  status, 
  orders, 
  onAction, 
  onRefire,
  onVoidItem,
  onClearModified,
  onSnooze,
  onWakeUp,
  onSplitToNewTicket,
  onUnsplitToMain,
  allowSplitUnsplit = false,
  highlightedTicketId,
  currentStationId,
  stations = [],
  isMobile = false,
  isReady = false,
  transitioningTickets = new Map(),
  highlightedBatch = null,
  disableStatusFilter = false,
  getReadySubstationSummary,
  hideHeader = false,
  allOrdersForQueue,
  emptyStateMessage,
  useWorkGroupKey = false,
}: KDSColumnProps) {
  const ordersForQueue = allOrdersForQueue ?? orders;
  const { theme } = useDisplayMode();
  // Track tickets that are in "staged" position (at top, before sliding to final position)
  const [stagedTickets, setStagedTickets] = useState<Set<string>>(new Set());
  const stagedTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  // Delay showing empty state so exit animation can run when the last ticket leaves
  const prevOrderCountRef = useRef<number | null>(null);
  const [showEmptyState, setShowEmptyState] = useState(false);
  // Skip entrance animation for NEW column on initial load (avoids double animation from React Strict Mode)
  const hasCompletedInitialRender = useRef(false);
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      hasCompletedInitialRender.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // Filter by station-specific status unless parent passes pre-filtered list (e.g. READY for kitchen)
  const filteredOrders = disableStatusFilter
    ? orders
    : orders.filter((order) => {
        if (currentStationId && order.stationStatuses) {
          return order.stationStatuses[currentStationId] === status;
        }
        return order.status === status;
      });

  // Detect newly arrived tickets and stage them at top (for READY column)
  useEffect(() => {
    if (status !== "ready") return; // Only apply staging for READY column

    const currentOrderIds = new Set(filteredOrders.map(o => o.id));
    const newlyArrived: string[] = [];

    // Find orders that just appeared (weren't in previous render)
    currentOrderIds.forEach(id => {
      if (!prevOrderIdsRef.current.has(id)) {
        // Check if this ticket is transitioning into ready
        const transition = transitioningTickets.get(id);
        if (transition && transition.to === "ready") {
          newlyArrived.push(id);
        }
      }
    });

    // Stage newly arrived tickets
    if (newlyArrived.length > 0) {
      setStagedTickets(prev => {
        const updated = new Set(prev);
        newlyArrived.forEach(id => updated.add(id));
        return updated;
      });

      // After highlight period, release to final sorted position
      newlyArrived.forEach(id => {
        // Clear any existing timeout
        const existingTimeout = stagedTimeoutsRef.current.get(id);
        if (existingTimeout) clearTimeout(existingTimeout);

        const timeout = setTimeout(() => {
          setStagedTickets(prev => {
            const updated = new Set(prev);
            updated.delete(id);
            return updated;
          });
          stagedTimeoutsRef.current.delete(id);
        }, 1100); // Release after ~1 second highlight

        stagedTimeoutsRef.current.set(id, timeout);
      });
    }

    prevOrderIdsRef.current = currentOrderIds;
  }, [filteredOrders, transitioningTickets, status]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      stagedTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  // Delay empty state when last ticket leaves so exit animation runs (NEW → preparing, READY → complete)
  const getSortTs = (o: Order) =>
    getAgeTimestampForColumn(o, status, currentStationId ?? "");
  const columnOrders =
    status === "pending"
      ? sortByUrgency([...filteredOrders])
      : [...filteredOrders].sort((a, b) => {
          const aIsStaged = stagedTickets.has(a.id);
          const bIsStaged = stagedTickets.has(b.id);
          if (aIsStaged && !bIsStaged) return -1;
          if (!aIsStaged && bIsStaged) return 1;
          if (a.isSnoozed && !b.isSnoozed) return 1;
          if (!a.isSnoozed && b.isSnoozed) return -1;
          if (a.isSnoozed && b.isSnoozed) {
            return new Date(getSortTs(a)).getTime() - new Date(getSortTs(b)).getTime();
          }
          return (
            new Date(getSortTs(a)).getTime() - new Date(getSortTs(b)).getTime()
          );
        });

  useEffect(() => {
    const count = columnOrders.length;
    if (count === 0) {
      // Only delay empty state when we had items (so exit animation can run)
      if (prevOrderCountRef.current !== null && prevOrderCountRef.current > 0) {
        const t = setTimeout(() => setShowEmptyState(true), 400);
        prevOrderCountRef.current = 0;
        return () => clearTimeout(t);
      }
      setShowEmptyState(true);
    } else {
      setShowEmptyState(false);
    }
    prevOrderCountRef.current = count;
  }, [columnOrders.length]);

  const visibleOrders = columnOrders;
  const hiddenCount = 0;

  const headerUnderlineClass = status === "pending"
    ? "border-b-2 border-b-gray-400 dark:border-b-gray-500"
    : status === "preparing"
    ? "border-b-2 border-b-blue-400 dark:border-b-blue-500"
    : status === "ready"
    ? "border-b-2 border-b-green-400 dark:border-b-green-500"
    : "";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Hide header on mobile since we have tabs, or when parent provides it (hideHeader) */}
      {!isMobile && !hideHeader && (
        <div className={cn("px-1.5 py-1 2xl:px-2 2xl:py-1.5 border-b shrink-0 theme-transition", theme.cardBg, theme.border, theme.text, theme.columnTitleSeparator, headerUnderlineClass)}>
          <h2 className="font-semibold text-sm 2xl:text-base text-center uppercase tracking-wide">
            {title} ({columnOrders.length})
          </h2>
        </div>
      )}
      <div className={cn("flex-1 overflow-y-auto overflow-x-hidden p-4 2xl:p-5 min-h-0 relative theme-transition", theme.text)}>
        {columnOrders.length === 0 && showEmptyState && (
          <KDSEmptyState
            message={
              emptyStateMessage ??
              (status === "pending"
                ? "No new orders"
                : status === "preparing"
                  ? "No orders in prep"
                  : "Nothing ready")
            }
          />
        )}
        <div className={isMobile ? "flex flex-col gap-4" : "flex flex-col gap-4 2xl:gap-5"}>
          <AnimatePresence mode="popLayout">
            {visibleOrders.map((order) => {
                const ticketKey = useWorkGroupKey && order.prepGroup != null
                  ? `${order.id}::${order.prepGroup}`
                  : order.id;
                const queuePosition = getQueuePosition(order, ordersForQueue);
                const ageTimestamp = getAgeTimestampForColumn(
                  order,
                  status,
                  currentStationId ?? ""
                );
                
                // Check if this station is complete
                const stationStatus = currentStationId && order.stationStatuses 
                  ? order.stationStatuses[currentStationId]
                  : undefined;
                
                const isStationComplete = stationStatus === "ready";
                
                // Find stations that are still pending/preparing (order-level for waiting-on)
                const statusesForWaiting = order.stationStatusesFull ?? order.stationStatuses;
                const waitingStations =
                  currentStationId && statusesForWaiting
                    ? stations.filter((s) => {
                        if (s.id === currentStationId) return false;
                        const status = statusesForWaiting[s.id];
                        return status === "pending" || status === "preparing";
                      })
                    : [];
                
                // Check if this ticket just transitioned to this column
                const transition = transitioningTickets.get(order.id);
                const justArrived = transition && transition.to === status;
                const isStaged = stagedTickets.has(order.id);
                
                const isInBatch = highlightedBatch?.orderIds.includes(order.id) ?? false;
                const readySubstationSummary =
                  status === "ready" && getReadySubstationSummary
                    ? getReadySubstationSummary(order)
                    : undefined;

                // READY column: work-group scoped - only items from ready/served groups, and only ready/served items
                const displayOrder =
                  status === "ready"
                    ? {
                        ...order,
                        items: getReadyWorkGroupScopedItems(order.items),
                      }
                    : order;

                // When work-group tickets (NEW split), bind onAction so Start only affects this ticket's items
                const groupItemIds = order.items.map((i) => i.id);
                const effectiveOnAction =
                  useWorkGroupKey
                    ? (oid: string, s: OrderStatus | "served", ids?: string[]) =>
                        onAction(oid, s, ids ?? groupItemIds)
                    : onAction;

                return (
                  <KDSTicket
                    key={ticketKey}
                    order={displayOrder}
                    ageTimestamp={ageTimestamp}
                    onAction={effectiveOnAction}
                    onRefire={onRefire}
                    onVoidItem={onVoidItem}
                    onClearModified={onClearModified}
                    priority={queuePosition > 0 ? queuePosition : undefined}
                    isHighlighted={order.id === highlightedTicketId}
                    currentStationId={currentStationId}
                    waitingStations={waitingStations}
                    isStationComplete={isStationComplete}
                    columnAccent={status === "pending" ? "new" : status === "ready" ? "ready" : undefined}
                    transitionDirection={justArrived ? "from-left" : undefined}
                    isLanding={justArrived || isStaged}
                    landingType={(justArrived || isStaged) ? (status === "ready" ? "ready" : "preparing") : undefined}
                    skipEntranceAnimation={status === "pending" && !hasCompletedInitialRender.current}
                    batchBadge={isInBatch ? { label: `💡 BATCH: ${highlightedBatch?.itemName ?? ""}` } : undefined}
                    batchItemKey={isInBatch ? highlightedBatch?.batchKey : undefined}
                    isBatchHighlighted={isInBatch}
                    onSnooze={onSnooze}
                    onWakeUp={onWakeUp}
                    onSplitToNewTicket={onSplitToNewTicket}
                    onUnsplitToMain={onUnsplitToMain}
                    allowSplitUnsplit={allowSplitUnsplit}
                    readySubstationSummary={readySubstationSummary ?? undefined}
                  />
                );
              })}
          </AnimatePresence>
          {hiddenCount > 0 && (
            <div className={cn("text-center py-4 2xl:py-5 text-base 2xl:text-lg rounded-lg border theme-transition", theme.textMuted, theme.cardBg, theme.border)}>
              +{hiddenCount} more {hiddenCount === 1 ? 'order' : 'orders'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
