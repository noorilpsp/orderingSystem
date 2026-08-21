"use client"

import { useMerchantLocalization } from "@/lib/hooks/useMerchantLocalization"
import { useEffect, useMemo, useRef, useState } from "react"

import { AlertTriangle, ArrowLeft, CheckCircle2, Minus, Plus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { PhoneNumberField } from "@/components/shared/phone-number-field"
import { useLocation } from "@/lib/contexts/LocationContext"
import type { OrderItem, Seat } from "@/lib/table-data"

interface PaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableNumber: number
  contextName?: string
  contextChip?: string
  showCustomerFields?: boolean
  customerName?: string
  customerPhone?: string
  orderNote?: string
  onCustomerNameChange?: (value: string) => void
  onCustomerPhoneChange?: (value: string) => void
  onOrderNoteChange?: (value: string) => void
  trackingUrl?: string
  trackingCode?: string
  trackingLabel?: string
  guestCount: number
  seats: Seat[]
  tableItems: OrderItem[]
  /** Result from getSessionOutstandingItems, to show blocking reasons when session cannot be closed */
  outstandingItems?: {
    canClose: boolean
    reason?:
      | "session_not_open"
      | "unfinished_items"
      | "unpaid_balance"
      | "payment_in_progress"
      | "kitchen_mid_fire"
    unfinishedItems?: Array<{ id: string; name: string; status: string }>
    remaining?: number
  } | null
  onComplete?: (summary: {
    mode: "one-bill" | "by-seat" | "equal" | "item"
    method: "card" | "cash" | "tap" | "other"
    subtotal: number
    tip: number
    total: number
    charges: Array<{ label: string; amount: number }>
  }) => void
}

type BillLine = {
  id: string
  seatNumber: number
  name: string
  price: number
}

type Payer = {
  id: string
  label: string
}

type ItemAssignment = Record<string, Record<string, number>>
type PaymentStage = "plan" | "checkout" | "success"
type PaymentMethod = "card" | "cash" | "other"
type PaymentMode = "one-bill" | "by-seat" | "equal" | "item"
type BySeatRow = {
  key: string
  label: string
  chip: string
  amount: number
}
type BySeatRoundConfirmation = {
  amount: number
  chips: string[]
}
type ChargeBlast = {
  id: number
  amount: number
  mode: PaymentMode
}
type PaymentSummary = {
  mode: "one-bill" | "by-seat" | "equal" | "item"
  method: "card" | "cash" | "tap" | "other"
  subtotal: number
  tip: number
  total: number
  charges: Array<{ label: string; amount: number }>
}
type EqualPersonPayment = {
  id: string
  label: string
  subtotal: number
  tipPreset: 0 | 10 | 15 | 20 | "custom"
  customTipInput: string
  method: PaymentMethod
  cashReceivedInput: string
  paid: boolean
  chargedTotal: number | null
}

function buildDefaultPayers(count: number): Payer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    label: `S${i + 1}`,
  }))
}

function ceilTo(value: number, step: number): number {
  return Math.ceil(value / step) * step
}

function buildCashQuickAmounts(total: number): number[] {
  const exact = Math.round(total * 100) / 100
  const candidates = [
    exact,
    ceilTo(exact, 5),
    ceilTo(exact + 5, 10),
    ceilTo(exact + 15, 10),
    ceilTo(exact, 50),
    ceilTo(exact, 100),
  ]

  const seen = new Set<number>()
  const unique: number[] = []
  for (const amount of candidates) {
    const rounded = Math.round(amount * 100) / 100
    if (rounded <= 0) continue
    if (seen.has(rounded)) continue
    seen.add(rounded)
    unique.push(rounded)
  }
  return unique
}

