import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  items as itemsTable,
  customizationOptions as customizationOptionsTable,
  customizationGroups as customizationGroupsTable,
  conditionalPrices as conditionalPricesTable,
} from "@/lib/db/schema/menus";
import {
  orders as ordersTable,
  seats as seatsTable,
} from "@/lib/db/schema/orders";
import { createOrderWithItemsForPickupDelivery } from "@/app/actions/orders";
import type { PickupDeliveryLineItemInput } from "@/app/actions/orders";
import { addGuestItemsToSession } from "@/lib/public-menu/addGuestItemsToSession";
import {
  claimGuestTableSeat,
  validateGuestSeatForOrder,
} from "@/lib/public-menu/claimGuestTableSeat";
import { ensureGuestTableSession } from "@/lib/public-menu/ensureGuestTableSession";
import { resolveGuestSessionMode } from "@/lib/public-menu/guestSessionMode";
import {
  getStationRoutingContext,
  resolveStationOverride,
} from "@/lib/kds/resolveStationForOrderItem";
import {
  resolvePublicLocationBySlug,
} from "@/lib/public-menu/buildPublicMenuView";
import { resolveOptionPriceFromSelectedOptionIds } from "@/lib/public-menu/resolve-customization-option-price";
import { applyPromosToBuiltLines } from "@/lib/promotions/pricing";
import { resolveItemPromos } from "@/lib/promotions/resolveActivePromotions";
import { toUserFacingDbError } from "@/lib/db/withDbRetry";
import {
  formatScheduledPickupNote,
  parseScheduledPickupAt,
} from "@/lib/public-menu/scheduledOrderRelease";
import { getLoggedInCustomer } from "@/lib/public-menu/getLoggedInCustomer";
import { ensureWalkInCustomerByPhone } from "@/lib/public-menu/ensureWalkInCustomerByPhone";
import { isValidGuestPhone } from "@/lib/public-menu/guest-phone";
import { withTx } from "@/domain/tx";
import {
  applyLoyaltyRedemptionForOrder,
  prepareLoyaltyRedemptionForOrder,
} from "@/lib/loyalty/applyLoyaltyRedemptionForOrder";
import { resolveMerchantIdForLocation } from "@/lib/loyalty/redeemLoyaltyPointsForOrder";
import type {
  CreatePublicOrderInput,
  CreatePublicOrderResult,
  PublicOrderItemInput,
} from "@/lib/public-menu/types";

const GUEST_IDEMPOTENCY_USER = "public-guest";

export function getPublicGuestIdempotencyUserId(): string {
  return GUEST_IDEMPOTENCY_USER;
}

function assertOrderModeEnabled(
  orderModes: NonNullable<Awaited<ReturnType<typeof resolvePublicLocationBySlug>>>["orderModes"],
  orderType: CreatePublicOrderInput["orderType"],
): string | null {
  if (orderType === "pickup" && orderModes?.pickup?.enabled === false) {
    return "Pickup is not available for this store";
  }
  if (orderType === "delivery" && orderModes?.delivery?.enabled === false) {
    return "Delivery is not available for this store";
  }
  if (orderType === "dine_in" && orderModes?.dine_in?.enabled === false) {
    return "Dine-in ordering is not available for this store";
  }
  return null;
}

async function validateAndBuildLineItems(
  locationId: string,
  orderItems: PublicOrderItemInput[],
): Promise<
  | { ok: true; lineItems: PickupDeliveryLineItemInput[]; subtotal: number }
  | { ok: false; message: string }
