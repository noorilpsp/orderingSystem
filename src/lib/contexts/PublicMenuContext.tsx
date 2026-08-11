"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  GuestCartItem,
  GuestCategory,
  GuestCustomizationGroup,
  GuestMenuItem,
  GuestOrderModes,
  GuestRestaurant,
} from "@/lib/guest-menu/types";
import {
  restaurant as demoRestaurant,
  categories as demoCategories,
  menuItems as demoMenuItems,
} from "@/lib/menu-data-static";
import type { PublicMenuLoyaltySettings, PublicMenuReward, PublicMenuView } from "@/lib/public-menu/types";
import {
  buildRewardCartLine,
  findRewardInCart,
  isRewardCartLine,
} from "@/lib/public-menu/guest-reward-cart";
import {
  clearSelectedRewardId,
  readSelectedRewardId,
  writeSelectedRewardId,
} from "@/lib/public-menu/guest-reward-storage";
import { buildGuestMenuQueryString } from "@/lib/public-menu/buildPublicMenuUrl";
import {
  buildGuestIdempotencyKey,
  runGuestOrderPlacementInBackground,
  type GuestOrderPlacementRequest,
  type GuestOrderPlacementState,
} from "@/lib/public-menu/guest-order-placement";
import {
  getOrCreateGuestDeviceId,
  writeGuestSeat,
  type StoredGuestSeat,
} from "@/lib/public-menu/guest-seat-storage";
import { resolveGuestSessionMode } from "@/lib/public-menu/guestSessionMode";
import {
  customerLogout,
  fetchLoggedInCustomerAction,
} from "@/app/actions/customer-auth";
import type { GuestOrderHistoryEntry } from "@/lib/public-menu/getGuestOrderHistory";

type OrderType = "dine-in" | "pickup";

const ORDER_HISTORY_STALE_MS = 30_000;

export type GuestSeatState = StoredGuestSeat;

export type GuestTableSeatOption = {
  seatNumber: number;
  seatId: string;
  claimed: boolean;
  guestName: string | null;
};

export type PublicMenuCustomer = {
  userId: string;
  email: string;
  name: string;
  customerId: string | null;
  loyaltyPoints: number | null;
  loyaltyPointsExpiry: {
    nextExpiresAt: string | null;
    pointsExpiringNext: number;
  } | null;
  loyaltyPointLots: Array<{
    expiresAt: string | null;
    pointsRemaining: number;
  }> | null;
};

type PublicMenuContextValue = {
  storeSlug: string;
  locationId: string;
  loading: boolean;
  error: string | null;
  unavailableReason: string | null;
  restaurant: GuestRestaurant | null;
  categories: GuestCategory[];
  items: GuestMenuItem[];
  customizationGroups: GuestCustomizationGroup[];
  orderModes: GuestOrderModes;
  /** Sales tax percent (e.g. 21 = 21%). Defaults to 21 when menu not loaded. */
  taxRate: number;
  cart: GuestCartItem[];
  orderType: OrderType;
  tableNumber: string;
  setOrderType: (type: OrderType) => void;
  setTableNumber: (table: string) => void;
  addToCart: (item: GuestMenuItem | GuestCartItem) => void;
  addRewardToCart: (reward: PublicMenuReward) => void;
  removeFromCart: (itemId: string) => void;
  updateCartItem: (item: GuestCartItem) => void;
  clearCart: () => void;
  getCustomizationGroupsForItem: (itemId: string) => GuestCustomizationGroup[];
  checkoutPath: string;
  menuPath: string;
  orderConfirmationPath: string;
  rewardsPath: string;
  ordersPath: string;
  accountPath: string;
  callTableService: (requestType: "waiter" | "bill") => Promise<{ ok: boolean; message: string }>;
  refetch: () => Promise<void>;
  guestOrderPlacement: GuestOrderPlacementState | null;
  placeGuestOrder: (request: GuestOrderPlacementRequest) => string;
  syncGuestOrderPlacement: (placement: GuestOrderPlacementState) => void;
  guestSeat: GuestSeatState | null;
  guestSeatLoading: boolean;
  guestSeatError: string | null;
  guestDeviceId: string;
  claimGuestSeat: () => Promise<void>;
  updateGuestSeatName: (name: string | null) => Promise<{ ok: boolean; message?: string }>;
  changeGuestSeat: (targetSeatNumber?: number) => Promise<{ ok: boolean; message?: string }>;
  fetchTableSeats: () => Promise<GuestTableSeatOption[]>;
  customer: PublicMenuCustomer | null;
  customerLoading: boolean;
  loyaltySettings: PublicMenuLoyaltySettings | null;
  loyaltyPoints: number | null;
  loyaltyPointsExpiry: PublicMenuCustomer["loyaltyPointsExpiry"];
  loyaltyPointLots: PublicMenuCustomer["loyaltyPointLots"];
  rewards: PublicMenuReward[];
  orderHistory: GuestOrderHistoryEntry[];
  orderHistoryLoading: boolean;
  refetchOrderHistory: (opts?: { force?: boolean }) => Promise<void>;
  refetchCustomer: () => Promise<void>;
  logoutCustomer: () => Promise<void>;
  accountLoginPath: string;
  accountSignupPath: string;
};

