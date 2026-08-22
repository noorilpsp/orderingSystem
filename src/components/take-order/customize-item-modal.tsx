"use client"

import { useMerchantLocalization } from "@/lib/hooks/useMerchantLocalization"
import { useEffect, useMemo, useState } from "react"
import { Minus, Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { dietaryIcons } from "@/lib/take-order-data"
import type { MenuItem, Seat } from "@/lib/take-order-data"
import { PromoPrice } from "@/components/shared/promo-price"
import { lineTotalWithPromo } from "@/lib/promotions/pricing"

interface CustomizeItemModalProps {
  item: MenuItem | null
  seats: Seat[]
  defaultSeat: number
  defaultWave?: number
  waveOptions?: number[]
  initialCustomization?: Partial<
    Pick<ItemCustomization, "quantity" | "options" | "extras" | "notes" | "seat" | "waveNumber">
  > | null
  submitLabel?: string
  open: boolean
  onClose: () => void
  onAddToOrder: (customization: ItemCustomization) => void
}

export interface ItemCustomization {
  menuItemId: string
  name: string
  quantity: number
  options: Record<string, string>
  extras: string[]
  notes: string
  seat: number
  waveNumber: number
  basePrice: number
  totalPrice: number
}

export function CustomizeItemModal({
  item,
  seats,
  defaultSeat,
  defaultWave = 1,
  waveOptions = [1],
  initialCustomization = null,
  submitLabel = "Add to Order",
  open,
  onClose,
  onAddToOrder,
}: CustomizeItemModalProps) {
  const { formatMoney } = useMerchantLocalization()
  const [quantity, setQuantity] = useState(1)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [selectedExtras, setSelectedExtras] = useState<string[]>([])
  const [notes, setNotes] = useState("")
  const [selectedSeat, setSelectedSeat] = useState(defaultSeat)
  const [selectedWave, setSelectedWave] = useState(defaultWave)
  const [validationError, setValidationError] = useState<string | null>(null)

  const resetState = () => {
    setQuantity(Math.max(1, initialCustomization?.quantity ?? 1))
    setSelectedOptions(initialCustomization?.options ? { ...initialCustomization.options } : {})
    setSelectedExtras(initialCustomization?.extras ? [...initialCustomization.extras] : [])
    setNotes(initialCustomization?.notes ?? "")
    setSelectedSeat(initialCustomization?.seat ?? defaultSeat)
    setSelectedWave(initialCustomization?.waveNumber ?? defaultWave)
    setValidationError(null)
  }

  useEffect(() => {
    if (!open || !item) return
    resetState()
  }, [open, item, defaultSeat, defaultWave, initialCustomization])

  const totalPrice = useMemo(() => {
    if (!item) return 0

    let price = item.price
    let addOns = 0

    for (const option of item.options || []) {
      const selected = selectedOptions[option.name]
      if (selected) {
        const choice = option.choices.find((c) =>
          typeof c === "string" ? c === selected : c.name === selected
        )
        if (choice && typeof choice !== "string") {
          addOns += choice.price
        }
      }
    }

    for (const extraName of selectedExtras) {
      const extra = item.extras?.find((e) => e.name === extraName)
      if (extra) {
        addOns += extra.price
      }
    }

    return lineTotalWithPromo({
      kind: item.promoKind,
      unitBasePrice: price,
      addOnsTotalPerUnit: addOns,
      quantity,
    })
  }, [item, selectedOptions, selectedExtras, quantity])

  const validateAndAdd = () => {
    if (!item) return

    for (const option of item.options || []) {
      if (option.required && !selectedOptions[option.name]) {
        setValidationError(`Please select ${option.name}`)
        return
      }
    }

    const customization: ItemCustomization = {
      menuItemId: item.id,
      name: item.name,
      quantity,
      options: selectedOptions,
      extras: selectedExtras,
      notes,
      seat: selectedSeat,
      waveNumber: selectedWave,
      basePrice: item.price,
      totalPrice: totalPrice / quantity,
    }

    onAddToOrder(customization)
    resetState()
    onClose()
  }

  if (!item) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          resetState()
          onClose()
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-2xl">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{item.category === "drinks" ? "🍹" : "🍽️"}</span>
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold">{item.name}</h2>
                <p className="text-sm font-normal text-muted-foreground">
                  <PromoPrice
                    price={item.price}
                    compareAtPrice={item.compareAtPrice}
                    promoKind={item.promoKind}
                    formatMoney={formatMoney}
                    bogoLabel="BOGO"
                  />
                </p>
                {item.description && (
                  <p className="mt-1 text-sm font-normal text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Customize {item.name} by selecting options, extras, and adding special instructions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6 py-4">
          {item.options && item.options.length > 0 && (
            <>
              {item.options.map((option) => (
                <div key={option.name}>
                  <Label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {option.name} {option.required && <span className="text-destructive">*</span>}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {option.choices.map((choice) => {
                      const choiceName = typeof choice === "string" ? choice : choice.name
                      const choicePrice = typeof choice === "string" ? 0 : choice.price
                      const isSelected = selectedOptions[option.name] === choiceName

                      return (
                        <button
                          key={choiceName}
                          type="button"
                          onClick={() => {
                            setSelectedOptions((prev) => ({
                              ...prev,
                              [option.name]: choiceName,
                            }))
                            setValidationError(null)
                          }}
                          className={cn(
                            "rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          {choiceName}
                          {choicePrice > 0 && ` (+${formatMoney(choicePrice)})`}
                        </button>
                      )
                    })}
                  </div>
                  {validationError && validationError.includes(option.name) && (
                    <p className="mt-2 text-sm text-destructive">{validationError}</p>
                  )}
                </div>
              ))}
            </>
          )}

          {item.extras && item.extras.length > 0 && (
            <div>
              <Label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Extras
              </Label>
              <div className="space-y-2">
                {item.extras.map((extra) => (
                  <div key={extra.name} className="flex items-center space-x-2">
                    <Checkbox
                      id={`extra-${extra.name}`}
                      checked={selectedExtras.includes(extra.name)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedExtras((prev) => [...prev, extra.name])
                        } else {
                          setSelectedExtras((prev) => prev.filter((e) => e !== extra.name))
                        }
                      }}
                    />
                    <Label
                      htmlFor={`extra-${extra.name}`}
                      className="flex flex-1 cursor-pointer items-center justify-between text-sm font-normal"
                    >
                      <span>{extra.name}</span>
                      <span className="text-muted-foreground">
                        +{formatMoney(extra.price)}
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label
              htmlFor="notes"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Special Instructions
            </Label>
            <Textarea
              id="notes"
              placeholder="Any special requests..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <div>
            <Label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quantity
            </Label>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-lg font-semibold">{quantity}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              For Seat
            </Label>
            <div className="flex flex-wrap gap-2">
              {seats.map((seat) => {
                const isSelected = seat.number === selectedSeat

                return (
                  <button
                    key={seat.number}
                    type="button"
                    onClick={() => setSelectedSeat(seat.number)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <span>Seat {seat.number}</span>
                    {seat.dietary.map((d) => (
                      <span key={d} className="text-base leading-none">
                        {dietaryIcons[d]?.icon}
                      </span>
                    ))}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <Label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              For Wave
            </Label>
            <div className="flex flex-wrap gap-2">
              {waveOptions.map((waveNumber) => {
                const isSelected = waveNumber === selectedWave
                return (
                  <button
                    key={waveNumber}
                    type="button"
                    onClick={() => setSelectedWave(waveNumber)}
                    className={cn(
                      "rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors",
                      isSelected
                        ? "border-amber-400 bg-amber-500/15 text-amber-200"
                        : "border-border hover:border-amber-400/50"
                    )}
                  >
                    W{waveNumber}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-border bg-card px-6 py-4">
          <div className="text-lg font-semibold">
            Total: {formatMoney(totalPrice)}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                resetState()
                onClose()
              }}
            >
              Cancel
            </Button>
            <Button onClick={validateAndAdd} size="lg">
              {submitLabel} - {formatMoney(totalPrice)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