> {
  const itemIds = [...new Set(orderItems.map((item) => item.itemId).filter(Boolean))];
  if (itemIds.length === 0) {
    return { ok: false, message: "At least one menu item is required" };
  }

  const menuItems = await db.query.items.findMany({
    where: and(eq(itemsTable.locationId, locationId), inArray(itemsTable.id, itemIds)),
    columns: { id: true, name: true, price: true, status: true, defaultStation: true },
  });
  const itemMap = new Map(menuItems.map((item) => [item.id, item]));
  const promoByItem = await resolveItemPromos(
    locationId,
    new Map(menuItems.map((item) => [item.id, Number(item.price) || 0])),
  );

  if (menuItems.length !== itemIds.length) {
    return { ok: false, message: "One or more items are invalid for this store" };
  }

  for (const menuItem of menuItems) {
    if (menuItem.status === "draft" || menuItem.status === "hidden") {
      return { ok: false, message: `Item "${menuItem.name}" is not available` };
    }
  }

  const stationCtx = await getStationRoutingContext(locationId);
  const lineItems: PickupDeliveryLineItemInput[] = [];

  for (const orderItem of orderItems) {
    const menuItem = itemMap.get(orderItem.itemId);
    if (!menuItem) {
      return { ok: false, message: "Invalid menu item" };
    }

    const itemPrice = promoByItem.get(menuItem.id)?.price ?? Number(menuItem.price);
    const qty = Math.max(1, Math.floor(orderItem.quantity ?? 1));
    let customizationsTotal = 0;
    const custRows: PickupDeliveryLineItemInput["customizations"] = [];

    for (const customization of orderItem.customizations ?? []) {
      const opt = await db.query.customizationOptions.findFirst({
        where: eq(customizationOptionsTable.id, customization.optionId),
        columns: { id: true, groupId: true, name: true, price: true },
      });
      if (!opt) {
        return { ok: false, message: "Invalid customization option" };
      }
      const group = await db.query.customizationGroups.findFirst({
        where: and(
          eq(customizationGroupsTable.id, opt.groupId),
          eq(customizationGroupsTable.locationId, locationId),
        ),
        columns: { id: true, name: true },
      });
      if (!group) {
        return { ok: false, message: "Invalid customization group" };
      }

      const selectedOptionIds = new Set(
        (orderItem.customizations ?? []).map((entry) => entry.optionId),
      );
      const conditionalRows = await db.query.conditionalPrices.findMany({
        where: eq(conditionalPricesTable.optionId, opt.id),
        columns: { baseOptionId: true, price: true },
      });
      const relatedOptionIds = [
        ...selectedOptionIds,
        ...conditionalRows.map((row) => row.baseOptionId),
      ];
      const nameRows =
        relatedOptionIds.length > 0
          ? await db.query.customizationOptions.findMany({
              where: inArray(customizationOptionsTable.id, relatedOptionIds),
              columns: { id: true, name: true },
            })
          : [];
      const optionNameById = new Map(
        nameRows.map((row) => [row.id, row.name] as const),
      );
      const optPrice = resolveOptionPriceFromSelectedOptionIds(
        Number(opt.price),
        conditionalRows,
        selectedOptionIds,
        optionNameById,
      );
      const custQty = Math.max(1, Math.floor(customization.quantity ?? 1));
      customizationsTotal += optPrice * custQty;
      custRows.push({
        groupId: group.id,
        optionId: opt.id,
        groupName: group.name,
        optionName: opt.name,
        optionPrice: optPrice.toFixed(2),
        quantity: custQty,
      });
    }

    const lineTotal = itemPrice * qty + customizationsTotal;

    const resolvedStation = resolveStationOverride(
      stationCtx,
      menuItem.defaultStation,
    );

    lineItems.push({
      itemId: orderItem.itemId,
      itemName: menuItem.name,
      itemPrice: itemPrice.toFixed(2),
      quantity: qty,
      customizationsTotal: customizationsTotal.toFixed(2),
      lineTotal: lineTotal.toFixed(2),
      notes: orderItem.notes ?? null,
      stationOverride: resolvedStation,
      customizations: custRows,
    });
  }

  const pricedLines = applyPromosToBuiltLines(lineItems, promoByItem);
  const pricedSubtotal = pricedLines.reduce(
    (sum, line) => sum + (Number(line.lineTotal) || 0),
    0,
  );
  return { ok: true, lineItems: pricedLines, subtotal: pricedSubtotal };
}