const PublicMenuContext = createContext<PublicMenuContextValue | null>(null);

function unwrapPublicMenuResponse(payload: unknown): PublicMenuView | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (record.ok === true && record.data) {
    return record.data as PublicMenuView;
  }
  return record as PublicMenuView;
}

export function PublicMenuProvider({
  storeSlug,
  initialTableNumber = "",
  initialOrderType = "pickup",
  children,
}: {
  storeSlug: string;
  initialTableNumber?: string;
  initialOrderType?: OrderType;
  children: ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<PublicMenuView | null>(null);
  const [cart, setCart] = useState<GuestCartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>(initialOrderType);
  const [tableNumber, setTableNumber] = useState(initialTableNumber);
  const [guestOrderPlacement, setGuestOrderPlacement] =
    useState<GuestOrderPlacementState | null>(null);
  const [guestSeat, setGuestSeat] = useState<GuestSeatState | null>(null);
  const [guestSeatLoading, setGuestSeatLoading] = useState(false);
  const [guestSeatError, setGuestSeatError] = useState<string | null>(null);
  const [guestDeviceId, setGuestDeviceId] = useState("");
  const [customer, setCustomer] = useState<PublicMenuCustomer | null>(null);
  const [customerLoading, setCustomerLoading] = useState(true);
  const [orderHistory, setOrderHistory] = useState<GuestOrderHistoryEntry[]>([]);
  const [orderHistoryLoading, setOrderHistoryLoading] = useState(false);
  const orderHistoryRef = useRef(orderHistory);
  const orderHistoryFetchedAtRef = useRef<number | null>(null);
  const orderHistoryUserIdRef = useRef<string | null>(null);
  orderHistoryRef.current = orderHistory;

  const accountReturnTo = useMemo(() => {
    const query = buildGuestMenuQueryString({ tableNumber, mode: orderType });
    return `/menu/${storeSlug}${query}`;
  }, [orderType, storeSlug, tableNumber]);

  const accountLoginPath = `/login?returnTo=${encodeURIComponent(accountReturnTo)}`;
  const accountSignupPath = `/signup?returnTo=${encodeURIComponent(accountReturnTo)}`;

  useEffect(() => {
    setGuestDeviceId(getOrCreateGuestDeviceId());
  }, []);

  const refetchCustomer = useCallback(async () => {
    if (storeSlug === "demo") {
      setCustomer(null);
      setCustomerLoading(false);
      return;
    }
    setCustomerLoading(true);
    try {
      const result = await fetchLoggedInCustomerAction(storeSlug);
      if (result.ok && result.customer) {
        setCustomer({
          userId: result.customer.userId,
          email: result.customer.email,
          name: result.customer.name,
          customerId: result.customer.customerId,
          loyaltyPoints: result.customer.loyaltyPoints ?? null,
          loyaltyPointsExpiry: result.customer.loyaltyPointsExpiry ?? null,
          loyaltyPointLots: result.customer.loyaltyPointLots ?? null,
        });
      } else {
        setCustomer(null);
      }
    } catch {
      setCustomer(null);
    } finally {
      setCustomerLoading(false);
    }
  }, [storeSlug]);

  useEffect(() => {
    void refetchCustomer();
  }, [refetchCustomer]);

  const clearOrderHistory = useCallback(() => {
    setOrderHistory([]);
    setOrderHistoryLoading(false);
    orderHistoryFetchedAtRef.current = null;
    orderHistoryUserIdRef.current = null;
  }, []);

  const refetchOrderHistory = useCallback(
    async (opts?: { force?: boolean }) => {
      if (storeSlug === "demo") {
        clearOrderHistory();
        return;
      }
      if (!customer) {
        clearOrderHistory();
        return;
      }

      const now = Date.now();
      const fetchedAt = orderHistoryFetchedAtRef.current;
      const sameUser = orderHistoryUserIdRef.current === customer.userId;
      if (
        !opts?.force &&
        sameUser &&
        fetchedAt != null &&
        now - fetchedAt < ORDER_HISTORY_STALE_MS
      ) {
        return;
      }

      const showSpinner =
        orderHistoryRef.current.length === 0 ||
        orderHistoryUserIdRef.current !== customer.userId;
      if (showSpinner) setOrderHistoryLoading(true);

      try {
        const response = await fetch(
          `/api/public/orders/history?storeSlug=${encodeURIComponent(storeSlug)}`,
          { cache: "no-store" },
        );
        const payload = await response.json().catch(() => null);
        if (response.ok && payload?.ok === true) {
          setOrderHistory((payload.data?.orders ?? []) as GuestOrderHistoryEntry[]);
        } else {
          setOrderHistory([]);
        }
        orderHistoryFetchedAtRef.current = Date.now();
        orderHistoryUserIdRef.current = customer.userId;
      } catch {
        if (orderHistoryRef.current.length === 0) {
          setOrderHistory([]);
        }
      } finally {
        setOrderHistoryLoading(false);
      }
    },
    [clearOrderHistory, customer, storeSlug],
  );

  useEffect(() => {
    if (customerLoading) return;
    if (!customer) {
      clearOrderHistory();
      return;
    }
    void refetchOrderHistory();
  }, [clearOrderHistory, customer, customerLoading, refetchOrderHistory]);

  const logoutCustomer = useCallback(async () => {
    clearOrderHistory();
    await customerLogout(accountReturnTo);
  }, [accountReturnTo, clearOrderHistory]);

  useEffect(() => {
    setTableNumber(initialTableNumber);
  }, [initialTableNumber]);

  useEffect(() => {
    setOrderType(initialOrderType);
  }, [initialOrderType]);

  const guestQuery = useMemo(
    () => buildGuestMenuQueryString({ tableNumber, mode: orderType }),
    [orderType, tableNumber],
  );

  useEffect(() => {
    if (typeof window === "undefined" || storeSlug === "demo") return;
    const url = new URL(window.location.href);
    if (!url.pathname.startsWith(`/menu/${storeSlug}`)) return;

    const table = tableNumber.trim();
    if (table) url.searchParams.set("table", table);
    else url.searchParams.delete("table");

    if (orderType === "dine-in") url.searchParams.set("mode", "dine-in");
    else url.searchParams.delete("mode");

    const next = `${url.pathname}${url.search}`;
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(null, "", next);
    }
  }, [orderType, storeSlug, tableNumber]);

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/public/menu/${encodeURIComponent(storeSlug)}?_t=${Date.now()}`,
        { cache: "no-store" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          (payload as { message?: string } | null)?.message ?? "Failed to load menu";
        throw new Error(message);
      }
      const parsed = unwrapPublicMenuResponse(payload);
      if (!parsed) throw new Error("Invalid menu response");
      setView(parsed);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load menu");
      setView(null);
    } finally {
      setLoading(false);
    }
  }, [storeSlug]);

  useEffect(() => {
    void fetchMenu();
  }, [fetchMenu]);

  const customizationGroupMap = useMemo(
    () => new Map((view?.customizationGroups ?? []).map((group) => [group.id, group])),
    [view?.customizationGroups],
  );

  const getCustomizationGroupsForItem = useCallback(
    (itemId: string) => {
      const item = view?.items.find((entry) => entry.id === itemId);
      if (!item?.customizationGroupIds?.length) return [];
      return item.customizationGroupIds
        .map((groupId) => customizationGroupMap.get(groupId))
        .filter((group): group is GuestCustomizationGroup => !!group);
    },
    [customizationGroupMap, view?.items],
  );

  const addToCart = useCallback((item: GuestMenuItem | GuestCartItem) => {
    if (isRewardCartLine(item)) return;
    const incomingQty =
      "quantity" in item && typeof item.quantity === "number" && item.quantity > 0
        ? Math.floor(item.quantity)
        : 1;
    setCart((prevCart) => {
      const existingItem = prevCart.find((cartItem) => cartItem.id === item.id);
      if (existingItem) {
        const isUpdatingCustomizations =
          "selectedOptions" in item ||
          "sauceQuantities" in item ||
          "specialInstructions" in item;
        if (isUpdatingCustomizations) {
          return prevCart.map((cartItem) =>
            cartItem.id === item.id
              ? ({ ...item, quantity: incomingQty } as GuestCartItem)
              : cartItem,
          );
        }
        return prevCart.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + incomingQty }
            : cartItem,
        );
      }
      return [...prevCart, { ...item, quantity: incomingQty } as GuestCartItem];
    });
  }, []);

  const addRewardToCart = useCallback(
    (reward: PublicMenuReward) => {
      const line = buildRewardCartLine(reward, view?.items ?? []);
      setCart((prevCart) => [
        ...prevCart.filter((cartItem) => !isRewardCartLine(cartItem)),
        line,
      ]);
      writeSelectedRewardId(storeSlug, reward.id);
    },
    [storeSlug, view?.items],
  );

  const removeFromCart = useCallback(
    (itemId: string) => {
      setCart((prevCart) => {
        const existingItem = prevCart.find((cartItem) => cartItem.id === itemId);
        if (!existingItem) return prevCart;

        if (isRewardCartLine(existingItem)) {
          clearSelectedRewardId(storeSlug);
          return prevCart.filter((cartItem) => cartItem.id !== itemId);
        }

        if (existingItem.quantity > 1) {
          return prevCart.map((cartItem) =>
            cartItem.id === itemId
              ? { ...cartItem, quantity: cartItem.quantity - 1 }
              : cartItem,
          );
        }
        return prevCart.filter((cartItem) => cartItem.id !== itemId);
      });
    },
    [storeSlug],
  );

  const updateCartItem = useCallback((item: GuestCartItem) => {
    setCart((prevCart) => prevCart.map((cartItem) => (cartItem.id === item.id ? item : cartItem)));
  }, []);

  const clearCart = useCallback(() => {
    clearSelectedRewardId(storeSlug);
    setCart([]);
  }, [storeSlug]);

  useEffect(() => {
    if (!view?.rewards.length || !view.items.length) return;
    const storedRewardId = readSelectedRewardId(storeSlug);
    if (!storedRewardId) return;
    setCart((prevCart) => {
      if (findRewardInCart(prevCart)) return prevCart;
      const reward = view.rewards.find((entry) => entry.id === storedRewardId);
      if (!reward) return prevCart;
      return [
        ...prevCart.filter((cartItem) => !isRewardCartLine(cartItem)),
        buildRewardCartLine(reward, view.items),
      ];
    });
  }, [storeSlug, view?.items, view?.rewards]);

  const syncGuestOrderPlacement = useCallback(
    (placement: GuestOrderPlacementState) => {
      setGuestOrderPlacement(placement);
      if (placement.status === "success") {
        void refetchOrderHistory({ force: true });
      }
    },
    [refetchOrderHistory],
  );

  const placeGuestOrder = useCallback(
    (request: GuestOrderPlacementRequest) => {
      const idempotencyKey = buildGuestIdempotencyKey();
      runGuestOrderPlacementInBackground(storeSlug, idempotencyKey, request, (placement) => {
        setGuestOrderPlacement(placement);
        if (placement.status === "success") {
          void refetchOrderHistory({ force: true });
        }
      });
      return idempotencyKey;
    },
    [refetchOrderHistory, storeSlug],
  );

  const applyGuestSeat = useCallback(
    (table: string, seat: GuestSeatState) => {
      setGuestSeat(seat);
      writeGuestSeat(storeSlug, table, seat);
    },
    [storeSlug],
  );

  const claimGuestSeat = useCallback(async () => {
    const table = tableNumber.trim();
    const isSelfPickup =
      resolveGuestSessionMode(view?.orderModes) === "self_service";
    // Self pickup dine-in does not seat guests at a table.
    if (
      orderType !== "dine-in" ||
      !table ||
      !guestDeviceId ||
      storeSlug === "demo" ||
      isSelfPickup
    ) {
      setGuestSeat(null);
      setGuestSeatError(null);
      return;
    }

    setGuestSeatLoading(true);
    setGuestSeatError(null);
    try {
      const response = await fetch("/api/public/table-seat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeSlug,
          tableNumber: table,
          deviceId: guestDeviceId,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok !== true) {
        const message =
          (payload?.error &&
            typeof payload.error === "object" &&
            typeof payload.error.message === "string" &&
            payload.error.message) ||
          "Unable to assign a seat";
        throw new Error(message);
      }

      const data = payload.data as GuestSeatState & { tableNumber?: string };
      applyGuestSeat(table, {
        sessionId: data.sessionId,
        seatId: data.seatId,
        seatNumber: data.seatNumber,
        guestName: data.guestName ?? null,
      });
    } catch (claimError) {
      setGuestSeat(null);
      setGuestSeatError(
        claimError instanceof Error ? claimError.message : "Unable to assign a seat",
      );
    } finally {
      setGuestSeatLoading(false);
    }
  }, [applyGuestSeat, guestDeviceId, orderType, storeSlug, tableNumber, view?.orderModes]);

  useEffect(() => {
    void claimGuestSeat();
  }, [claimGuestSeat]);

  const updateGuestSeatName = useCallback(
    async (name: string | null) => {
      if (!guestSeat || !guestDeviceId) {
        return { ok: false, message: "No seat assigned" };
      }
      try {
        const response = await fetch("/api/public/table-seat", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeSlug,
            seatId: guestSeat.seatId,
            deviceId: guestDeviceId,
            guestName: name,
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || payload?.ok !== true) {
          const message =
            (payload?.error &&
              typeof payload.error === "object" &&
              typeof payload.error.message === "string" &&
              payload.error.message) ||
            "Unable to save name";
          return { ok: false, message };
        }
        const data = payload.data as GuestSeatState;
        const table = tableNumber.trim();
        applyGuestSeat(table, {
          sessionId: data.sessionId,
          seatId: data.seatId,
          seatNumber: data.seatNumber,
          guestName: data.guestName ?? null,
        });
        return { ok: true };
      } catch {
        return { ok: false, message: "Unable to save name" };
      }
    },
    [applyGuestSeat, guestDeviceId, guestSeat, storeSlug, tableNumber],
  );

  const changeGuestSeat = useCallback(
    async (targetSeatNumber?: number) => {
      const table = tableNumber.trim();
      if (!table || !guestDeviceId) {
        return { ok: false, message: "Table number is required" };
      }
      try {
        const response = await fetch("/api/public/table-seat/change", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeSlug,
            tableNumber: table,
            deviceId: guestDeviceId,
            ...(typeof targetSeatNumber === "number" ? { targetSeatNumber } : {}),
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || payload?.ok !== true) {
          const message =
            (payload?.error &&
              typeof payload.error === "object" &&
              typeof payload.error.message === "string" &&
              payload.error.message) ||
            "Unable to change seat";
          return { ok: false, message };
        }
        const data = payload.data as GuestSeatState;
        applyGuestSeat(table, {
          sessionId: data.sessionId,
          seatId: data.seatId,
          seatNumber: data.seatNumber,
          guestName: data.guestName ?? null,
        });
        return { ok: true };
      } catch {
        return { ok: false, message: "Unable to change seat" };
      }
    },
    [applyGuestSeat, guestDeviceId, storeSlug, tableNumber],
  );

  const fetchTableSeats = useCallback(async () => {
    const table = tableNumber.trim();
    if (!table) return [];
    const params = new URLSearchParams({
      storeSlug,
      tableNumber: table,
    });
    const response = await fetch(`/api/public/table-seat?${params.toString()}`, {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok !== true) return [];
    return (payload.data?.seats ?? []) as GuestTableSeatOption[];
  }, [storeSlug, tableNumber]);

  const callTableService = useCallback(
    async (requestType: "waiter" | "bill") => {
      if (!tableNumber.trim()) {
        return { ok: false, message: "Table number is required" };
      }
      try {
        const response = await fetch("/api/public/table-service", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeSlug,
            tableNumber: tableNumber.trim(),
            requestType,
          }),
        });
        const payload = await response.json().catch(() => null);
        if (response.ok) {
          const message =
            (payload as { data?: { message?: string } } | null)?.data?.message ??
            "Request sent";
          return { ok: true, message };
        }
        const message =
          (payload as { error?: { message?: string }; message?: string } | null)?.error
            ?.message ??
          (payload as { message?: string } | null)?.message ??
          "Failed to send request";
        return { ok: false, message };
      } catch {
        return { ok: false, message: "Failed to send request" };
      }
    },
    [storeSlug, tableNumber],
  );

  const unavailableReason =
    view?.availability.status === "unavailable"
      ? view.availability.reason === "online_orders_disabled"
        ? "Online ordering is currently disabled for this store."
        : "This store is not accepting orders right now."
      : null;

  const value: PublicMenuContextValue = {
    storeSlug,
    locationId: view?.locationId ?? "",
    loading,
    error,
    unavailableReason,
    restaurant: view?.restaurant ?? null,
    categories: view?.categories ?? [],
    items: view?.items ?? [],
    customizationGroups: view?.customizationGroups ?? [],
    orderModes: view?.orderModes ?? {},
    taxRate: view?.taxRate ?? 21,
    cart,
    orderType,
    tableNumber,
    setOrderType,
    setTableNumber,
    addToCart,
    addRewardToCart,
    removeFromCart,
    updateCartItem,
    clearCart,
    getCustomizationGroupsForItem,
    checkoutPath: `/menu/${storeSlug}/checkout${guestQuery}`,
    menuPath: `/menu/${storeSlug}${guestQuery}`,
    orderConfirmationPath: `/menu/${storeSlug}/order-confirmation${guestQuery}`,
    rewardsPath: `/menu/${storeSlug}/rewards${guestQuery}`,
    ordersPath: `/menu/${storeSlug}/orders${guestQuery}`,
    accountPath: `/menu/${storeSlug}/account${guestQuery}`,
    callTableService,
    refetch: fetchMenu,
    guestOrderPlacement,
    placeGuestOrder,
    syncGuestOrderPlacement,
    guestSeat,
    guestSeatLoading,
    guestSeatError,
    guestDeviceId,
    claimGuestSeat,
    updateGuestSeatName,
    changeGuestSeat,
    fetchTableSeats,
    customer,
    customerLoading,
    loyaltySettings: view?.loyaltySettings ?? null,
    loyaltyPoints: customer?.loyaltyPoints ?? null,
    loyaltyPointsExpiry: customer?.loyaltyPointsExpiry ?? null,
    loyaltyPointLots: customer?.loyaltyPointLots ?? null,
    rewards: view?.rewards ?? [],
    orderHistory,
    orderHistoryLoading,
    refetchOrderHistory,
    refetchCustomer,
    logoutCustomer,
    accountLoginPath,
    accountSignupPath,
  };

  return <PublicMenuContext.Provider value={value}>{children}</PublicMenuContext.Provider>;
}

const DEMO_CART: GuestCartItem[] = [
  { id: "1", name: "Margherita", quantity: 1, price: 12.0 },
  { id: "2", name: "Pepperoni", quantity: 1, price: 14.0 },
];

export function StaticDemoMenuProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<GuestCartItem[]>(DEMO_CART);
  const [orderType, setOrderType] = useState<OrderType>("dine-in");
  const [tableNumber, setTableNumber] = useState("5");

  const addToCart = useCallback((item: GuestMenuItem | GuestCartItem) => {
    const incomingQty =
      "quantity" in item && typeof item.quantity === "number" && item.quantity > 0
        ? Math.floor(item.quantity)
        : 1;
    setCart((prevCart) => {
      const existingItem = prevCart.find((cartItem) => cartItem.id === item.id);
      if (existingItem) {
        const isUpdatingCustomizations =
          "selectedOptions" in item ||
          "sauceQuantities" in item ||
          "specialInstructions" in item;
        if (isUpdatingCustomizations) {
          return prevCart.map((cartItem) =>
            cartItem.id === item.id
              ? ({ ...item, quantity: incomingQty } as GuestCartItem)
              : cartItem,
          );
        }
        return prevCart.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + incomingQty }
            : cartItem,
        );
      }
      return [...prevCart, { ...item, quantity: incomingQty } as GuestCartItem];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((cartItem) => cartItem.id === itemId);
      if (existingItem && existingItem.quantity > 1) {
        return prevCart.map((cartItem) =>
          cartItem.id === itemId
            ? { ...cartItem, quantity: cartItem.quantity - 1 }
            : cartItem,
        );
      }
      return prevCart.filter((cartItem) => cartItem.id !== itemId);
    });
  }, []);

  const updateCartItem = useCallback((item: GuestCartItem) => {
    setCart((prevCart) => prevCart.map((cartItem) => (cartItem.id === item.id ? item : cartItem)));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const addRewardToCart = useCallback((_reward: PublicMenuReward) => {}, []);

  const value: PublicMenuContextValue = {
    storeSlug: "demo",
    locationId: "demo",
    loading: false,
    error: null,
    unavailableReason: null,
    restaurant: demoRestaurant,
    categories: demoCategories,
    items: demoMenuItems,
    customizationGroups: [],
    orderModes: {
      dine_in: { enabled: true },
      pickup: { enabled: true },
      delivery: { enabled: false },
    },
    taxRate: 21,
    cart,
    orderType,
    tableNumber,
    setOrderType,
    setTableNumber,
    addToCart,
    addRewardToCart,
    removeFromCart,
    updateCartItem,
    clearCart,
    getCustomizationGroupsForItem: () => [],
    checkoutPath: "/mobile/checkout",
    menuPath: "/mobile",
    orderConfirmationPath: "/mobile/order-confirmation",
    rewardsPath: "/mobile/rewards",
    ordersPath: "/mobile/orders",
    accountPath: "/mobile/account",
    callTableService: async () => ({ ok: true, message: "Waiter notified ✓" }),
    refetch: async () => {},
    guestOrderPlacement: null,
    placeGuestOrder: () => "demo-placement",
    syncGuestOrderPlacement: () => {},
    guestSeat: { sessionId: "demo", seatId: "demo-seat", seatNumber: 1, guestName: null },
    guestSeatLoading: false,
    guestSeatError: null,
    guestDeviceId: "demo-device",
    claimGuestSeat: async () => {},
    updateGuestSeatName: async () => ({ ok: true }),
    changeGuestSeat: async () => ({ ok: true }),
    fetchTableSeats: async () => [],
    customer: null,
    customerLoading: false,
    loyaltySettings: {
      enabled: true,
      pointsPerDollar: 10,
      redeemPointsPerDollarOff: 10,
      allowOpenWalletRedeem: true,
      pointsExpirationMonths: 6,
    },
    loyaltyPoints: null,
    loyaltyPointsExpiry: null,
    loyaltyPointLots: null,
    rewards: [],
    orderHistory: [],
    orderHistoryLoading: false,
    refetchOrderHistory: async () => {},
    refetchCustomer: async () => {},
    logoutCustomer: async () => {},
    accountLoginPath: "/login",
    accountSignupPath: "/signup",
  };

  return <PublicMenuContext.Provider value={value}>{children}</PublicMenuContext.Provider>;
}

export function usePublicMenu(): PublicMenuContextValue {
  const context = useContext(PublicMenuContext);
  if (!context) {
    throw new Error("usePublicMenu must be used within PublicMenuProvider");
  }
  return context;
}

export function usePublicMenuOptional(): PublicMenuContextValue | null {
  return useContext(PublicMenuContext);
}
