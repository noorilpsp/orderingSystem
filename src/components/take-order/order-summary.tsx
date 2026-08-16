'use client';

import { useMerchantLocalization } from "@/lib/hooks/useMerchantLocalization"
import { useEffect, useMemo, useState } from "react"
import { Edit, Minus, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { getSeatItems, dietaryIcons } from "@/lib/take-order-data"
import type { OrderItem, Seat } from "@/lib/take-order-data"

interface OrderSummaryProps {
  items: OrderItem[]
  seats: Seat[]
  total: number
  enableWaveView?: boolean
  summaryScope?: "seat" | "all"
  canSeatScope?: boolean
  onSummaryScopeChange?: (scope: "seat" | "all") => void
  onQuantityChange: (itemId: string, delta: number) => void
  onEditItem: (itemId: string) => void
  onRemoveItem: (itemId: string) => void
}

export function OrderSummary({
  items,
  seats,
  total,
  enableWaveView = false,
  summaryScope = "all",
  canSeatScope = true,
  onSummaryScopeChange,
  onQuantityChange,
  onEditItem,
  onRemoveItem,
}: OrderSummaryProps) {
  const { formatMoney } = useMerchantLocalization()
  const [waveFilter, setWaveFilter] = useState<string>("all")
  const waveOptions = useMemo(() => {
    const labels = Array.from(
      new Set(
        items
          .map((item) => extractWaveLabel(item))
          .filter((label): label is string => !!label)
      )
    )
    return labels.sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  }, [items])

  useEffect(() => {
    if (!waveOptions.includes(waveFilter) && waveFilter !== "all") {
      setWaveFilter("all")
    }
  }, [waveFilter, waveOptions])

  const filteredItems = useMemo(() => {
    if (!enableWaveView || waveFilter === "all") return items
    return items.filter((item) => extractWaveLabel(item) === waveFilter)
  }, [enableWaveView, items, waveFilter])

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Current Order
          </h2>
          {onSummaryScopeChange && (
            <div className="inline-flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
              <button
                type="button"
                onClick={() => onSummaryScopeChange("seat")}
                disabled={!canSeatScope}
                className={cn(
                  "h-6 rounded px-2 text-[11px] font-medium transition-colors",
                  summaryScope === "seat" && canSeatScope
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent"
                )}
              >
                Seat only
              </button>
              <button
                type="button"
                onClick={() => onSummaryScopeChange("all")}
                className={cn(
                  "h-6 rounded px-2 text-[11px] font-medium transition-colors",
                  summaryScope === "all"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                All seats
              </button>
            </div>
          )}
        </div>
        {enableWaveView && waveOptions.length > 0 && (
          <div className="mt-2 flex gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setWaveFilter("all")}
              className={cn(
                "h-6 shrink-0 rounded-md border px-2 text-[11px] font-medium transition-colors",
                waveFilter === "all"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent"
              )}
            >
              All
            </button>
            {waveOptions.map((waveLabel) => (
              <button
                key={waveLabel}
                type="button"
                onClick={() => setWaveFilter(waveLabel)}
                className={cn(
                  "h-6 shrink-0 rounded-md border px-2 text-[11px] font-medium transition-colors",
                  waveFilter === waveLabel
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-accent"
                )}
              >
                {waveLabel}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {filteredItems.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-sm text-muted-foreground">
              {enableWaveView && waveFilter !== "all" ? "No items in this wave" : "No items yet"}
              <br />
              <span className="text-xs">Tap items to add to order</span>
            </p>
          </div>
        ) : (
	          <>
	            {seats.map((seat) => {
	              const seatItems = getSeatItems(filteredItems, seat.number)
	              const sortedSeatItems = [...seatItems].sort((a, b) => {
	                const waveA = getWaveSortNumber(a)
	                const waveB = getWaveSortNumber(b)
	                if (waveA !== waveB) return waveA - waveB
	                return a.name.localeCompare(b.name)
	              })
	              if (sortedSeatItems.length === 0) return null
	
	              const seatTotal = sortedSeatItems.reduce(
	                (sum, item) => sum + item.price * item.quantity,
	                0
	              )

              return (
                <div key={seat.number}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold">
                        {seat.number === 0 ? "Table" : `Seat ${seat.number}`}
                      </span>
                      {seat.dietary.map((d) => (
                        <span key={d} className="text-base leading-none">
                          {dietaryIcons[d]?.icon}
                        </span>
                      ))}
                    </div>
                    <span className="text-sm font-semibold">{formatMoney(seatTotal)}</span>
	                  </div>
	
	                  <div className="space-y-2">
	                    {sortedSeatItems.map((item) => (
	                      <OrderItemCard
	                        key={item.id}
	                        item={item}
                        waveLabel={extractWaveLabel(item)}
                        onQuantityChange={onQuantityChange}
                        onEdit={onEditItem}
                        onRemove={onRemoveItem}
                      />
                    ))}
                  </div>

                  <Separator className="my-4" />
                </div>
              )
            })}
          </>
        )}
      </div>

      {filteredItems.length > 0 && (
        <>
          <Separator />
          <div className="order-summary-total px-3 py-1.5">
            <div>
              <div className="flex justify-between">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-sm font-semibold">{formatMoney(total)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

interface OrderItemCardProps {
  item: OrderItem
  waveLabel: string | null
  onQuantityChange: (itemId: string, delta: number) => void
  onEdit: (itemId: string) => void
  onRemove: (itemId: string) => void
}

function OrderItemCard({
  item,
  waveLabel,
  onQuantityChange,
  onEdit,
  onRemove,
}: OrderItemCardProps) {
  const visibleNotes = stripWaveFromNotes(item.notes)
  const hasCustomizations =
    Object.keys(item.options).length > 0 || item.extras.length > 0 || !!visibleNotes

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold leading-tight">{item.name}</h4>
            {waveLabel && (
              <span className="inline-flex h-5 items-center rounded border border-amber-400/40 bg-amber-500/10 px-1.5 text-[10px] font-semibold text-amber-200">
                {waveLabel}
              </span>
            )}
          </div>
          {hasCustomizations && (
            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {Object.entries(item.options).map(([key, value]) => (
                <div
                  key={key}
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
              ))}
              {item.extras.map((extra) => (
                <div key={extra} className="font-medium text-emerald-500">
                  + {extra}
                </div>
              ))}
              {visibleNotes && (
                <div className="italic text-amber-300">"{visibleNotes}"</div>
              )}
            </div>
          )}
        </div>
        <span className="shrink-0 text-sm font-bold">
          {formatMoney(item.price * item.quantity)}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 bg-transparent"
            onClick={() => onQuantityChange(item.id, -1)}
            disabled={item.quantity <= 1}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 bg-transparent"
            onClick={() => onQuantityChange(item.id, 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(item.id)}
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onRemove(item.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function extractWaveLabel(item: OrderItem): string | null {
  const match = item.notes?.match(/\bWave\s+(\d+)\b/i)
  if (!match) return null
  return `W${match[1]}`
}

function getWaveSortNumber(item: OrderItem): number {
  const waveLabel = extractWaveLabel(item)
  if (!waveLabel) return Number.POSITIVE_INFINITY
  const parsed = Number(waveLabel.slice(1))
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY
  return parsed
}

function stripWaveFromNotes(notes: string | undefined): string {
  if (!notes) return ""
  return notes
    .replace(/\bWave\s+\d+\b/gi, "")
    .replace(/[·|,-]\s*$/g, "")
    .replace(/^\s*[·|,-]\s*/g, "")
    .trim()
}