async function createPickupOrDeliveryOrder(
  input: CreatePublicOrderInput,
  location: NonNullable<Awaited<ReturnType<typeof resolvePublicLocationBySlug>>>,
  customerId?: string | null,
  userId?: string | null,
): Promise<CreatePublicOrderResult> {
  const built = await validateAndBuildLineItems(location.id, input.items);
  if (!built.ok) return { ok: false, code: "BAD_REQUEST", message: built.message };

  const requestedPoints = Math.floor(input.pointsToRedeem ?? 0);
  const rewardId = input.rewardId?.trim() || null;
  const wantsRedemption = requestedPoints > 0 || !!rewardId;

  let discountAmount = 0;
  let lineItems = built.lineItems;
  let subtotal = built.subtotal;
  let preparedRedemption: Awaited<
    ReturnType<typeof prepareLoyaltyRedemptionForOrder>
  > = {
    ok: true,
    mode: "none",
    discountAmount: 0,
    pointsToDebit: 0,
    lineItems: built.lineItems,
    subtotal: built.subtotal,
    rewardId: null,
  };

  if (wantsRedemption) {
    if (!userId) {
      return {
        ok: false,
        code: "BAD_REQUEST",
        message: "Sign in to redeem loyalty rewards",
      };
    }
    const merchantId = await resolveMerchantIdForLocation(location.id);
    if (!merchantId) {
      return { ok: false, code: "INTERNAL_ERROR", message: "Store configuration error" };
    }
    preparedRedemption = await prepareLoyaltyRedemptionForOrder({
      userId,
      merchantId,
      locationId: location.id,
      subtotal: built.subtotal,
      lineItems: built.lineItems,
      pointsToRedeem: requestedPoints > 0 ? requestedPoints : undefined,
      rewardId: rewardId ?? undefined,
    });
    if (!preparedRedemption.ok) {
      return { ok: false, code: "BAD_REQUEST", message: preparedRedemption.error };
    }
    discountAmount = preparedRedemption.discountAmount;
    lineItems = preparedRedemption.lineItems;
    subtotal = preparedRedemption.subtotal;
  }

  const taxRate = Number.parseFloat(String(location.taxRate ?? "0.00")) / 100;
  const serviceChargeRate =
    Number.parseFloat(String(location.serviceChargePercentage ?? "0.00")) / 100;
  const taxAmount = subtotal * taxRate;
  const serviceCharge = subtotal * serviceChargeRate;
  const total = Math.max(0, subtotal + taxAmount + serviceCharge - discountAmount);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayOrders = await db.query.orders.findMany({
    where: and(
      eq(ordersTable.locationId, location.id),
      gte(ordersTable.createdAt, today),
      lte(ordersTable.createdAt, tomorrow),
    ),
    columns: { id: true },
  });
  const orderNumber = `ORD-${String(todayOrders.length + 1).padStart(3, "0")}`;

  const scheduledPickupAt = parseScheduledPickupAt(input.scheduledPickupAt);
  if (input.scheduledPickupAt && !scheduledPickupAt) {
    return { ok: false, code: "BAD_REQUEST", message: "Invalid scheduledPickupAt" };
  }
  if (scheduledPickupAt && scheduledPickupAt.getTime() <= Date.now()) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: "scheduledPickupAt must be in the future",
    };
  }

  const scheduledNote = scheduledPickupAt
    ? formatScheduledPickupNote(scheduledPickupAt)
    : null;
  const notes = [input.notes?.trim() || null, scheduledNote]
    .filter(Boolean)
    .join(" · ") || null;

  const merchantId =
    preparedRedemption.ok &&
    preparedRedemption.mode !== "none" &&
    userId
      ? await resolveMerchantIdForLocation(location.id)
      : null;

  let result: { ok: true; orderId: string } | { ok: false; error: string };
  try {
    result = await withTx(async (tx) => {
      const created = await createOrderWithItemsForPickupDelivery(
        {
          locationId: location.id,
          customerId: customerId ?? null,
          orderNumber,
          orderType:
            input.orderType === "delivery"
              ? "delivery"
              : input.orderType === "dine_in"
                ? "dine_in"
                : "pickup",
          paymentTiming: input.paymentTiming,
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          serviceCharge: serviceCharge.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          total: total.toFixed(2),
          notes,
          scheduledPickupAt,
        },
        lineItems,
        { changedByUserId: null },
        tx,
      );

      if (!created.ok) {
        throw new Error(created.error);
      }

      if (
        preparedRedemption.ok &&
        preparedRedemption.mode !== "none" &&
        userId &&
        merchantId
      ) {
        const redeemResult = await applyLoyaltyRedemptionForOrder(
          {
            orderId: created.orderId,
            userId,
            merchantId,
            locationId: location.id,
            prepared: preparedRedemption,
          },
          tx,
        );
        if (!redeemResult.ok) {
          throw new Error(redeemResult.error);
        }
      }

      return created;
    });
  } catch (error) {
    console.error("[createPickupOrDeliveryOrder]", error);
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      message: toUserFacingDbError(error, "Failed to create order. Please try again."),
    };
  }

  if (!result.ok) {
    return { ok: false, code: "INTERNAL_ERROR", message: result.error };
  }

  const order = await db.query.orders.findFirst({
    where: eq(ordersTable.id, result.orderId),
    columns: { orderNumber: true },
  });

  try {
    const { sendIncomingOrderPush } = await import("@/lib/orders/sendIncomingOrderPush");
    await sendIncomingOrderPush({
      locationId: location.id,
      orderId: result.orderId,
      orderNumber: order?.orderNumber ?? orderNumber,
      orderType:
        input.orderType === "delivery"
          ? "delivery"
          : input.orderType === "dine_in"
            ? "dine_in"
            : "pickup",
      itemCount: lineItems.reduce(
        (sum, item) => sum + Math.max(1, item.quantity ?? 1),
        0,
      ),
      scheduledPickupAt,
      prepMinutes: location.orderModes?.pickup?.estimated_time_minutes ?? 15,
    });
  } catch (error) {
    console.error("[createPickupOrDeliveryOrder] push notify failed", error);
  }

  return {
    ok: true,
    orderId: result.orderId,
    orderNumber: order?.orderNumber ?? orderNumber,
  };
}

