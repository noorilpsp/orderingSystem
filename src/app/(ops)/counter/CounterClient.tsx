"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Edit, Flame, Minus, Plus, RefreshCw, Sparkles, Trash2, Zap } from "lucide-react"

import { CategoryNav } from "@/components/take-order/category-nav"
import { PaymentModal } from "@/components/table-detail/payment-modal"
import { CustomizeItemModal } from "@/components/take-order/customize-item-modal"
import { MenuItemCard } from "@/components/take-order/menu-item-card"
import { MenuSearch } from "@/components/take-order/menu-search"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { OrderItem as TableOrderItem } from "@/lib/table-data"
import { cn } from "@/lib/utils"
import { useMerchantLocalization } from "@/lib/hooks/useMerchantLocalization"
import {
  createTrackingToken,
  upsertTrackingSnapshot,
  type TrackingStatus,
} from "@/lib/order-tracking"
import type { MenuItem, Seat } from "@/lib/take-order-data"
import type { ItemCustomization } from "@/components/take-order/customize-item-modal"
import { useCounterMenu } from "@/lib/counter/useCounterMenu"
import type { CounterView } from "@/lib/counter/counterView"
import { submitCounterOrder } from "@/lib/counter/submitCounterOrder"
import { useCounterRecentOrders } from "@/lib/counter/useCounterRecentOrders"
import { uniqueById } from "@/lib/promotions/promotions-category"

type ServiceType = "pickup" | "dine_in_no_table"
type PaymentMethod = "card" | "cash" | "other"
type TicketStatus =
  | "draft"
  | "sent"
  | "preparing"
  | "ready"
  | "picked_up"
  | "closed"
  | "voided"
  | "refunded"
type LineStatus = "active" | "voided"

type DraftLine = {
  id: string
  menuItemId: string
  name: string
  qty: number
  unitPrice: number
  category: string
  options: Record<string, string>
  extras: string[]
  note: string
}

type TicketLine = DraftLine & {
  status: LineStatus
}

type CounterTicket = {
  id: string
  code: string
  serviceType: ServiceType
  customerName: string
  customerPhone: string
  orderNote: string
  createdAt: number
  sentAt: number
  items: TicketLine[]
  paymentMethod: PaymentMethod
  paidTotal: number
  cashReceived: number
  cashChange: number
  status: TicketStatus
  trackingToken: string
  /** Real backend order ID (Phase 3) */
  orderId?: string
  orderNumber?: string
}

type SystemFlash = {
  id: number
  text: string
  tone: "info" | "success" | "warning"
}

const TAX_RATE = 0.1

function hasCustomization(item: MenuItem): boolean {
  return (item.options?.length ?? 0) > 0 || (item.extras?.length ?? 0) > 0
}

function ticketFinancials(
  items: Array<{ qty: number; unitPrice: number; status: LineStatus }>,
  serviceType: ServiceType
) {
  const subtotal = items
    .filter((line) => line.status === "active")
    .reduce((sum, line) => sum + line.qty * line.unitPrice, 0)
  const tax = subtotal * TAX_RATE
  const packing = serviceType === "pickup" && subtotal > 0 ? 1.5 : 0
  const total = subtotal + tax + packing
  return { subtotal, tax, packing, total }
}

function toTrackingStatus(status: TicketStatus): TrackingStatus {
  if (status === "draft") return "sent"
  return status
}

type CounterClientProps = {
  initialCounterView: CounterView | null
}

