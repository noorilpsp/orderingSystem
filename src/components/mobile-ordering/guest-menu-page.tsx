"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HeroSection } from "@/components/mobile-ordering/menu/hero-section";
import { CategoryTabs } from "@/components/mobile-ordering/menu/category-tabs";
import { MenuItemCard } from "@/components/mobile-ordering/menu/menu-item-card";
import { InfoSheet } from "@/components/mobile-ordering/menu/info-sheet";
import { ItemDetailModal } from "@/components/mobile-ordering/menu/item-detail-modal";
import { FeaturedSection } from "@/components/mobile-ordering/menu/featured-section";
import { CartBar } from "@/components/mobile-ordering/menu/cart-bar";
import { ContextPill } from "@/components/mobile-ordering/menu/context-pill";
import { GuestSeatBanner } from "@/components/mobile-ordering/guest-seat-banner";
import { GuestWelcomeSheet } from "@/components/mobile-ordering/guest-welcome-sheet";
import type { ThemePreview } from "@/components/mobile-ordering/menu/context-pill";
import { SmartBottomBar } from "@/components/mobile-ordering/menu/smart-bottom-bar";
import { CheckCircle2, Bell, Loader2 } from "lucide-react";
import { usePublicMenu } from "@/lib/contexts/PublicMenuContext";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { GuestCartItem, GuestMenuItem } from "@/lib/guest-menu/types";
import { sumGuestCartItems } from "@/lib/public-menu/guest-cart-pricing";
import { itemNeedsCustomizationBeforeQuickAdd } from "@/lib/public-menu/item-needs-customization";
import {
  buildGuestActiveOrderConfirmationPath,
  clearGuestActiveOrder,
  readGuestActiveOrder,
  recoverGuestActiveOrderFromSession,
  type GuestActiveOrder,
} from "@/lib/public-menu/guest-active-order-storage";
import {
  hasSeenGuestWelcome,
  markGuestWelcomeSeen,
} from "@/lib/public-menu/guest-welcome-storage";
import type { GuestOrderTrackStatus } from "@/lib/public-menu/deriveGuestOrderTrackStatus";
import { useGuestT, useGuestLocale } from "@/lib/guest-i18n";
import { resolveCatalogText, resolveTagLabel } from "@/lib/catalog-i18n";

type ToastType = "success" | "warning";

interface ToastState {
  id: number;
  message: string;
  type: ToastType;
}