export function PaymentModal({
  open,
  onOpenChange,
  tableNumber,
  contextName,
  contextChip,
  showCustomerFields = false,
  customerName = "",
  customerPhone = "",
  orderNote = "",
  onCustomerNameChange,
  onCustomerPhoneChange,
  onOrderNoteChange,
  trackingUrl,
  trackingCode,
  trackingLabel,
  guestCount,
  seats,
  tableItems,
  outstandingItems = null,
  onComplete,
}: PaymentModalProps) {
  const { formatMoney } = useMerchantLocalization()
  const { getCurrentLocation } = useLocation()
  const storeCountry = getCurrentLocation()?.country
  const contextLabel = contextName ?? `Table ${tableNumber}`
  const contextSharedLabel = `${contextLabel} Shared`
  const contextChipLabel = contextChip ?? `T${tableNumber}`
  const trackingTitle = trackingLabel ?? "Track Order"
  const qrImageSrc = trackingUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data=${encodeURIComponent(trackingUrl)}`
    : null

  const billLines = useMemo<BillLine[]>(
    () => [
      ...seats.flatMap((seat) =>
        seat.items
          .filter((item) => item.status !== "void")
          .map((item) => ({
            id: item.id,
            seatNumber: seat.number,
            name: item.name,
            price: item.price,
          }))
      ),
      ...tableItems
        .filter((item) => item.status !== "void")
        .map((item) => ({
          id: item.id,
          seatNumber: 0,
          name: item.name,
          price: item.price,
        })),
    ],
    [seats, tableItems]
  )

  const subtotal = useMemo(() => billLines.reduce((sum, line) => sum + line.price, 0), [billLines])
  const seatTotals = useMemo(() => {
    const map = new Map<number, number>()
    for (const line of billLines) {
      map.set(line.seatNumber, (map.get(line.seatNumber) ?? 0) + line.price)
    }
    return map
  }, [billLines])

  const [mode, setMode] = useState<PaymentMode>("one-bill")
  const [stage, setStage] = useState<PaymentStage>("plan")
  const [equalPayers, setEqualPayers] = useState(guestCount > 0 ? guestCount : 1)
  const [includedTargets, setIncludedTargets] = useState<Record<string, boolean>>({})
  const [paidSeatTargets, setPaidSeatTargets] = useState<Record<string, boolean>>({})
  const [payers, setPayers] = useState<Payer[]>([])
  const [itemAssignments, setItemAssignments] = useState<ItemAssignment>({})
  const [expandedSplitLineId, setExpandedSplitLineId] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>("card")
  const [tipPreset, setTipPreset] = useState<0 | 10 | 15 | 20 | "custom">(0)
  const [customTipInput, setCustomTipInput] = useState("")
  const [cashReceivedInput, setCashReceivedInput] = useState("")
  const [bySeatRoundConfirmation, setBySeatRoundConfirmation] = useState<BySeatRoundConfirmation | null>(null)
  const [bySeatPrintReceipts, setBySeatPrintReceipts] = useState(true)
  const [bySeatReceiptHistory, setBySeatReceiptHistory] = useState<Array<{ label: string; amount: number }>>([])
  const [equalPersonPayments, setEqualPersonPayments] = useState<EqualPersonPayment[]>([])
  const [chargeBlast, setChargeBlast] = useState<ChargeBlast | null>(null)
  const [pendingCompletion, setPendingCompletion] = useState<PaymentSummary | null>(null)
  const [successCanFinalize, setSuccessCanFinalize] = useState(true)
  const [bySeatHasRemainingAfterSuccess, setBySeatHasRemainingAfterSuccess] = useState(false)
  const payerSeedRef = useRef(1)
  const chargeBlastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chargeFinalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const completionSentRef = useRef(false)

  const suggestedPayers = Math.max(1, guestCount || seats.length || 1)
  const maxPayers = 12
  const cannotCloseSession = Boolean(outstandingItems && !outstandingItems.canClose)

  useEffect(() => {
    if (!open) return
    setMode("one-bill")
    setStage("plan")
    setMethod("card")
    setTipPreset(0)
    setCustomTipInput("")
    setCashReceivedInput("")
    setEqualPayers(suggestedPayers)
    setIncludedTargets({})
    setPaidSeatTargets({})
    setBySeatRoundConfirmation(null)
    setBySeatPrintReceipts(true)
    setBySeatReceiptHistory([])
    setEqualPersonPayments([])
    setChargeBlast(null)
    setPendingCompletion(null)
    setSuccessCanFinalize(true)
    setBySeatHasRemainingAfterSuccess(false)
    completionSentRef.current = false
    const defaults = buildDefaultPayers(suggestedPayers)
    payerSeedRef.current = defaults.length + 1
    setPayers(defaults)
    setItemAssignments({})
    setExpandedSplitLineId(null)
  }, [open, suggestedPayers])

  useEffect(() => {
    return () => {
      if (chargeBlastTimerRef.current) clearTimeout(chargeBlastTimerRef.current)
      if (chargeFinalizeTimerRef.current) clearTimeout(chargeFinalizeTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const payerIds = new Set(payers.map((p) => p.id))
    setItemAssignments((prev) => {
      const next: ItemAssignment = {}
      for (const [lineId, assignments] of Object.entries(prev)) {
        const filtered = Object.fromEntries(
          Object.entries(assignments).filter(([payerId, shares]) => payerIds.has(payerId) && shares > 0)
        )
        next[lineId] = filtered
      }
      return next
    })
  }, [payers])

  const bySeatRows = useMemo<BySeatRow[]>(() => {
    return [
      ...(seatTotals.get(0)
        ? [{ key: "table", label: contextSharedLabel, chip: contextChipLabel, amount: seatTotals.get(0) ?? 0 }]
        : []),
      ...seats
        .map((seat) => ({
          key: `seat-${seat.number}`,
          label: `Seat ${seat.number}`,
          chip: `S${seat.number}`,
          amount: seatTotals.get(seat.number) ?? 0,
        }))
        .filter((row) => row.amount > 0),
    ]
  }, [contextChipLabel, contextSharedLabel, seatTotals, seats])

  const outstandingBySeatRows = useMemo(
    () => bySeatRows.filter((row) => !paidSeatTargets[row.key]),
    [bySeatRows, paidSeatTargets]
  )

  useEffect(() => {
    const outstandingKeys = new Set(outstandingBySeatRows.map((row) => row.key))
    setIncludedTargets((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key, value]) => value && outstandingKeys.has(key)))
    )
  }, [outstandingBySeatRows])

  useEffect(() => {
    if (!bySeatRoundConfirmation) return
    const timer = setTimeout(() => setBySeatRoundConfirmation(null), 2600)
    return () => clearTimeout(timer)
  }, [bySeatRoundConfirmation])

  const includedBySeatCharges = useMemo(
    () => outstandingBySeatRows.filter((row) => includedTargets[row.key]),
    [includedTargets, outstandingBySeatRows]
  )

  const payerTotals = useMemo(() => {
    const totals: Record<string, number> = Object.fromEntries(payers.map((p) => [p.id, 0]))
    for (const line of billLines) {
      const assignment = itemAssignments[line.id] ?? {}
      const totalShares = Object.values(assignment).reduce((sum, shares) => sum + shares, 0)
      if (totalShares <= 0) continue
      for (const [payerId, shares] of Object.entries(assignment)) {
        totals[payerId] = (totals[payerId] ?? 0) + line.price * (shares / totalShares)
      }
    }
    return totals
  }, [billLines, itemAssignments, payers])

  const itemUnassignedCount = useMemo(
    () =>
      billLines.filter((line) => {
        const assignment = itemAssignments[line.id] ?? {}
        const totalShares = Object.values(assignment).reduce((sum, shares) => sum + shares, 0)
        return totalShares <= 0
      }).length,
    [billLines, itemAssignments]
  )

  const equalCharges = useMemo(() => {
    const count = Math.max(1, equalPayers)
    const totalCents = Math.round(subtotal * 100)
    const per = Math.floor(totalCents / count)
    const rem = totalCents - per * count
    return Array.from({ length: count }, (_, i) => ({
      label: `Split ${i + 1}`,
      amount: (per + (i < rem ? 1 : 0)) / 100,
    }))
  }, [equalPayers, subtotal])

  const itemCharges = useMemo(
    () =>
      payers
        .map((payer) => ({ label: payer.label, amount: payerTotals[payer.id] ?? 0 }))
        .filter((charge) => charge.amount > 0),
    [payerTotals, payers]
  )

  const plannedCharges = useMemo(() => {
    if (mode === "one-bill") return [{ label: contextLabel, amount: subtotal }]
    if (mode === "by-seat") return includedBySeatCharges.map((row) => ({ label: row.label, amount: row.amount }))
    if (mode === "equal") return equalCharges
    return itemCharges
  }, [contextLabel, equalCharges, includedBySeatCharges, itemCharges, mode, subtotal])

  const checkoutSubtotal = useMemo(
    () => plannedCharges.reduce((sum, charge) => sum + charge.amount, 0),
    [plannedCharges]
  )

  const tipAmount = useMemo(() => {
    if (tipPreset === "custom") {
      const parsed = Number(customTipInput)
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    }
    return checkoutSubtotal * (tipPreset / 100)
  }, [checkoutSubtotal, customTipInput, tipPreset])

  const checkoutTotal = checkoutSubtotal + tipAmount
  const settlementCharges = useMemo(() => {
    if (mode !== "equal") return plannedCharges
    const count = Math.max(1, equalPayers)
    const totalCents = Math.round(checkoutTotal * 100)
    const per = Math.floor(totalCents / count)
    const rem = totalCents - per * count
    return Array.from({ length: count }, (_, i) => ({
      label: `Split ${i + 1}`,
      amount: (per + (i < rem ? 1 : 0)) / 100,
    }))
  }, [checkoutTotal, equalPayers, mode, plannedCharges])
  const cashQuickAmounts = useMemo(() => buildCashQuickAmounts(checkoutTotal), [checkoutTotal])
  const cashReceivedAmount = useMemo(() => {
    const parsed = Number(cashReceivedInput)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }, [cashReceivedInput])
  const cashRemainingAmount = Math.max(0, checkoutTotal - cashReceivedAmount)
  const cashChangeAmount = Math.max(0, cashReceivedAmount - checkoutTotal)
  const canChargeCheckout = method !== "cash" || cashRemainingAmount <= 0
  const equalPersonTip = (payment: EqualPersonPayment): number => {
    if (payment.tipPreset === "custom") {
      const parsed = Number(payment.customTipInput)
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    }
    return payment.subtotal * (payment.tipPreset / 100)
  }
  const equalPersonTotal = (payment: EqualPersonPayment): number => payment.subtotal + equalPersonTip(payment)
  const equalPaidCount = useMemo(
    () => equalPersonPayments.filter((payment) => payment.paid).length,
    [equalPersonPayments]
  )
  const equalAllPaid = equalPersonPayments.length > 0 && equalPaidCount === equalPersonPayments.length
  const equalRemainingTotal = useMemo(
    () =>
      equalPersonPayments
        .filter((payment) => !payment.paid)
        .reduce((sum, payment) => sum + equalPersonTotal(payment), 0),
    [equalPersonPayments]
  )
  const isPerPersonCheckoutMode = mode === "equal" || mode === "item"
  const perPersonSourceCharges = useMemo(
    () => (mode === "equal" ? equalCharges : itemCharges),
    [equalCharges, itemCharges, mode]
  )

  useEffect(() => {
    if (stage !== "checkout" || !isPerPersonCheckoutMode) return
    setEqualPersonPayments((prev) =>
      perPersonSourceCharges.map((charge, index) => {
        const existing =
          prev.find((entry) => entry.label === charge.label) ??
          prev[index]
        return {
          id: existing?.id ?? `${mode}-${index + 1}`,
          label: charge.label,
          subtotal: charge.amount,
          tipPreset: existing?.tipPreset ?? 0,
          customTipInput: existing?.customTipInput ?? "",
          method: existing?.method ?? "card",
          cashReceivedInput: existing?.cashReceivedInput ?? "",
          paid: existing?.paid ?? false,
          chargedTotal: existing?.chargedTotal ?? null,
        }
      })
    )
  }, [isPerPersonCheckoutMode, mode, perPersonSourceCharges, stage])

  const canReviewCheckout = useMemo(() => {
    if (plannedCharges.length === 0) return false
    if (mode === "by-seat" && includedBySeatCharges.length === 0) return false
    if (mode === "item" && itemUnassignedCount > 0) return false
    return true
  }, [includedBySeatCharges.length, itemUnassignedCount, mode, plannedCharges.length])

  const addPayer = () => {
    setPayers((prev) => {
      if (prev.length >= maxPayers) return prev
      const id = `p${payerSeedRef.current++}`
      return [...prev, { id, label: `S${prev.length + 1}` }]
    })
  }

  const removePayer = (payerId: string) => {
    setPayers((prev) => (prev.length <= 1 ? prev : prev.filter((payer) => payer.id !== payerId)))
  }

  const toggleQuickPayer = (lineId: string, payerId: string) => {
    setItemAssignments((prev) => {
      const current = { ...(prev[lineId] ?? {}) }
      const selectedIds = Object.keys(current).filter((id) => (current[id] ?? 0) > 0)
      const isSelected = (current[payerId] ?? 0) > 0
      if (!isSelected) {
        current[payerId] = 1
      } else if (selectedIds.length > 1) {
        delete current[payerId]
      } else {
        current[payerId] = 1
      }
      return { ...prev, [lineId]: current }
    })
  }

  const toggleSplitPayer = (lineId: string, payerId: string) => {
    setItemAssignments((prev) => {
      const current = { ...(prev[lineId] ?? {}) }
      if (current[payerId]) delete current[payerId]
      else current[payerId] = 1
      return { ...prev, [lineId]: current }
    })
  }

  const changeSplitShare = (lineId: string, payerId: string, delta: number) => {
    setItemAssignments((prev) => {
      const current = { ...(prev[lineId] ?? {}) }
      const next = Math.max(1, (current[payerId] ?? 1) + delta)
      current[payerId] = next
      return { ...prev, [lineId]: current }
    })
  }

  const applyEqualPreset = () => {
    setItemAssignments(
      Object.fromEntries(
        billLines.map((line) => [
          line.id,
          Object.fromEntries(payers.map((payer) => [payer.id, 1])),
        ])
      )
    )
  }

  const applyBySeatPreset = () => {
    if (payers.length === 0) return
    setItemAssignments(
      Object.fromEntries(
        billLines.map((line) => {
          if (line.seatNumber === 0) {
            return [
              line.id,
              Object.fromEntries(payers.map((payer) => [payer.id, 1])),
            ]
          }
          const payerIndex = Math.min(Math.max(line.seatNumber - 1, 0), payers.length - 1)
          return [line.id, { [payers[payerIndex].id]: 1 }]
        })
      )
    )
  }

  const handleCharge = () => {
    if (chargeBlastTimerRef.current) clearTimeout(chargeBlastTimerRef.current)
    if (chargeFinalizeTimerRef.current) clearTimeout(chargeFinalizeTimerRef.current)
    setChargeBlast({
      id: Date.now(),
      amount: checkoutTotal,
      mode,
    })
    chargeBlastTimerRef.current = setTimeout(() => setChargeBlast(null), 1400)

    let nextPaidForSummary: Record<string, boolean> | null = null
    let bySeatRoundHasRemaining = false
    let bySeatRoundCharges: Array<{ label: string; amount: number }> | null = null
    let bySeatReceiptHistoryNext = bySeatReceiptHistory

    if (mode === "by-seat") {
      if (includedBySeatCharges.length === 0) return
      const keysToMarkPaid = includedBySeatCharges.map((row) => row.key)
      if (includedBySeatCharges.length > 1) {
        bySeatRoundCharges = [
          {
            label: includedBySeatCharges.map((row) => row.chip).join(" + "),
            amount: includedBySeatCharges.reduce((sum, row) => sum + row.amount, 0),
          },
        ]
      } else {
        bySeatRoundCharges = includedBySeatCharges.map((row) => ({ label: row.label, amount: row.amount }))
      }
      bySeatReceiptHistoryNext = [...bySeatReceiptHistory, ...(bySeatRoundCharges ?? [])]
      setBySeatReceiptHistory(bySeatReceiptHistoryNext)

      const nextPaid = { ...paidSeatTargets }
      for (const key of keysToMarkPaid) nextPaid[key] = true
      nextPaidForSummary = nextPaid
      setPaidSeatTargets(nextPaid)
      setBySeatRoundConfirmation({
        amount: includedBySeatCharges.reduce((sum, row) => sum + row.amount, 0),
        chips: includedBySeatCharges.map((row) => row.chip),
      })
      setIncludedTargets({})
      setStage("plan")
      setMode("by-seat")

      const remaining = bySeatRows.filter((row) => !nextPaid[row.key])
      bySeatRoundHasRemaining = remaining.length > 0
    }

    const completedCharges =
      mode === "by-seat"
        ? bySeatRoundHasRemaining
          ? bySeatRoundCharges ?? []
          : bySeatReceiptHistoryNext
        : settlementCharges

    const summary: PaymentSummary = {
      mode,
      method,
      subtotal: checkoutSubtotal,
      tip: tipAmount,
      total: checkoutTotal,
      charges: completedCharges,
    }

    chargeFinalizeTimerRef.current = setTimeout(() => {
      if (mode === "by-seat" && !bySeatPrintReceipts) {
        if (bySeatRoundHasRemaining) {
          setPendingCompletion(null)
          setSuccessCanFinalize(false)
          setBySeatHasRemainingAfterSuccess(false)
          setStage("plan")
          return
        }
        if (!completionSentRef.current) {
          onComplete?.(summary)
          completionSentRef.current = true
        }
        onOpenChange(false)
        return
      }
      setSuccessCanFinalize(!(mode === "by-seat" && bySeatRoundHasRemaining))
      setBySeatHasRemainingAfterSuccess(mode === "by-seat" && bySeatRoundHasRemaining)
      setPendingCompletion(summary)
      setStage("success")
    }, 1050)
  }

  const handleEqualPersonCharge = (personId: string, summaryMode: "equal" | "item") => {
    const target = equalPersonPayments.find((payment) => payment.id === personId)
    if (!target || target.paid) return

    const personTotal = equalPersonTotal(target)
    if (chargeBlastTimerRef.current) clearTimeout(chargeBlastTimerRef.current)
    setChargeBlast({
      id: Date.now(),
      amount: personTotal,
      mode,
    })
    chargeBlastTimerRef.current = setTimeout(() => setChargeBlast(null), 900)

    const nextPayments = equalPersonPayments.map((payment) =>
      payment.id === personId ? { ...payment, paid: true, chargedTotal: personTotal } : payment
    )
    setEqualPersonPayments(nextPayments)

    const allPaidNow = nextPayments.length > 0 && nextPayments.every((payment) => payment.paid)
    if (!allPaidNow) return

    const charges = nextPayments.map((payment) => ({
      label: `${payment.label} (${payment.method})`,
      amount: payment.chargedTotal ?? equalPersonTotal(payment),
    }))
    const subtotalSum = nextPayments.reduce((sum, payment) => sum + payment.subtotal, 0)
    const totalSum = charges.reduce((sum, charge) => sum + charge.amount, 0)
    const tipSum = totalSum - subtotalSum
    const uniqueMethods = Array.from(new Set(nextPayments.map((payment) => payment.method)))
    const summaryMethod: PaymentSummary["method"] = uniqueMethods.length === 1 ? uniqueMethods[0] : "other"

    setPendingCompletion({
      mode: summaryMode,
      method: summaryMethod,
      subtotal: subtotalSum,
      tip: tipSum,
      total: totalSum,
      charges,
    })
    setSuccessCanFinalize(true)
    setBySeatHasRemainingAfterSuccess(false)
    setStage("success")
  }

  const finalizeAndClose = () => {
    if (!completionSentRef.current && pendingCompletion) {
      onComplete?.(pendingCompletion)
      completionSentRef.current = true
    }
    onOpenChange(false)
  }

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && stage === "success") {
      if (successCanFinalize) {
        finalizeAndClose()
      } else {
        onOpenChange(false)
      }
      return
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="payment-modal-dialog payment-modal-content fixed left-1/2 top-1/2 z-50 w-[min(96vw,64rem)] max-w-[64rem] -translate-x-1/2 -translate-y-1/2 border-white/15 bg-[hsl(222,24%,10%)]/95 p-0 text-foreground">
        <div className="payment-modal-inner max-h-[calc(100dvh-2rem)] overflow-y-auto px-6 pt-6 pb-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex h-7 items-center rounded-md border border-cyan-300/40 bg-cyan-500/15 px-2 text-xs font-semibold text-cyan-200">
              Payment
            </span>
            {contextLabel}
          </DialogTitle>
        </DialogHeader>

        {outstandingItems && !outstandingItems.canClose && outstandingItems.reason && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="text-sm text-amber-100/90">
              {outstandingItems.reason === "unfinished_items" && outstandingItems.unfinishedItems && (
                <span>
                  {outstandingItems.unfinishedItems.length} item(s) still pending:{" "}
                  {outstandingItems.unfinishedItems.map((i) => i.name).join(", ")}
                </span>
              )}
              {outstandingItems.reason === "unpaid_balance" && outstandingItems.remaining != null && (
                <span>Unpaid balance: {formatMoney(outstandingItems.remaining)}</span>
              )}
              {outstandingItems.reason === "session_not_open" && (
                <span>Session is not open</span>
              )}
              {outstandingItems.reason === "payment_in_progress" && (
                <span>Payment in progress</span>
              )}
              {outstandingItems.reason === "kitchen_mid_fire" && (
                <span>Kitchen wave in progress</span>
              )}
            </div>
          </div>
        )}

        {stage === "plan" && (
          <>
            {showCustomerFields && (
              <div className="mb-4 rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Guest Details
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={customerName}
                    onChange={(e) => onCustomerNameChange?.(e.target.value)}
                    placeholder="Customer name (optional)"
                    className="h-8"
                  />
                  <PhoneNumberField
                    value={customerPhone}
                    onChange={(phone) => onCustomerPhoneChange?.(phone)}
                    defaultCountry={storeCountry}
                    placeholder="Phone (optional)"
                    triggerClassName="h-8"
                    inputClassName="h-8"
                  />
                </div>
                <Textarea
                  value={orderNote}
                  onChange={(e) => onOrderNoteChange?.(e.target.value)}
                  placeholder="Order note (optional)"
                  className="mt-2 min-h-[64px]"
                />
              </div>
            )}
            <div className="mt-3">
              <Tabs value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="one-bill">One Bill</TabsTrigger>
                <TabsTrigger value="by-seat">By Seat</TabsTrigger>
                <TabsTrigger value="equal">Equal Split</TabsTrigger>
                <TabsTrigger value="item">Item Split</TabsTrigger>
              </TabsList>

              <TabsContent value="one-bill" className="mt-4 space-y-3">
                <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-4">
                  <div className="text-sm text-emerald-100/85">Charge the entire table in one payment</div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-emerald-200/80">One Bill Total</span>
                    <span className="text-2xl font-semibold text-emerald-100">{formatMoney(subtotal)}</span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="by-seat" className="mt-4 space-y-3">
                {bySeatRoundConfirmation ? (
                  <div className="rounded-lg border border-emerald-400/35 bg-emerald-500/12 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-emerald-100">Payment confirmed</div>
                      <div className="text-sm font-semibold text-emerald-100">
                        {formatMoney(bySeatRoundConfirmation.amount)}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-emerald-100/80">
                      Paid now: {bySeatRoundConfirmation.chips.join(", ")}
                    </div>
                  </div>
                ) : null}
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Select seats to charge now
                    </span>
                    <span className="text-xs text-cyan-200/85">
                      {includedBySeatCharges.length} selected
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Tap Include on multiple seats, then charge them together in one round.
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-md border border-white/10 bg-black/25 px-2.5 py-2">
                    <div>
                      <div className="text-xs font-semibold text-foreground">Print receipts</div>
                      <div className="text-[11px] text-muted-foreground">
                        {bySeatPrintReceipts ? "Show receipt step after each charge" : "Skip receipt step and continue"}
                      </div>
                    </div>
                    <Switch checked={bySeatPrintReceipts} onCheckedChange={setBySeatPrintReceipts} />
                  </div>
                </div>

                {bySeatRows.map((row) => (
                  <SettlementRow
                    key={row.key}
                    chip={row.chip}
                    label={row.label}
                    amount={row.amount}
                    paid={!!paidSeatTargets[row.key]}
                    included={!!includedTargets[row.key]}
                    onToggle={() =>
                      setIncludedTargets((prev) => ({
                        ...prev,
                        [row.key]: !prev[row.key],
                      }))
                    }
                  />
                ))}
                {bySeatRows.length === 0 && (
                  <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                    No seat balances found yet.
                  </div>
                )}
                {bySeatRows.length > 0 && outstandingBySeatRows.length === 0 && (
                  <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                    All seat balances are paid.
                  </div>
                )}
                <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Selected to charge now</span>
                    <span className="font-semibold text-cyan-200">
                      {formatMoney(includedBySeatCharges.reduce((sum, row) => sum + row.amount, 0))}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Seats still unpaid</span>
                    <span>{outstandingBySeatRows.length}</span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="equal" className="mt-4 space-y-3">
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    Split equally across guests
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="border border-white/10 bg-transparent hover:bg-black/20"
                      onClick={() => setEqualPayers((n) => Math.max(1, n - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="inline-flex min-w-16 justify-center rounded-md border border-white/10 bg-card px-3 py-2 text-lg font-semibold">
                      {equalPayers}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="border border-white/10 bg-transparent hover:bg-black/20"
                      onClick={() => setEqualPayers((n) => Math.min(maxPayers, n + 1))}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-cyan-100/80">Per person</span>
                    <span className="text-lg font-semibold text-cyan-100">
                      {formatMoney(equalPayers > 0 ? subtotal / equalPayers : subtotal)}
                    </span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="item" className="mt-4 space-y-3">
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Payers
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {payers.map((payer) => (
                      <div
                        key={payer.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2.5 py-1 text-xs"
                      >
                        <span className="font-semibold text-cyan-100">{payer.label}</span>
                        <span className="text-cyan-100/70">{formatMoney(payerTotals[payer.id] ?? 0)}</span>
                        {payers.length > 1 && (
                          <button
                            type="button"
                            className="text-cyan-200/70 hover:text-cyan-100"
                            onClick={() => removePayer(payer.id)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 border border-cyan-300/30 bg-transparent text-cyan-100 hover:bg-cyan-500/20"
                      onClick={addPayer}
                      disabled={payers.length >= maxPayers}
                    >
                      + Payer
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" className="h-7 border border-white/10 bg-transparent text-xs hover:bg-black/20" onClick={applyBySeatPreset}>
                      Preset: By Seat
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 border border-white/10 bg-transparent text-xs hover:bg-black/20" onClick={applyEqualPreset}>
                      Preset: Equal
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 border border-red-400/35 bg-transparent text-xs text-red-200 hover:bg-red-500/15"
                      onClick={() => setItemAssignments({})}
                    >
                      Clear Assignments
                    </Button>
                  </div>
                </div>

                {billLines.map((line) => {
                  const assignment = itemAssignments[line.id] ?? {}
                  const selectedPayerIds = payers
                    .map((payer) => payer.id)
                    .filter((payerId) => (assignment[payerId] ?? 0) > 0)
                  const totalShares = selectedPayerIds.reduce(
                    (sum, payerId) => sum + (assignment[payerId] ?? 0),
                    0
                  )
                  const isSplit = selectedPayerIds.length > 1
                  const splitOpen = expandedSplitLineId === line.id
                  const unassigned = totalShares === 0

                  return (
                    <div key={line.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{line.name}</span>
                            <span
                              className={cn(
                                "inline-flex h-5 items-center rounded border px-1.5 text-[10px] font-semibold",
                                line.seatNumber === 0
                                  ? "border-sky-300/45 bg-sky-500/15 text-sky-200"
                                  : "border-indigo-300/40 bg-indigo-500/15 text-indigo-200"
                              )}
                            >
                              {line.seatNumber === 0 ? contextChipLabel : `S${line.seatNumber}`}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">{formatMoney(line.price)}</div>
                        </div>
                        <div className={cn("text-xs font-semibold", unassigned ? "text-red-300" : "text-emerald-300")}>
                          {unassigned ? "Unassigned" : "Assigned"}
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {payers.map((payer) => {
                          const active = selectedPayerIds.includes(payer.id)
                          return (
                            <button
                              key={payer.id}
                              type="button"
                              onClick={() => {
                                toggleQuickPayer(line.id, payer.id)
                              }}
                              className={cn(
                                "h-7 rounded-md border px-2 text-[11px] font-semibold transition-colors",
                                active
                                  ? "border-cyan-300 bg-cyan-500/20 text-cyan-100"
                                  : "border-border text-muted-foreground hover:bg-accent"
                              )}
                            >
                              {payer.label}
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          onClick={() => setExpandedSplitLineId((prev) => (prev === line.id ? null : line.id))}
                          className={cn(
                            "h-7 rounded-md border px-2 text-[11px] font-semibold transition-colors",
                            isSplit || splitOpen
                              ? "border-amber-300 bg-amber-500/20 text-amber-100"
                              : "border-border text-muted-foreground hover:bg-accent"
                          )}
                        >
                          Split
                        </button>
                      </div>

                      {splitOpen && (
                        <div className="mt-2 rounded-md border border-white/10 bg-black/25 p-2.5">
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Choose who shares this item
                          </div>
                          <div className="space-y-1.5">
                            {payers.map((payer) => {
                              const shares = assignment[payer.id] ?? 0
                              const selected = shares > 0
                              const pct = totalShares > 0 ? Math.round((shares / totalShares) * 100) : 0
                              return (
                                <div key={payer.id} className="flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleSplitPayer(line.id, payer.id)}
                                    className={cn(
                                      "h-7 rounded-md border px-2 text-[11px] font-semibold transition-colors",
                                      selected
                                        ? "border-cyan-300 bg-cyan-500/20 text-cyan-100"
                                        : "border-border text-muted-foreground hover:bg-accent"
                                    )}
                                  >
                                    {payer.label}
                                  </button>
                                  {selected ? (
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 border border-white/10 bg-transparent hover:bg-black/20"
                                        onClick={() => changeSplitShare(line.id, payer.id, -1)}
                                      >
                                        <Minus className="h-3 w-3" />
                                      </Button>
                                      <span className="w-20 text-center text-[11px] text-muted-foreground">
                                        {pct}% · {formatMoney((line.price * shares) / totalShares)}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 border border-white/10 bg-transparent hover:bg-black/20"
                                        onClick={() => changeSplitShare(line.id, payer.id, 1)}
                                      >
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground">Not included</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Assigned items</span>
                    <span className="font-semibold text-emerald-300">
                      {billLines.length - itemUnassignedCount}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-muted-foreground">Unassigned items</span>
                    <span className={cn("font-semibold", itemUnassignedCount > 0 ? "text-red-300" : "text-emerald-300")}>
                      {itemUnassignedCount}
                    </span>
                  </div>
                </div>
              </TabsContent>
              </Tabs>
            </div>

            <DialogFooter className="mt-4">
              <div className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <span className="text-sm text-muted-foreground">Planned Total</span>
                <span className="text-lg font-semibold">{formatMoney(checkoutSubtotal)}</span>
              </div>
              <div className="flex w-full gap-2">
                <Button
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-400 hover:to-cyan-400"
                  onClick={() => {
                    if (mode === "one-bill") {
                      setStage("checkout")
                      return
                    }
                    setStage("checkout")
                  }}
                  disabled={!canReviewCheckout || cannotCloseSession}
                >
                  {mode === "one-bill"
                    ? `Charge Now ${formatMoney(subtotal)}`
                    : mode === "by-seat"
                      ? `Review & Charge ${includedBySeatCharges.length} Seat${includedBySeatCharges.length === 1 ? "" : "s"}`
                      : "Review & Charge"}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}

        {stage === "checkout" && (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => setStage("plan")}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Checkout</span>
              </div>
              {isPerPersonCheckoutMode ? (
                <>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Paid</span>
                      <span className="font-semibold text-emerald-300">
                        {equalPaidCount} / {equalPersonPayments.length}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-muted-foreground">Remaining</span>
                      <span className="font-semibold text-cyan-100">{formatMoney(equalRemainingTotal)}</span>
                    </div>
                  </div>
                  {equalPersonPayments.map((payment) => {
                    const tip = equalPersonTip(payment)
                    const currentTotal = equalPersonTotal(payment)
                    const total = payment.chargedTotal ?? currentTotal
                    const cashQuickAmounts = buildCashQuickAmounts(currentTotal)
                    const cashReceivedAmount = (() => {
                      const parsed = Number(payment.cashReceivedInput)
                      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
                    })()
                    const cashRemainingAmount = Math.max(0, currentTotal - cashReceivedAmount)
                    const cashChangeAmount = Math.max(0, cashReceivedAmount - currentTotal)
                    const canCharge = payment.method !== "cash" || cashRemainingAmount <= 0
                    return (
                      <div key={payment.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground">{payment.label}</span>
                          <span className={cn("text-xs font-semibold", payment.paid ? "text-emerald-300" : "text-amber-200")}>
                            {payment.paid ? "Paid" : "Unpaid"}
                          </span>
                        </div>

                        {!payment.paid ? (
                          <>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {(["card", "cash", "other"] as const).map((m) => (
                                <button
                                  key={`${payment.id}-${m}`}
                                  type="button"
                                  onClick={() =>
                                    setEqualPersonPayments((prev) =>
                                      prev.map((entry) =>
                                        entry.id === payment.id ? { ...entry, method: m } : entry
                                      )
                                    )
                                  }
                                  className={cn(
                                    "h-7 rounded-md border px-2.5 text-[11px] font-semibold uppercase transition-colors",
                                    payment.method === m
                                      ? "border-cyan-300 bg-cyan-500/20 text-cyan-100"
                                      : "border-border text-muted-foreground hover:bg-accent"
                                  )}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {[0, 10, 15, 20].map((pct) => (
                                <button
                                  key={`${payment.id}-${pct}`}
                                  type="button"
                                  onClick={() =>
                                    setEqualPersonPayments((prev) =>
                                      prev.map((entry) =>
                                        entry.id === payment.id
                                          ? { ...entry, tipPreset: pct as 0 | 10 | 15 | 20 }
                                          : entry
                                      )
                                    )
                                  }
                                  className={cn(
                                    "h-7 rounded-md border px-2.5 text-[11px] font-semibold transition-colors",
                                    payment.tipPreset === pct
                                      ? "border-amber-300 bg-amber-500/20 text-amber-100"
                                      : "border-border text-muted-foreground hover:bg-accent"
                                  )}
                                >
                                  {pct}%
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() =>
                                  setEqualPersonPayments((prev) =>
                                    prev.map((entry) =>
                                      entry.id === payment.id ? { ...entry, tipPreset: "custom" } : entry
                                    )
                                  )
                                }
                                className={cn(
                                  "h-7 rounded-md border px-2.5 text-[11px] font-semibold transition-colors",
                                  payment.tipPreset === "custom"
                                    ? "border-amber-300 bg-amber-500/20 text-amber-100"
                                    : "border-border text-muted-foreground hover:bg-accent"
                                )}
                              >
                                Custom
                              </button>
                            </div>
                            {payment.tipPreset === "custom" ? (
                              <div className="mt-2 max-w-36">
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={payment.customTipInput}
                                  onChange={(e) =>
                                    setEqualPersonPayments((prev) =>
                                      prev.map((entry) =>
                                        entry.id === payment.id ? { ...entry, customTipInput: e.target.value } : entry
                                      )
                                    )
                                  }
                                  placeholder="Tip amount"
                                  className="h-8"
                                />
                              </div>
                            ) : null}
                            {payment.method === "cash" ? (
                              <div className="mt-2 rounded-md border border-white/10 bg-black/20 px-2.5 py-2">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  Cash Received
                                </div>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {cashQuickAmounts.map((amount) => {
                                    const selected = Math.abs(cashReceivedAmount - amount) < 0.001
                                    return (
                                      <button
                                        key={`${payment.id}-cash-${amount}`}
                                        type="button"
                                        onClick={() =>
                                          setEqualPersonPayments((prev) =>
                                            prev.map((entry) =>
                                              entry.id === payment.id
                                                ? { ...entry, cashReceivedInput: amount.toFixed(2) }
                                                : entry
                                            )
                                          )
                                        }
                                        className={cn(
                                          "h-7 rounded-md border px-2 text-[11px] font-semibold transition-colors",
                                          selected
                                            ? "border-cyan-300 bg-cyan-500/25 text-cyan-100"
                                            : "border-cyan-300/35 bg-transparent text-cyan-100/85 hover:bg-cyan-500/15"
                                        )}
                                      >
                                        {formatMoney(amount)}
                                      </button>
                                    )
                                  })}
                                </div>
                                <div className="mt-2 max-w-40">
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={payment.cashReceivedInput}
                                    onChange={(e) =>
                                      setEqualPersonPayments((prev) =>
                                        prev.map((entry) =>
                                          entry.id === payment.id
                                            ? { ...entry, cashReceivedInput: e.target.value }
                                            : entry
                                        )
                                      )
                                    }
                                    placeholder="Custom received"
                                    className="h-8"
                                  />
                                </div>
                                <div className="mt-2 rounded-md border border-white/10 bg-black/25 px-2.5 py-2 text-xs">
                                  <div className="flex items-center justify-between text-muted-foreground">
                                    <span>Cash Received</span>
                                    <span className="font-semibold text-foreground">{formatMoney(cashReceivedAmount)}</span>
                                  </div>
                                  <div
                                    className={cn(
                                      "mt-1 flex items-center justify-between font-semibold",
                                      cashRemainingAmount > 0 ? "text-red-300" : "text-emerald-300"
                                    )}
                                  >
                                    <span>{cashRemainingAmount > 0 ? "Still Needed" : "Give Back"}</span>
                                    <span>
                                      {formatMoney(
                                        cashRemainingAmount > 0 ? cashRemainingAmount : cashChangeAmount
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                            <div className="mt-2 space-y-1 rounded-md border border-white/10 bg-black/25 px-2.5 py-2 text-sm">
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>Subtotal</span>
                                <span>{formatMoney(payment.subtotal)}</span>
                              </div>
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>Tip</span>
                                <span>{formatMoney(tip)}</span>
                              </div>
                              <div className="flex items-center justify-between font-semibold">
                                <span>Total</span>
                                <span>{formatMoney(total)}</span>
                              </div>
                            </div>
                            <div className="mt-2">
                              <Button
                                className="h-8 w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-400 hover:to-cyan-400"
                                onClick={() => handleEqualPersonCharge(payment.id, mode === "item" ? "item" : "equal")}
                                disabled={!canCharge || cannotCloseSession}
                              >
                                {payment.method === "cash"
                                  ? `Collect ${formatMoney(currentTotal)}`
                                  : `Charge ${payment.label} ${formatMoney(currentTotal)}`}
                              </Button>
                            </div>
                          </>
                        ) : null}
                      </div>
                    )
                  })}
                </>
              ) : (
                <>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Payment Method
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["card", "cash", "other"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={cn(
                        "h-8 rounded-md border px-3 text-xs font-semibold uppercase transition-colors",
                        method === m
                          ? "border-cyan-300 bg-cyan-500/20 text-cyan-100"
                          : "border-border text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tip
                </div>
                <div className="flex flex-wrap gap-2">
                  {[0, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setTipPreset(pct as 0 | 10 | 15 | 20)}
                      className={cn(
                        "h-8 rounded-md border px-3 text-xs font-semibold transition-colors",
                        tipPreset === pct
                          ? "border-amber-300 bg-amber-500/20 text-amber-100"
                          : "border-border text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {pct}%
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTipPreset("custom")}
                    className={cn(
                      "h-8 rounded-md border px-3 text-xs font-semibold transition-colors",
                      tipPreset === "custom"
                        ? "border-amber-300 bg-amber-500/20 text-amber-100"
                        : "border-border text-muted-foreground hover:bg-accent"
                    )}
                  >
                    Custom
                  </button>
                </div>
                {tipPreset === "custom" && (
                  <div className="mt-2 max-w-36">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={customTipInput}
                      onChange={(e) => setCustomTipInput(e.target.value)}
                      placeholder="Tip amount"
                      className="h-8"
                    />
                  </div>
                )}
              </div>

              {method === "cash" && (
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cash Received
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cashQuickAmounts.map((amount) => {
                      const selected = Math.abs(cashReceivedAmount - amount) < 0.001
                      return (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => setCashReceivedInput(amount.toFixed(2))}
                          className={cn(
                            "h-8 rounded-md border px-3 text-xs font-semibold transition-colors",
                            selected
                              ? "border-cyan-300 bg-cyan-500/25 text-cyan-100"
                              : "border-cyan-300/35 bg-transparent text-cyan-100/85 hover:bg-cyan-500/15"
                          )}
                        >
                          {formatMoney(amount)}
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-2 max-w-44">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={cashReceivedInput}
                      onChange={(e) => setCashReceivedInput(e.target.value)}
                      placeholder="Custom received"
                      className="h-8"
                    />
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                <div className="space-y-1">
                  {settlementCharges.map((charge) => (
                    <div key={charge.label} className="flex items-center justify-between text-muted-foreground">
                      <span>{charge.label}</span>
                      <span>{formatMoney(charge.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 border-t border-white/10 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatMoney(checkoutSubtotal)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-muted-foreground">Tip</span>
                    <span>{formatMoney(tipAmount)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-base font-semibold">
                    <span>Total to Charge</span>
                    <span>{formatMoney(checkoutTotal)}</span>
                  </div>
                  {method === "cash" && (
                    <div className="mt-2 rounded-md border border-white/10 bg-black/25 px-3 py-2.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Cash Received</span>
                        <span className="font-semibold text-foreground">{formatMoney(cashReceivedAmount)}</span>
                      </div>
                      <div
                        className={cn(
                          "mt-1.5 flex items-center justify-between text-sm font-semibold",
                          cashRemainingAmount > 0 ? "text-red-300" : "text-emerald-300"
                        )}
                      >
                        <span>{cashRemainingAmount > 0 ? "Still Needed" : "Give Back"}</span>
                        <span>
                          {formatMoney(
                            cashRemainingAmount > 0 ? cashRemainingAmount : cashChangeAmount
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
                </>
              )}
            </div>

            <DialogFooter className="mt-4">
              {isPerPersonCheckoutMode ? (
                <Button
                  className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-400 hover:to-cyan-400"
                  onClick={() => {
                    if (!equalAllPaid) return
                    setSuccessCanFinalize(true)
                    setBySeatHasRemainingAfterSuccess(false)
                    setStage("success")
                  }}
                  disabled={!equalAllPaid || cannotCloseSession}
                >
                  {equalAllPaid ? "Review Receipts" : "Charge each person to continue"}
                </Button>
              ) : (
                <Button
                  className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-400 hover:to-cyan-400"
                  onClick={handleCharge}
                  disabled={!canChargeCheckout || cannotCloseSession}
                >
                  {method === "cash" ? `Collect ${formatMoney(checkoutTotal)}` : `Charge ${formatMoney(checkoutTotal)}`}
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {stage === "success" && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-300" />
              <div className="text-lg font-semibold text-emerald-100">Payment Completed</div>
              <div className="mt-1 text-sm text-emerald-100/75">
                {bySeatHasRemainingAfterSuccess
                  ? "Selected seats are settled. Continue with the next seats."
                  : `${contextLabel} has been settled.`}
              </div>
            </div>
            <div className="space-y-2">
              {(pendingCompletion?.charges.length ? pendingCompletion.charges : plannedCharges).map((charge, index) => (
                <div key={`${charge.label}-${index}`} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{charge.label}</span>
                    <span className="text-sm font-semibold text-cyan-100">{formatMoney(charge.amount)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="ghost" className="border border-white/10 bg-transparent hover:bg-black/20">
                      Print Receipt
                    </Button>
                    <Button variant="ghost" className="border border-white/10 bg-transparent hover:bg-black/20">
                      Email Receipt
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {trackingUrl ? (
              <div className="rounded-lg border border-sky-300/25 bg-sky-500/10 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-sky-200/90">
                      {trackingTitle}
                    </div>
                    <div className="text-[11px] text-sky-100/80">
                      Scan to follow live status
                      {trackingCode ? ` · ${trackingCode}` : ""}
                    </div>
                  </div>
                  {trackingUrl ? (
                    <Button
                      variant="ghost"
                      className="h-7 border border-sky-300/35 bg-transparent px-2.5 text-[11px] text-sky-100 hover:bg-sky-500/15"
                      onClick={() => window.open(trackingUrl, "_blank", "noopener,noreferrer")}
                    >
                      Open
                    </Button>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  {qrImageSrc ? (
                    <img
                      src={qrImageSrc}
                      alt="Tracking QR code"
                      className="h-28 w-28 rounded-md border border-sky-300/25 bg-white p-1"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1 rounded-md border border-sky-300/20 bg-black/20 px-2.5 py-2 text-[11px] text-sky-100/80">
                    <div className="mb-1 font-semibold text-sky-100">Tracking Link</div>
                    <div className="break-all">{trackingUrl}</div>
                  </div>
                </div>
              </div>
            ) : null}
            <DialogFooter className="mt-4">
              <Button
                className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-400 hover:to-cyan-400"
                onClick={() => {
                  if (bySeatHasRemainingAfterSuccess && !successCanFinalize) {
                    setPendingCompletion(null)
                    setBySeatHasRemainingAfterSuccess(false)
                    setStage("plan")
                    return
                  }
                  finalizeAndClose()
                }}
                disabled={cannotCloseSession}
              >
                {bySeatHasRemainingAfterSuccess && !successCanFinalize ? "Next Seat" : "Done"}
              </Button>
            </DialogFooter>
          </div>
        )}
        </div>
        {chargeBlast ? (
          <div className="pointer-events-none absolute inset-0 z-[70] overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.22)_0%,rgba(14,116,144,0.16)_28%,transparent_62%)] animate-charge-blast-fade" />
            <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/45 animate-charge-ring" />
            <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/30 animate-charge-ring-delayed" />
            <div className="absolute inset-x-0 top-1/2 h-12 -translate-y-1/2 bg-[linear-gradient(90deg,transparent_0%,rgba(34,211,238,0.2)_40%,rgba(16,185,129,0.26)_52%,rgba(34,211,238,0.2)_64%,transparent_100%)] animate-charge-scan" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-emerald-300/35 bg-black/45 px-5 py-2 text-center backdrop-blur-md animate-charge-core">
              <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/80">Payment Synced</div>
              <div className="text-lg font-semibold text-emerald-100">{formatMoney(chargeBlast.amount)}</div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function SettlementRow({
  chip,
  label,
  amount,
  paid = false,
  included,
  onToggle,
}: {
  chip?: string
  label: string
  amount: number
  paid?: boolean
  included: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        paid ? "border-emerald-400/30 bg-emerald-500/10" : "border-white/10 bg-black/20"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="font-medium">{label}</div>
            {chip ? (
              <span className="inline-flex h-5 items-center rounded border border-sky-300/45 bg-sky-500/15 px-1.5 text-[10px] font-semibold text-sky-200">
                {chip}
              </span>
            ) : null}
          </div>
          <div className="text-sm text-muted-foreground">{formatMoney(amount)}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={paid ? "default" : included ? "default" : "outline"}
            className={cn(
              "min-w-24",
              paid
                ? "bg-emerald-500 text-white hover:bg-emerald-500"
                : included
                ? "bg-emerald-500 text-white hover:bg-emerald-500/90"
                : "border-white/20 bg-transparent"
            )}
            onClick={() => {
              if (paid) return
              onToggle()
            }}
            disabled={paid}
          >
            {paid ? "Paid" : included ? "Included" : "Include"}
          </Button>
        </div>
      </div>
    </div>
  )
}