export function CounterClient({ initialCounterView }: CounterClientProps) {
  const { formatMoney } = useMerchantLocalization()
  const { menuItems, categories, customizations, loading: menuLoading, error: menuError, hasLocation, locationId, refetch } = useCounterMenu({
    initialCounterView,
  })
  const { orders: recentOrders, loading: recentLoading, error: recentError, refresh: refreshRecentOrders } = useCounterRecentOrders(locationId)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")

  const [serviceType, setServiceType] = useState<ServiceType>("pickup")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [orderNote, setOrderNote] = useState("")
  const [draftLines, setDraftLines] = useState<DraftLine[]>([])
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentTrackingToken, setPaymentTrackingToken] = useState<string | null>(null)
  const [origin, setOrigin] = useState("")

  const [tickets, setTickets] = useState<CounterTicket[]>([])
  const [nextTicketNumber, setNextTicketNumber] = useState(1001)
  const [systemFlash, setSystemFlash] = useState<SystemFlash | null>(null)

  const [customItem, setCustomItem] = useState<MenuItem | null>(null)
  const [customizeDefaults, setCustomizeDefaults] = useState<{ seat: number; wave: number } | null>(null)
  const [customizeInitial, setCustomizeInitial] = useState<{
    quantity: number
    options: Record<string, string>
    extras: string[]
    notes: string
  } | null>(null)
  const [editingDraftLineId, setEditingDraftLineId] = useState<string | null>(null)
  const [confirmNewDraftOpen, setConfirmNewDraftOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [addContextPulse, setAddContextPulse] = useState<{ id: number; text: string } | null>(null)
  const addPulseSeqRef = useRef(0)
  const addPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const counterModalSeats = useMemo<Seat[]>(
    () => [{ number: 1, dietary: [], items: 0, total: 0 }],
    []
  )

  useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.id === selectedCategory)) {
      setSelectedCategory(categories[0].id)
    }
  }, [categories, selectedCategory])

  const visibleMenu = useMemo(() => {
    let items = menuItems
    if (selectedCategory && !searchQuery.trim()) {
      items = items.filter((item) => item.category === selectedCategory)
      return items
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.description ?? "").toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      )
    }
    return uniqueById(items)
  }, [menuItems, searchQuery, selectedCategory])
  const matchedCategoryIds = useMemo(
    () => Array.from(new Set(visibleMenu.map((item) => item.category))),
    [visibleMenu]
  )

  const draftTotals = useMemo(
    () =>
      ticketFinancials(
        draftLines.map((line) => ({
          qty: line.qty,
          unitPrice: line.unitPrice,
          status: "active" as LineStatus,
        })),
        serviceType
      ),
    [draftLines, serviceType]
  )
  const paymentTableItems = useMemo<TableOrderItem[]>(
    () =>
      draftLines.map((line) => ({
        id: line.id,
        name: line.qty > 1 ? `${line.name} x${line.qty}` : line.name,
        mods: [
          ...Object.entries(line.options).map(([option, value]) => `${option}: ${value}`),
          ...(line.extras.length ? [`Extras: ${line.extras.join(", ")}`] : []),
          ...(line.note ? [`Note: ${line.note}`] : []),
        ],
        price: line.qty * line.unitPrice,
        status: "sent",
        wave:
          line.category === "drinks"
            ? "drinks"
            : line.category === "desserts"
              ? "dessert"
              : "food",
        waveNumber:
          line.category === "drinks"
            ? 1
            : line.category === "desserts"
              ? 3
              : 2,
      })),
    [draftLines]
  )

  const canFinalize = draftLines.length > 0
  const pendingTicketCode = useMemo(() => {
    const codePrefix = serviceType === "pickup" ? "PU" : "DI"
    return `${codePrefix}-${nextTicketNumber}`
  }, [nextTicketNumber, serviceType])
  const trackingPath = paymentTrackingToken ? `/track/${paymentTrackingToken}` : ""
  const trackingUrl = trackingPath ? `${origin || ""}${trackingPath}` : ""

  const flash = (text: string, tone: SystemFlash["tone"] = "info") => {
    const id = Date.now()
    setSystemFlash({ id, text, tone })
    setTimeout(() => {
      setSystemFlash((prev) => (prev && prev.id === id ? null : prev))
    }, 2200)
  }

  const triggerAddContextPulse = (itemName: string, qty: number) => {
    const normalizedQty = Math.max(1, Number.isFinite(qty) ? Math.floor(qty) : 1)
    addPulseSeqRef.current += 1
    const id = addPulseSeqRef.current
    setAddContextPulse({ id, text: `+${normalizedQty} ${itemName}` })
    if (addPulseTimeoutRef.current) {
      clearTimeout(addPulseTimeoutRef.current)
    }
    addPulseTimeoutRef.current = setTimeout(() => {
      setAddContextPulse((prev) => (prev && prev.id === id ? null : prev))
    }, 650)
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    return () => {
      if (addPulseTimeoutRef.current) {
        clearTimeout(addPulseTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    for (const ticket of tickets) {
      upsertTrackingSnapshot({
        token: ticket.trackingToken,
        code: ticket.code,
        serviceType: ticket.serviceType,
        status: toTrackingStatus(ticket.status),
        createdAt: ticket.createdAt,
        updatedAt: Date.now(),
        customerName: ticket.customerName,
        orderNote: ticket.orderNote,
        items: ticket.items.map((line) => ({
          id: line.id,
          name: line.name,
          qty: line.qty,
          status: line.status,
        })),
      })
    }
  }, [tickets])

  const resetDraft = () => {
    setServiceType("pickup")
    setCustomerName("")
    setCustomerPhone("")
    setOrderNote("")
    setDraftLines([])
    setPaymentModalOpen(false)
    setPaymentTrackingToken(null)
  }

  const handleNewDraftRequest = () => {
    if (draftLines.length === 0) {
      resetDraft()
      return
    }
    setConfirmNewDraftOpen(true)
  }

  const openCustomization = (item: MenuItem) => {
    setEditingDraftLineId(null)
    setCustomizeDefaults({ seat: 1, wave: 1 })
    setCustomizeInitial(null)
    setCustomItem(item)
  }

  const openDraftLineEditor = (lineId: string) => {
    const line = draftLines.find((entry) => entry.id === lineId)
    if (!line) return
    const menuItem = menuItems.find((item) => item.id === line.menuItemId)
    if (!menuItem) {
      flash("Item details unavailable for edit", "warning")
      return
    }
    setEditingDraftLineId(line.id)
    setCustomizeDefaults({ seat: 1, wave: 1 })
    setCustomizeInitial({
      quantity: line.qty,
      options: { ...line.options },
      extras: [...line.extras],
      notes: line.note,
    })
    setCustomItem(menuItem)
  }

  const addFast = (item: MenuItem) => {
    const unitPrice = item.price
    setDraftLines((prev) => [
      ...prev,
      {
        id: `dl-${Date.now()}`,
        menuItemId: item.id,
        name: item.name,
        qty: 1,
        unitPrice,
        category: item.category,
        options: {},
        extras: [],
        note: "",
      },
    ])
    triggerAddContextPulse(item.name, 1)
  }

  const handleAddToDraftFromModal = (customization: ItemCustomization) => {
    const menuItem = menuItems.find((item) => item.id === customization.menuItemId)
    const nextLine: DraftLine = {
      id: editingDraftLineId ?? `dl-${Date.now()}`,
      menuItemId: customization.menuItemId,
      name: customization.name,
      qty: customization.quantity,
      unitPrice: customization.totalPrice,
      category: menuItem?.category ?? "mains",
      options: customization.options,
      extras: customization.extras,
      note: customization.notes.trim(),
    }

    if (editingDraftLineId) {
      setDraftLines((prev) =>
        prev.map((line) => (line.id === editingDraftLineId ? nextLine : line))
      )
    } else {
      setDraftLines((prev) => [...prev, nextLine])
      triggerAddContextPulse(customization.name, customization.quantity)
    }

    setEditingDraftLineId(null)
    setCustomItem(null)
    setCustomizeDefaults(null)
    setCustomizeInitial(null)
  }

  const adjustDraftQty = (lineId: string, delta: number) => {
    setDraftLines((prev) =>
      prev.map((line) =>
        line.id === lineId ? { ...line, qty: Math.max(1, line.qty + delta) } : line
      )
    )
  }

  const removeDraftLine = (lineId: string) => {
    setDraftLines((prev) => prev.filter((line) => line.id !== lineId))
  }

  const finalizeAndSend = async (payment?: {
    method: "card" | "cash" | "tap" | "other"
    total: number
  }) => {
    if (!canFinalize || !locationId || submitting) return

    const codePrefix = serviceType === "pickup" ? "PU" : "DI"
    const code = `${codePrefix}-${nextTicketNumber}`
    const normalizedMethod: PaymentMethod =
      payment?.method === "tap" ? "card" : payment?.method ?? "other"
    const paidTotal = payment?.total ?? draftTotals.total

    setSubmitting(true)
    const result = await submitCounterOrder({
      locationId,
      serviceType,
      customerName: customerName.trim() || "Guest",
      customerPhone: customerPhone.trim(),
      orderNote: orderNote.trim(),
      draftLines: draftLines.map((line) => ({
        menuItemId: line.menuItemId,
        name: line.name,
        qty: line.qty,
        unitPrice: line.unitPrice,
        options: line.options,
        extras: line.extras,
        note: line.note,
      })),
      menuItems,
      customizations,
      payment: {
        method: normalizedMethod,
        total: paidTotal,
      },
      idempotencyKey: `counter-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    })
    setSubmitting(false)

    if (!result.ok) {
      flash(result.reason, "warning")
      return
    }

    const now = Date.now()
    const trackingToken = paymentTrackingToken ?? createTrackingToken()
    const ticket: CounterTicket = {
      id: `ct-${now}`,
      code,
      serviceType,
      customerName: customerName.trim() || "Guest",
      customerPhone: customerPhone.trim(),
      orderNote: orderNote.trim(),
      createdAt: now,
      sentAt: now,
      items: draftLines.map((line) => ({ ...line, status: "active" as LineStatus })),
      paymentMethod: normalizedMethod,
      paidTotal,
      cashReceived: 0,
      cashChange: 0,
      status: "sent",
      trackingToken,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
    }

    setTickets((prev) => [ticket, ...prev])
    setNextTicketNumber((prev) => prev + 1)
    flash(`${code} sent to prep`, "success")
    resetDraft()
    void refreshRecentOrders(true)
  }

  const openPayment = () => {
    setPaymentTrackingToken((prev) => prev ?? createTrackingToken())
    setPaymentModalOpen(true)
  }

  const menuState = !hasLocation
    ? "no_location"
    : menuLoading
      ? "loading"
      : menuError
        ? "error"
        : "ready"

  return (
    <div className="h-full overflow-hidden bg-background text-foreground">
      <div className="flex h-full flex-col">
        {systemFlash ? (
          <div
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-xs font-medium",
              systemFlash.tone === "success" &&
                "border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
              systemFlash.tone === "info" && "border-primary/35 bg-primary/10 text-primary",
              systemFlash.tone === "warning" &&
                "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            )}
          >
            {systemFlash.text}
          </div>
        ) : null}

        <div className="min-h-0 flex-1">
          <section className="h-full">
            <div className="flex h-full min-h-0 flex-col overflow-hidden border border-border bg-card">
              <div className="border-b border-border bg-card">
                <div className="flex min-w-0 items-stretch">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 px-2.5 py-2.5">
                    <div className="inline-flex rounded-lg border border-border bg-background p-1">
                      <button
                        type="button"
                        onClick={() => setServiceType("pickup")}
                        className={cn(
                          "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors",
                          serviceType === "pickup"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent"
                        )}
                      >
                        <Zap className="h-3.5 w-3.5" />
                        Pickup
                      </button>
                      <button
                        type="button"
                        onClick={() => setServiceType("dine_in_no_table")}
                        className={cn(
                          "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors",
                          serviceType === "dine_in_no_table"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent"
                        )}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Dine-In
                      </button>
                    </div>
                    <div className="min-w-[200px] flex-1">
                      <MenuSearch
                        value={searchQuery}
                        onChange={setSearchQuery}
                        inputClassName="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="hidden w-[300px] shrink-0 items-center justify-between border-l border-border px-2.5 py-2.5 lg:flex">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Draft Order
                    </h2>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 bg-transparent px-2.5 text-[11px]"
                      onClick={handleNewDraftRequest}
                    >
                      New
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <div className="flex min-h-0 flex-1">
                  {menuState !== "ready" ? (
                    <main className="flex min-w-0 flex-1 flex-col items-center justify-center p-8">
                      {menuState === "loading" && (
                        <p className="text-sm text-muted-foreground">Loading menu…</p>
                      )}
                      {menuState === "no_location" && (
                        <div className="flex flex-col items-center gap-1 text-center">
                          <p className="text-sm font-medium">No location selected</p>
                          <p className="text-xs text-muted-foreground">
                            Select a store in POS or KDS settings.
                          </p>
                        </div>
                      )}
                      {menuState === "error" && (
                        <div className="flex flex-col items-center gap-2 text-center">
                          <p className="text-sm font-medium text-destructive">{menuError}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void refetch()}
                          >
                            Retry
                          </Button>
                        </div>
                      )}
                    </main>
                  ) : (
                    <>
                  <aside className="hidden w-40 shrink-0 border-r border-border bg-card xl:block">
                    <CategoryNav
                      categories={categories}
                      selectedCategory={selectedCategory}
                      selectedCategories={
                        searchQuery.trim() ? matchedCategoryIds : undefined
                      }
                      onSelectCategory={setSelectedCategory}
                      variant="vertical"
                    />
                  </aside>

                  <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
                    {addContextPulse ? (
                      <div
                        key={addContextPulse.id}
                        className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4"
                      >
                        <div className="animate-add-context-burst rounded-2xl border border-sky-300/40 bg-slate-950/55 px-6 py-4 shadow-[0_22px_54px_rgba(2,6,23,0.66)] backdrop-blur-[2px]">
                          <span className="text-3xl font-black tracking-[0.03em] text-sky-100 md:text-4xl">
                            {addContextPulse.text}
                          </span>
                        </div>
                      </div>
                    ) : null}
                    <div className="xl:hidden">
                      <CategoryNav
                        categories={categories}
                        selectedCategory={selectedCategory}
                        selectedCategories={
                          searchQuery.trim() ? matchedCategoryIds : undefined
                        }
                        onSelectCategory={setSelectedCategory}
                        variant="horizontal"
                      />
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-2.5 md:p-3">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                        {visibleMenu.map((item) => (
                          <MenuItemCard
                            key={item.id}
                            item={item}
                            density="compact"
                            categoryLabel={
                              searchQuery.trim()
                                ? categories.find(
                                    (category) => category.id === item.category
                                  )?.name ?? item.category
                                : undefined
                            }
                            onClick={(menuItem) => {
                              if (!menuItem.available) return
                              if (hasCustomization(menuItem)) {
                                openCustomization(menuItem)
                                return
                              }
                              addFast(menuItem)
                            }}
                          />
                        ))}
                      </div>
                      {visibleMenu.length === 0 && (
                        <div className="flex h-40 items-center justify-center">
                          <p className="text-sm text-muted-foreground">
                            No items found
                          </p>
                        </div>
                      )}
                    </div>
                  </main>
                    </>
                  )}
                </div>

                <aside className="w-full shrink-0 border-t border-border bg-card lg:w-[300px] lg:border-l lg:border-t-0">
                  <div className="flex h-full min-h-0 flex-col p-2.5">
                    <div className="mb-2 flex items-center justify-between lg:hidden">
                      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Draft Order
                      </h2>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 bg-transparent px-2.5 text-[11px]"
                        onClick={handleNewDraftRequest}
                      >
                        New
                      </Button>
                    </div>

                    <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
                      {draftLines.map((line) => {
                        const hasCustomizations =
                          Object.keys(line.options).length > 0 ||
                          line.extras.length > 0 ||
                          !!line.note
                        return (
                          <div
                            key={line.id}
                            className="rounded-lg border border-border bg-background p-3"
                          >
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <h4 className="text-sm font-semibold leading-tight">
                                  {line.name}
                                </h4>
                                {hasCustomizations && (
                                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                    {Object.entries(line.options).map(
                                      ([key, value]) => (
                                        <div
                                          key={`${line.id}-${key}`}
                                          className={cn(
                                            value.trim().startsWith("+")
                                              ? "font-medium text-emerald-500"
                                              : value.trim().startsWith("-")
                                                ? "font-medium text-red-500"
                                                : "text-muted-foreground"
                                          )}
                                        >
                                          {value}
                                        </div>
                                      )
                                    )}
                                    {line.extras.map((extra) => (
                                      <div
                                        key={`${line.id}-extra-${extra}`}
                                        className="font-medium text-emerald-500"
                                      >
                                        + {extra}
                                      </div>
                                    ))}
                                    {line.note ? (
                                      <div className="italic text-amber-300">
                                        &quot;{line.note}&quot;
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                              <span className="shrink-0 text-sm font-bold">
                                {formatMoney(line.qty * line.unitPrice)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7 bg-transparent"
                                  onClick={() => adjustDraftQty(line.id, -1)}
                                  disabled={line.qty <= 1}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center text-sm font-medium">
                                  {line.qty}
                                </span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7 bg-transparent"
                                  onClick={() => adjustDraftQty(line.id, 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>

                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openDraftLineEditor(line.id)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => removeDraftLine(line.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      {draftLines.length === 0 && (
                        <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                          No items yet.
                        </div>
                      )}
                    </div>

                    <div className="mt-2 space-y-2 border-t border-border pt-2">
                      <div className="rounded-md border border-border bg-background px-2.5 py-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Subtotal
                          </span>
                          <span>{formatMoney(draftTotals.subtotal)}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Tax + Pack
                          </span>
                          <span>
                            {formatMoney(draftTotals.tax + draftTotals.packing)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5 text-sm font-semibold">
                          <span>Total</span>
                          <span>{formatMoney(draftTotals.total)}</span>
                        </div>
                      </div>

                      <Button
                        className="h-9 w-full gap-2 text-sm"
                        disabled={!canFinalize}
                        onClick={openPayment}
                      >
                        <Flame className="h-4 w-4" />
                        Charge & Send {formatMoney(draftTotals.total)}
                      </Button>

                      <div className="mt-3 border-t border-border pt-2">
                        <div className="mb-1.5 flex items-center justify-between">
                          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Recent
                          </h3>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 -mr-1"
                            onClick={() => void refreshRecentOrders(false)}
                            disabled={recentLoading}
                            title="Refresh"
                          >
                            <RefreshCw className={cn("h-3.5 w-3.5", recentLoading && "animate-spin")} />
                          </Button>
                        </div>
                        <div className="max-h-32 min-h-16 overflow-y-auto rounded border border-border bg-background">
                          {recentError ? (
                            <p className="p-2 text-xs text-destructive">{recentError}</p>
                          ) : recentOrders.length === 0 && !recentLoading ? (
                            <p className="p-2 text-xs text-muted-foreground">No recent orders</p>
                          ) : (
                            <ul className="divide-y divide-border">
                              {recentOrders.slice(0, 8).map((o) => (
                                <li key={o.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                                  <span className="truncate font-medium">{o.orderNumber}</span>
                                  <span className="shrink-0">{formatMoney(o.total)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </section>
        </div>
      </div>

      <PaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        tableNumber={nextTicketNumber}
        contextName={serviceType === "pickup" ? "Pickup Ticket" : "Dine-In Ticket"}
        contextChip={serviceType === "pickup" ? "PU" : "DI"}
        showCustomerFields
        customerName={customerName}
        customerPhone={customerPhone}
        orderNote={orderNote}
        onCustomerNameChange={setCustomerName}
        onCustomerPhoneChange={setCustomerPhone}
        onOrderNoteChange={setOrderNote}
        trackingUrl={trackingUrl}
        trackingCode={pendingTicketCode}
        trackingLabel={
          serviceType === "pickup" ? "Track Pickup" : "Track Dine-In Pickup"
        }
        guestCount={Math.max(1, Math.min(8, draftLines.length || 1))}
        seats={[]}
        tableItems={paymentTableItems}
        onComplete={(summary) => {
          finalizeAndSend({ method: summary.method, total: summary.total })
        }}
      />

      <CustomizeItemModal
        item={customItem}
        seats={counterModalSeats}
        defaultSeat={customizeDefaults?.seat ?? 1}
        defaultWave={customizeDefaults?.wave ?? 1}
        waveOptions={[1]}
        initialCustomization={customizeInitial}
        submitLabel={editingDraftLineId ? "Save Changes" : "Add to Order"}
        open={!!customItem}
        onClose={() => {
          setCustomItem(null)
          setCustomizeDefaults(null)
          setCustomizeInitial(null)
          setEditingDraftLineId(null)
        }}
        onAddToOrder={handleAddToDraftFromModal}
      />

      <AlertDialog open={confirmNewDraftOpen} onOpenChange={setConfirmNewDraftOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start new draft order?</AlertDialogTitle>
            <AlertDialogDescription>
              You have items in the current draft. Starting a new draft will
              clear all unsent items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmNewDraftOpen(false)
                resetDraft()
              }}
            >
              Start New
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