export function GuestMenuPage() {
  const t = useGuestT();
  const { locale } = useGuestLocale();
  const {
    loading,
    error,
    unavailableReason,
    categories,
    items,
    cart,
    orderType,
    tableNumber,
    setOrderType,
    setTableNumber,
    addToCart,
    removeFromCart,
    checkoutPath,
    orderModes,
    callTableService,
    storeSlug,
    restaurant,
    customizationGroups,
    customer,
    customerLoading,
    accountLoginPath,
    accountSignupPath,
    getCustomizationGroupsForItem,
  } = usePublicMenu();

  const [checkRequested, setCheckRequested] = useState(false);
  const [waiterLastCalled, setWaiterLastCalled] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isTabsSticky, setIsTabsSticky] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GuestCartItem | GuestMenuItem | null>(null);
  const [cartOpenSignal, setCartOpenSignal] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuTheme, setMenuTheme] = useState<ThemePreview>("classic");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [tick, setTick] = useState(0);
  const [activeOrder, setActiveOrder] = useState<GuestActiveOrder | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const isTabletUp = useMediaQuery("(min-width: 768px)");
  const cardVariant = isTabletUp ? "tile" : "row";

  const tabsSentinelRef = useRef<HTMLDivElement>(null);
  const stickyTabsRef = useRef<HTMLDivElement>(null);
  const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressScrollSpyUntilRef = useRef(0);
  const programmaticScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setActiveOrder(
      readGuestActiveOrder(storeSlug) ?? recoverGuestActiveOrderFromSession(storeSlug),
    );
  }, [storeSlug]);

  useEffect(() => {
    if (customerLoading) return;
    if (customer) {
      setWelcomeOpen(false);
      return;
    }
    setWelcomeOpen(!hasSeenGuestWelcome(storeSlug));
  }, [customer, customerLoading, storeSlug]);

  const handleContinueAsGuest = useCallback(() => {
    markGuestWelcomeSeen(storeSlug);
    setWelcomeOpen(false);
  }, [storeSlug]);

  useEffect(() => {
    if (!activeOrder?.orderId || !storeSlug) return;

    let cancelled = false;
    const refresh = async () => {
      try {
        const params = new URLSearchParams({
          storeSlug,
          eta: String(activeOrder.etaMinutes),
        });
        const response = await fetch(
          `/api/public/orders/${encodeURIComponent(activeOrder.orderId)}/status?${params.toString()}`,
          { cache: "no-store" },
        );
        const payload = await response.json().catch(() => ({}));
        if (cancelled || !response.ok || payload?.ok !== true) return;
        const trackStatus = payload?.data?.trackStatus as GuestOrderTrackStatus | undefined;
        if (trackStatus === "served" || trackStatus === "cancelled" || trackStatus === "refunded") {
          clearGuestActiveOrder(storeSlug, activeOrder.orderId);
          setActiveOrder(null);
        }
      } catch {
        // keep banner if status check fails
      }
    };

    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeOrder?.etaMinutes, activeOrder?.orderId, storeSlug]);

  const activeOrderPath = activeOrder
    ? buildGuestActiveOrderConfirmationPath(storeSlug, activeOrder)
    : null;

  useEffect(() => {
    const ua = navigator.userAgent;
    const isChrome =
      /Chrome\/\d+/.test(ua) &&
      !/Edg\/|OPR\/|Vivaldi|Brave|YaBrowser|SamsungBrowser/.test(ua);
    document.documentElement.classList.toggle("browser-chrome", isChrome);
    return () => document.documentElement.classList.remove("browser-chrome");
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTick((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("theme") as ThemePreview | null;
    if (saved && ["classic", "night", "vivid"].includes(saved)) {
      setMenuTheme(saved);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "vivid");
    if (menuTheme === "night") root.classList.add("dark");
    else if (menuTheme === "vivid") root.classList.add("vivid");
    localStorage.setItem("theme", menuTheme);
  }, [menuTheme]);

  useEffect(() => {
    if (categories.length > 0 && !categories.some((category) => category.id === activeCategory)) {
      setActiveCategory(categories[0].id);
    }
  }, [activeCategory, categories]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const nextToast: ToastState = { id: Date.now(), message, type };
    setToast(nextToast);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  /** + on cards: open configurator when required options exist; otherwise quick-add. */
  const handleQuickAddToCart = useCallback(
    (item: GuestMenuItem | GuestCartItem) => {
      const existing = cart.find((entry) => entry.id === item.id);
      // Already in cart — bump quantity with the previous configuration.
      if (existing) {
        addToCart(item);
        return;
      }
      const groups = getCustomizationGroupsForItem(item.id);
      if (itemNeedsCustomizationBeforeQuickAdd(groups)) {
        setSelectedItem(item);
        return;
      }
      addToCart(item);
    },
    [addToCart, cart, getCustomizationGroupsForItem],
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const waiterCooldownSeconds = waiterLastCalled
    ? Math.max(0, 60 - Math.floor((Date.now() - waiterLastCalled) / 1000))
    : 0;

  const handleCallWaiter = useCallback(async () => {
    if (orderType !== "dine-in") {
      showToast("Waiter call is only available for dine-in", "warning");
      return;
    }
    if (!tableNumber.trim()) {
      showToast("Set your table number first", "warning");
      return;
    }
    if (waiterCooldownSeconds > 0) {
      showToast("Already notified — your waiter is on the way", "warning");
      return;
    }

    const result = await callTableService("waiter");
    if (result.ok) {
      setWaiterLastCalled(Date.now());
      showToast(result.message || "Waiter notified ✓", "success");
      return;
    }
    showToast(result.message || "Could not reach your server", "warning");
  }, [callTableService, orderType, showToast, tableNumber, waiterCooldownSeconds]);

  const handleRequestCheck = useCallback(async () => {
    if (orderType !== "dine-in") {
      showToast("Bill request is only available for dine-in", "warning");
      return;
    }
    if (!tableNumber.trim()) {
      showToast("Set your table number first", "warning");
      return;
    }
    if (checkRequested) {
      showToast("Check already requested — your server is on the way", "warning");
      return;
    }

    const result = await callTableService("bill");
    if (result.ok) {
      setCheckRequested(true);
      showToast(result.message || "Bill request sent", "success");
      return;
    }
    showToast(result.message || "Could not request the bill", "warning");
  }, [callTableService, checkRequested, orderType, showToast, tableNumber]);

  useEffect(() => {
    if (isSearchOpen) return;
    const tabBtn = tabsContainerRef.current?.querySelector(
      `[data-category-id="${activeCategory}"]`,
    ) as HTMLElement | null;
    if (!tabBtn) return;
    tabBtn.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeCategory, isSearchOpen, locale]);

  const getStickyTabsHeight = useCallback(() => {
    return stickyTabsRef.current?.offsetHeight ?? 64;
  }, []);

  const handleCategoryClick = useCallback(
    (categoryId: string) => {
      if (isSearchOpen) return;
      const element = categoryRefs.current[categoryId];
      if (!element) return;

      setActiveCategory(categoryId);
      suppressScrollSpyUntilRef.current = Date.now() + 1200;
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current);
      }

      const topOffset = getStickyTabsHeight() + 8;
      const targetY =
        element.getBoundingClientRect().top + window.scrollY - topOffset;
      window.scrollTo({ top: Math.max(targetY, 0), behavior: "smooth" });

      const clearSuppression = () => {
        suppressScrollSpyUntilRef.current = 0;
        if (programmaticScrollTimeoutRef.current) {
          clearTimeout(programmaticScrollTimeoutRef.current);
          programmaticScrollTimeoutRef.current = null;
        }
        window.removeEventListener("scrollend", clearSuppression);
      };
      window.addEventListener("scrollend", clearSuppression);
      programmaticScrollTimeoutRef.current = setTimeout(clearSuppression, 1200);
    },
    [getStickyTabsHeight, isSearchOpen],
  );

  const cartTotal = sumGuestCartItems(cart, customizationGroups);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredMenuItems = useMemo(
    () =>
      items.filter((item) => {
        if (!normalizedQuery) return true;
        const category = categories.find((c) => c.id === item.categoryId);
        const localizedItem = resolveCatalogText(
          locale,
          { name: item.name, description: item.description },
          item.i18n,
        );
        const localizedCategory = category
          ? resolveCatalogText(locale, { name: category.name }, category.i18n).name
          : "";
        const haystack = [
          item.name,
          item.description,
          localizedItem.name,
          localizedItem.description,
          category?.name ?? "",
          localizedCategory,
          item.i18n?.ar?.name ?? "",
          item.i18n?.ar?.description ?? "",
          ...item.tags.map((tag) => tag.name),
          ...item.tags.map((tag) => tag.i18n?.ar?.name ?? ""),
          ...item.tags.map((tag) =>
            resolveTagLabel(locale, tag.name, tag.i18n),
          ),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      }),
    [categories, items, locale, normalizedQuery],
  );

  const visibleCategories = useMemo(
    () =>
      categories.filter((category) =>
        filteredMenuItems.some((item) => item.categoryId === category.id),
      ),
    [categories, filteredMenuItems],
  );

  useEffect(() => {
    if (visibleCategories.length === 0) return;
    if (!visibleCategories.some((category) => category.id === activeCategory)) {
      setActiveCategory(visibleCategories[0].id);
    }
  }, [activeCategory, visibleCategories]);

  const themedToastClass =
    menuTheme === "classic"
      ? "border border-white/24 bg-black/78 text-white ring-1 ring-white/10 shadow-[0_12px_26px_rgba(0,0,0,0.45)]"
      : menuTheme === "night"
        ? "border border-blue-300/30 bg-blue-900/60 text-blue-100"
        : "border border-white/60 bg-white/72 text-black";

  useEffect(() => {
    if (isSearchOpen || visibleCategories.length === 0) return;
    let frameId = 0;

    const updateActiveCategoryFromScroll = () => {
      if (Date.now() < suppressScrollSpyUntilRef.current) return;
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        const stickyBottom =
          stickyTabsRef.current?.getBoundingClientRect().bottom ??
          getStickyTabsHeight();
        const anchorY = stickyBottom + 8;
        let nextActiveId = visibleCategories[0].id;

        for (const category of visibleCategories) {
          const section = categoryRefs.current[category.id];
          if (!section) continue;
          if (section.getBoundingClientRect().top <= anchorY) {
            nextActiveId = category.id;
          }
        }

        setActiveCategory((prev) => (prev === nextActiveId ? prev : nextActiveId));
      });
    };

    updateActiveCategoryFromScroll();
    window.addEventListener("scroll", updateActiveCategoryFromScroll, { passive: true });
    window.addEventListener("resize", updateActiveCategoryFromScroll);
    return () => {
      window.removeEventListener("scroll", updateActiveCategoryFromScroll);
      window.removeEventListener("resize", updateActiveCategoryFromScroll);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [getStickyTabsHeight, isSearchOpen, visibleCategories]);

  useEffect(() => {
    return () => {
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const sentinel = tabsSentinelRef.current;
    if (!sentinel) return;

    const updateStickyState = () => {
      setIsTabsSticky(sentinel.getBoundingClientRect().top <= 0);
    };

    updateStickyState();
    window.addEventListener("scroll", updateStickyState, { passive: true });
    window.addEventListener("resize", updateStickyState);
    return () => {
      window.removeEventListener("scroll", updateStickyState);
      window.removeEventListener("resize", updateStickyState);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold text-foreground">{t("common.unableToLoadMenu")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const dineInEnabled = orderModes.dine_in?.enabled !== false;
  const pickupEnabled = orderModes.pickup?.enabled !== false;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  // Match SmartBottomBar visibility so we don't reserve space for a bar that isn't there.
  const showSmartBottomBar =
    cartCount > 0 || Boolean(activeOrderPath) || orderType === "dine-in";

  return (
    <div
      className="min-h-screen"
      style={{
        paddingTop: "var(--guest-tab-bar-pad-top, 0px)",
        paddingBottom: showSmartBottomBar
          ? "calc(5.5rem + var(--guest-tab-bar-pad-bottom, var(--guest-tab-bar-height, 0rem)))"
          : "calc(1rem + var(--guest-tab-bar-pad-bottom, var(--guest-tab-bar-height, 0rem)))",
      }}
    >
      <HeroSection
        onInfoClick={() => setIsInfoOpen(true)}
        topRightSlot={
          <ContextPill
            compact
            orderType={orderType}
            tableNumber={tableNumber}
            checkRequested={checkRequested}
            theme={menuTheme}
            onThemeChange={setMenuTheme}
            onOrderTypeChange={(next) => {
              if (next === "dine-in" && !dineInEnabled) {
                showToast("Dine-in is not available", "warning");
                return;
              }
              if (next === "pickup" && !pickupEnabled) {
                showToast("Pickup is not available", "warning");
                return;
              }
              setOrderType(next);
              if (next === "pickup") setCheckRequested(false);
            }}
            onTableNumberChange={setTableNumber}
            onToast={showToast}
          />
        }
      />

      {orderType === "dine-in" && tableNumber.trim() ? (
        <div className="mx-auto w-full max-w-none px-4 pt-3 lg:px-8">
          <GuestSeatBanner />
        </div>
      ) : null}

      <div ref={tabsSentinelRef} className="h-px" aria-hidden />

      <div ref={stickyTabsRef} className="sticky top-0 z-(--z-sticky) isolate">
        <div className="pointer-events-auto">
          <CategoryTabs
            categories={visibleCategories}
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryClick}
            isSticky={isTabsSticky}
            tabsContainerRef={tabsContainerRef}
            isSearchOpen={isSearchOpen}
            searchQuery={searchQuery}
            onSearchOpenChange={setIsSearchOpen}
            onSearchQueryChange={setSearchQuery}
          />
        </div>
      </div>

      <div className="px-0 pt-2 lg:px-8 lg:pt-2">
        {!isSearchOpen && items.some((entry) => entry.featured) ? (
          <FeaturedSection
            items={items.filter((entry) => entry.featured)}
            cartItems={cart}
            onAddToCart={handleQuickAddToCart}
            onRemoveFromCart={removeFromCart}
            onItemClick={setSelectedItem}
          />
        ) : null}

        <div className="mx-4 h-px bg-border/70 lg:mx-0" />

        {unavailableReason ? (
          <div className="mx-4 mt-4 rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100 lg:mx-0">
            <p className="font-semibold">Ordering unavailable</p>
            <p className="mt-1 opacity-90">{unavailableReason}</p>
            <p className="mt-1 text-xs opacity-80">You can still browse the menu below.</p>
          </div>
        ) : null}

        {!unavailableReason && items.length === 0 ? (
          <div className="mx-4 mt-4 rounded-2xl border border-border/70 bg-card/70 px-4 py-6 text-center lg:mx-0">
            <p className="text-base font-semibold text-foreground">No menu items yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add live items in Dashboard → Menu → Items and assign them to a category.
            </p>
          </div>
        ) : null}

        <div>
          {visibleCategories.map((category, categoryIndex) => {
            const categoryItems = filteredMenuItems.filter(
              (item) => item.categoryId === category.id,
            );
            if (categoryItems.length === 0) return null;

            return (
              <div key={category.id}>
                <div
                  ref={(el) => {
                    if (!isSearchOpen) categoryRefs.current[category.id] = el;
                  }}
                  data-category-id={category.id}
                  className={`mb-2 px-4 py-4 lg:px-0 ${isSearchOpen ? "" : "scroll-mt-20"}`}
                >
                  <h2 className="mb-4 text-lg font-bold text-foreground">
                    {category.emoji ? `${category.emoji} ` : null}
                    {
                      resolveCatalogText(
                        locale,
                        { name: category.name },
                        category.i18n,
                      ).name
                    }
                  </h2>

                  <div
                    className={
                      isTabletUp
                        ? "grid grid-cols-2 gap-6 lg:grid-cols-3 lg:gap-8 xl:grid-cols-4"
                        : "space-y-0"
                    }
                  >
                    {categoryItems.map((item, index) => {
                      const cartItem = cart.find((c) => c.id === item.id);
                      return (
                        <div key={item.id}>
                          <MenuItemCard
                            item={item}
                            variant={cardVariant}
                            onAddToCart={handleQuickAddToCart}
                            onRemoveFromCart={removeFromCart}
                            onItemClick={setSelectedItem}
                            quantity={cartItem?.quantity || 0}
                          />
                          {!isTabletUp && index < categoryItems.length - 1 ? (
                            <div className="my-3 h-px bg-border" />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {categoryIndex < visibleCategories.length - 1 && (
                  <div className="mx-4 h-px bg-border/70 lg:mx-0" />
                )}
              </div>
            );
          })}

          {isSearchOpen && filteredMenuItems.length === 0 && (
            <div className="px-4 py-12 text-center lg:px-0">
              <p className="text-base font-semibold text-foreground">No matching items</p>
              <p className="mt-1 text-sm text-muted-foreground">Try another keyword.</p>
            </div>
          )}
        </div>
      </div>

      <GuestWelcomeSheet
        open={welcomeOpen}
        restaurantName={restaurant?.name ?? "this restaurant"}
        loginPath={accountLoginPath}
        signupPath={accountSignupPath}
        onContinueAsGuest={handleContinueAsGuest}
      />

      <InfoSheet open={isInfoOpen} onOpenChange={setIsInfoOpen} />

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          open={!!selectedItem}
          onOpenChange={(open) => {
            if (!open) setSelectedItem(null);
          }}
          onAddToCart={addToCart}
        />
      )}

      <SmartBottomBar
        orderType={orderType}
        cartCount={cartCount}
        total={cartTotal}
        waiterCooldownSeconds={waiterCooldownSeconds}
        checkRequested={checkRequested}
        onCallWaiter={handleCallWaiter}
        onRequestCheck={handleRequestCheck}
        onViewCart={() => setCartOpenSignal((prev) => prev + 1)}
        onToast={showToast}
        activeOrderPath={activeOrderPath}
        activeOrderNumber={activeOrder?.orderNumber ?? null}
      />

      <CartBar
        items={cart}
        total={cartTotal}
        menuItems={items}
        onAddToCart={addToCart}
        onRemoveFromCart={removeFromCart}
        onItemClick={(cartItem) => setSelectedItem(cartItem)}
        hideTrigger
        externalOpenSignal={cartOpenSignal}
        checkoutPath={checkoutPath}
      />

      {toast && (
        <div
          className="pointer-events-none fixed left-1/2 z-(--z-toast) w-full max-w-[320px] -translate-x-1/2 px-3"
          style={{
            bottom:
              "calc(4.5rem + var(--guest-tab-bar-pad-bottom, var(--guest-tab-bar-height, 0rem)))",
          }}
        >
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className={`sheen-overlay relative animate-in slide-in-from-bottom-4 fade-in-0 rounded-xl px-4 py-3 text-sm font-medium shadow-xl duration-200 ${themedToastClass} backdrop-blur`}
          >
            <div className="flex items-center gap-2">
              {toast.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              <span>{toast.message}</span>
            </div>
          </div>
        </div>
      )}

      <span className="sr-only">Tick: {tick}</span>
    </div>
  );
}