async function createDineInGuestOrder(
  input: CreatePublicOrderInput,
  location: NonNullable<Awaited<ReturnType<typeof resolvePublicLocationBySlug>>>,
  customerId?: string | null,
  customerName?: string | null,
): Promise<CreatePublicOrderResult> {
  const tableNumber = input.tableNumber?.trim();
  if (!tableNumber) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: "Table number is required for dine-in orders",
    };
  }

  const tableSession = await ensureGuestTableSession({
    locationId: location.id,
    tableNumber,
    guestSessionMode: resolveGuestSessionMode(location.orderModes),
    guestCount: input.guestCount,
  });
  if (!tableSession.ok) {
    return {
      ok: false,
      code: tableSession.code,
      message: tableSession.message,
    };
  }

  const seatIdInput = input.seatId?.trim() || undefined;
  let seatId = seatIdInput;
  let seatNumber: number | undefined;

  // Delivery-to-table: assign a seat to this phone if the client didn't send one yet.
  if (
    !seatId &&
    input.deviceId &&
    resolveGuestSessionMode(location.orderModes) === "staff_seated"
  ) {
    const claimed = await claimGuestTableSeat({
      storeSlug: input.storeSlug,
      tableNumber,
      deviceId: input.deviceId,
    });
    if (claimed.ok) {
      seatId = claimed.data.seatId;
      seatNumber = claimed.data.seatNumber;
    }
  }

  if (seatId) {
    const seatValidation = await validateGuestSeatForOrder({
      locationId: location.id,
      sessionId: tableSession.sessionId,
      seatId,
      deviceId: input.deviceId ?? undefined,
    });
    if (!seatValidation.ok) {
      return {
        ok: false,
        code: seatValidation.code,
        message: seatValidation.message,
      };
    }
    seatNumber = seatValidation.seatNumber;
  }

  try {
    const result = await addGuestItemsToSession(
      tableSession.sessionId,
      location.id,
      input.items,
      // Hold for staff accept on /orders (incoming beep + overlay), same as pickup.
      { autoFire: false, seatId, seatNumber },
    );

    if (!result.ok) {
      return { ok: false, code: "BAD_REQUEST", message: result.message };
    }

    if (customerId) {
      await db
        .update(ordersTable)
        .set({ customerId, updatedAt: new Date() })
        .where(eq(ordersTable.id, result.orderId));
    }

    const trimmedCustomerName = customerName?.trim() || null;
    if (seatId && trimmedCustomerName) {
      await db
        .update(seatsTable)
        .set({ guestName: trimmedCustomerName.slice(0, 255), updatedAt: new Date() })
        .where(eq(seatsTable.id, seatId));
    }

    try {
      const { sendIncomingOrderPush } = await import("@/lib/orders/sendIncomingOrderPush");
      await sendIncomingOrderPush({
        locationId: location.id,
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        orderType: "dine_in",
        itemCount: input.items.reduce(
          (sum, item) => sum + Math.max(1, item.quantity ?? 1),
          0,
        ),
      });
    } catch (error) {
      console.error("[createDineInGuestOrder] push notify failed", error);
    }

    return {
      ok: true,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
    };
  } catch (error) {
    console.error("[createDineInGuestOrder]", error);
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      message: toUserFacingDbError(error, "Failed to create order. Please try again."),
    };
  }
}

export async function createPublicOrder(
  input: CreatePublicOrderInput,
): Promise<CreatePublicOrderResult> {
  const normalizedSlug = input.storeSlug.trim().toLowerCase();
  const location = await resolvePublicLocationBySlug(normalizedSlug);

  if (!location?.storeSlug) {
    return { ok: false, code: "NOT_FOUND", message: "Store not found" };
  }
  if (!location.enableOnlineOrders) {
    return { ok: false, code: "FORBIDDEN", message: "Online ordering is disabled for this store" };
  }
  if (location.status !== "active") {
    return { ok: false, code: "FORBIDDEN", message: "This store is not accepting orders" };
  }
  if (!input.items?.length) {
    return { ok: false, code: "BAD_REQUEST", message: "At least one item is required" };
  }

  const modeError = assertOrderModeEnabled(location.orderModes, input.orderType);
  if (modeError) {
    return { ok: false, code: "BAD_REQUEST", message: modeError };
  }

  let customerId: string | null = null;
  let customerName: string | null = null;
  let userId: string | null = null;
  try {
    const loggedIn = await getLoggedInCustomer(normalizedSlug);
    customerId = loggedIn?.customerId ?? null;
    customerName = loggedIn?.name?.trim() || input.guestName?.trim().slice(0, 255) || null;
    userId = loggedIn?.userId ?? null;
  } catch (error) {
    console.error("[createPublicOrder] Failed to resolve logged-in customer:", error);
  }

  if (!userId) {
    const guestSessionMode = resolveGuestSessionMode(location.orderModes);
    const requiresGuestPhone =
      input.orderType === "pickup" ||
      input.orderType === "delivery" ||
      (input.orderType === "dine_in" && guestSessionMode === "self_service");
    if (requiresGuestPhone) {
      const guestPhone = input.phone?.trim() || "";
      if (!isValidGuestPhone(guestPhone)) {
        return {
          ok: false,
          code: "BAD_REQUEST",
          message: "Please enter a valid mobile number",
        };
      }
      customerId =
        (await ensureWalkInCustomerByPhone({
          locationId: location.id,
          phone: guestPhone,
        })) ?? customerId;
    }
  }

  if (input.orderType === "dine_in") {
    const guestSessionMode = resolveGuestSessionMode(location.orderModes);
    // Walk-in self-service dine-in: no table/seat — create a counter dine-in order.
    if (guestSessionMode === "self_service" && !input.tableNumber?.trim()) {
      return createPickupOrDeliveryOrder(input, location, customerId, userId);
    }
    if (
      (input.pointsToRedeem != null && input.pointsToRedeem > 0) ||
      (typeof input.rewardId === "string" && input.rewardId.trim().length > 0)
    ) {
      return {
        ok: false,
        code: "BAD_REQUEST",
        message: "Loyalty redemption is not available for table orders yet",
      };
    }
    return createDineInGuestOrder(input, location, customerId, customerName);
  }

  return createPickupOrDeliveryOrder(input, location, customerId, userId);
}
