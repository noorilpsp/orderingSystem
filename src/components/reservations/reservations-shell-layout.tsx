"use client"

import { useCallback, useMemo, type ReactNode } from "react"
import type { ReservationsView } from "@/lib/reservations/reservationsView"
import { ReservationsDataProvider, useReservationsData } from "@/lib/reservations/reservationsDataContext"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Calendar,
  Clock3,
  GanttChart,
  LayoutDashboard,
  List as ListIcon,
  Map,
} from "lucide-react"

import { useRestaurantStore } from "@/store/restaurantStore"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ReservationDetailPanel } from "@/components/reservations/reservation-detail-panel"
import { ReservationFormView } from "@/components/reservations/reservation-form-view"
import { getReservationById, type DetailReservation } from "@/lib/detail-modal-data"
import {
  getCurrentLocalTime24,
  type Reservation,
} from "@/lib/reservations-data"
import {
  guestProfileFromPrefill,
  guestProfileFromStoreReservation,
  type BookingChannel,
  type FormTag,
} from "@/lib/reservation-form-data"
import { cn } from "@/lib/utils"

type ReservationLens = {
  id: "overview" | "calendar" | "timeline" | "floorplan" | "list" | "waitlist"
  label: string
  href: string
}

type LensMetric = {
  value: string
}

const RESERVATION_LENSES: ReservationLens[] = [
  { id: "overview", label: "Overview", href: "/reservations/overview" },
  { id: "calendar", label: "Calendar", href: "/reservations/calendar" },
  { id: "timeline", label: "Timeline", href: "/reservations/timeline" },
  { id: "floorplan", label: "Floor Plan", href: "/reservations/floorplan" },
  { id: "list", label: "List", href: "/reservations/list" },
  { id: "waitlist", label: "Waitlist", href: "/reservations/waitlist" },
]

const LENS_ICONS: Record<ReservationLens["id"], typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  calendar: Calendar,
  timeline: GanttChart,
  floorplan: Map,
  list: ListIcon,
  waitlist: Clock3,
}

interface ReservationsShellLayoutProps {
  initialReservationsView: ReservationsView | null
  children: ReactNode
}

function timeToMinutes(time24: string): number {
  const [h, m] = time24.split(":").map(Number)
  return h * 60 + m
}

function normalizeZonePreference(rawZone?: string | null): string | undefined {
  if (!rawZone) return undefined
  const normalized = rawZone.trim().toLowerCase()
  if (!normalized) return undefined
  if (normalized === "any" || normalized.includes("no pref")) return "any"
  if (normalized === "main" || normalized.includes("main dining")) return "main"
  if (normalized === "patio") return "patio"
  if (normalized === "private" || normalized.includes("private room")) return "private"
  // If zone is already a real section id (custom sections), preserve it.
  return normalized
}

function mapBookedViaToChannel(raw?: string | null): BookingChannel | undefined {
  if (!raw) return undefined
  const normalized = raw.trim().toLowerCase()
  if (normalized.includes("concierge")) return "concierge"
  if (normalized.includes("phone")) return "phone"
  if (normalized.includes("google")) return "google"
  if (normalized.includes("opentable")) return "opentable"
  if (normalized.includes("instagram")) return "instagram"
  if (normalized.includes("app")) return "app"
  if (normalized.includes("website") || normalized.includes("web")) return "website"
  if (normalized.includes("direct") || normalized.includes("walk")) return "direct"
  return "direct"
}

function mapOverviewTagsToFormTags(tags: Reservation["tags"]): FormTag[] {
  const mapped = tags.flatMap<FormTag>((tag) => {
    switch (tag.type) {
      case "vip":
      case "birthday":
      case "anniversary":
      case "allergy":
      case "high-value":
      case "first-timer":
        return [tag.type]
      case "wheelchair":
        return ["accessible"]
      case "window":
      default:
        return []
    }
  })
  return [...new Set(mapped)]
}

function inferServicePeriodIdFromTime(
  time: string | undefined,
  servicePeriods: Array<{ id: string; start: string; end: string }>
): string | undefined {
  if (!time) return undefined
  const timeMin = timeToMinutes(time)
  if (!Number.isFinite(timeMin)) return undefined
  const match = servicePeriods.find((period) => {
    const start = timeToMinutes(period.start)
    let end = timeToMinutes(period.end)
    let current = timeMin
    if (end <= start) {
      end += 24 * 60
      if (current < start) current += 24 * 60
    }
    return current >= start && current < end
  })
  return match?.id
}

function ReservationsShellLayoutInner({ children }: { children: ReactNode }) {
  const { reservations, waitlistParties, config, capacitySlots, tables } = useReservationsData()
  const storeReservations = useRestaurantStore((s) => s.reservations)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isDesktop = useMediaQuery("(min-width: 1280px)")

  const activeLens = useMemo(() => {
    return RESERVATION_LENSES.find((lens) => pathname === lens.href) ?? RESERVATION_LENSES[0]
  }, [pathname])

  const action = searchParams.get("action")
  const detail = searchParams.get("detail")
  const actionId = searchParams.get("id") ?? detail
  const isActionOpen = action === "new" || action === "edit"
  const isDetailOpen = Boolean(detail)
  const prefillDate = searchParams.get("date")
  const prefillTime = searchParams.get("time")
  const prefillGuestName = searchParams.get("guestName")
  const prefillPhone = searchParams.get("phone")
  const prefillEmail = searchParams.get("email")
  const prefillChannel = searchParams.get("channel")
  const prefillTable = searchParams.get("table")
  const prefillZone = searchParams.get("zone")
  const prefillService = searchParams.get("service")
  const prefillPartySizeRaw = searchParams.get("partySize")
  const prefillDurationRaw = searchParams.get("duration")
  const prefillDurationMaxRaw = searchParams.get("durationMax")
  const prefillPartySize = prefillPartySizeRaw ? Number.parseInt(prefillPartySizeRaw, 10) : undefined
  const prefillDuration = prefillDurationRaw ? Number.parseInt(prefillDurationRaw, 10) : undefined
  const prefillDurationMax = prefillDurationMaxRaw ? Number.parseInt(prefillDurationMaxRaw, 10) : undefined
  const mode = action === "edit" ? "edit" : "create"
  const editSourceReservation = useMemo(
    () => (actionId ? reservations.find((reservation) => reservation.id === actionId) : undefined),
    [actionId]
  )
  const editDetailReservation = useMemo(
    () =>
      actionId
        ? getReservationById(actionId, reservations, {
            storeReservations,
            tables,
          })
        : undefined,
    [actionId, reservations, storeReservations, tables]
  )
  const todayIso = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }, [])

  const newPrefill = useMemo(
    () => (
      action === "new"
        ? {
            date: prefillDate ?? todayIso,
            time: prefillTime ?? undefined,
            assignedTable: prefillTable ?? undefined,
            zonePreference: normalizeZonePreference(prefillZone),
            servicePeriodId: prefillService ?? undefined,
            partySize: Number.isFinite(prefillPartySize) ? prefillPartySize : undefined,
            duration: Number.isFinite(prefillDuration) ? prefillDuration : undefined,
            durationMax: Number.isFinite(prefillDurationMax) ? prefillDurationMax : undefined,
          }
        : undefined
    ),
    [action, prefillDate, prefillDuration, prefillDurationMax, prefillPartySize, prefillService, prefillTable, prefillTime, prefillZone, todayIso]
  )
  const editPrefill = useMemo(() => {
    if (action !== "edit") return undefined
    if (!actionId) return undefined

    const date = editDetailReservation?.date ?? prefillDate ?? undefined
    const time = editDetailReservation?.time ?? editSourceReservation?.time ?? prefillTime ?? undefined
    const assignedTable = editDetailReservation?.table ?? editSourceReservation?.table ?? prefillTable ?? undefined
    const zonePreference = (
      normalizeZonePreference(prefillZone)
      ?? normalizeZonePreference(editDetailReservation?.zone)
      ?? (assignedTable ? normalizeZonePreference(editDetailReservation?.zone) ?? "main" : "any")
    )
    const allergyDetail = (
      editSourceReservation?.tags.find((tag) => tag.type === "allergy")?.detail
      ?? undefined
    )
    const storeRes = storeReservations.find((r) => r.id === actionId)
    const guestId = storeRes?.customerId ?? editSourceReservation?.customerId ?? undefined
    const guestProfile =
      storeRes
        ? guestProfileFromStoreReservation(storeRes)
        : editSourceReservation
          ? guestProfileFromPrefill({
              guestId: guestId ?? editSourceReservation.id,
              guestName: editSourceReservation.guestName,
              phone: editSourceReservation.phone,
              email: undefined,
              visitCount: editSourceReservation.visitCount,
            })
          : undefined

    return {
      reservationId: actionId,
      guestName: editDetailReservation?.guestName ?? editSourceReservation?.guestName ?? prefillGuestName ?? undefined,
      guestId,
      phone: editDetailReservation?.guestPhone ?? editSourceReservation?.phone ?? prefillPhone ?? undefined,
      email: editDetailReservation?.guestEmail ?? prefillEmail ?? undefined,
      date,
      time,
      partySize: editDetailReservation?.partySize ?? editSourceReservation?.partySize ?? undefined,
      duration: editDetailReservation?.duration ?? (Number.isFinite(prefillDuration) ? prefillDuration : undefined),
      tableAssignMode: assignedTable ? "manual" as const : "unassigned" as const,
      assignedTable,
      zonePreference,
      tags: editSourceReservation ? mapOverviewTagsToFormTags(editSourceReservation.tags) : undefined,
      allergyDetail,
      notes: editSourceReservation?.notes ?? undefined,
      channel: mapBookedViaToChannel(prefillChannel ?? editSourceReservation?.bookedVia ?? editDetailReservation?.channel),
      sendSms: Boolean(editSourceReservation?.confirmationSent),
      sendEmail: Boolean(editSourceReservation?.confirmationSent),
      requireDeposit: editDetailReservation?.depositStatus === "required" || editDetailReservation?.depositStatus === "paid",
      depositAmount: editDetailReservation?.deposit ? String(editDetailReservation.deposit) : "",
      addToCalendar: false,
      servicePeriodId: prefillService ?? inferServicePeriodIdFromTime(time, config.servicePeriods),
      durationMax: Number.isFinite(prefillDurationMax) ? prefillDurationMax : undefined,
      guestProfile,
    }
  }, [
    action,
    actionId,
    config.servicePeriods,
    editDetailReservation,
    editSourceReservation,
    prefillDate,
    prefillEmail,
    prefillGuestName,
    prefillPhone,
    prefillChannel,
    prefillDuration,
    prefillDurationMax,
    prefillService,
    prefillTable,
    prefillTime,
    prefillZone,
    storeReservations,
  ])
  const prefill = action === "new" ? newPrefill : action === "edit" ? editPrefill : undefined
  const formRenderKey = `${mode}:${actionId ?? ""}:${prefill?.guestName ?? ""}:${prefill?.date ?? ""}:${prefill?.time ?? ""}:${prefill?.assignedTable ?? ""}:${prefill?.zonePreference ?? ""}:${prefill?.servicePeriodId ?? ""}:${prefill?.partySize ?? ""}:${prefill?.duration ?? ""}:${prefill?.durationMax ?? ""}`

  const shellMetrics = useMemo(() => {
    const nowMinutes = timeToMinutes(getCurrentLocalTime24())
    const currentSlot =
      capacitySlots.find((slot) => timeToMinutes(slot.time) <= nowMinutes && nowMinutes < timeToMinutes(slot.time) + 30) ??
      capacitySlots.reduce((closest, slot) => {
        const distance = Math.abs(timeToMinutes(slot.time) - nowMinutes)
        const bestDistance = Math.abs(timeToMinutes(closest.time) - nowMinutes)
        return distance < bestDistance ? slot : closest
      }, capacitySlots[0])

    const activeReservations = reservations.filter(
      (res) =>
        res.status === "confirmed" ||
        res.status === "late"
    ).length

    const lensMetrics: Record<ReservationLens["id"], LensMetric> = {
      overview: {
        value: `${currentSlot.occupancyPct}%`,
      },
      calendar: {
        value: `${reservations.length}`,
      },
      timeline: {
        value: `${currentSlot.arrivingReservations}`,
      },
      floorplan: {
        value: `${currentSlot.predictedTurns}`,
      },
      list: {
        value: `${activeReservations}`,
      },
      waitlist: {
        value: `${waitlistParties.length}`,
      },
    }

    return { lensMetrics }
  }, [reservations, waitlistParties, capacitySlots])

  const updateSearch = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString())
      mutate(next)
      const query = next.toString()
      const href = query ? `${pathname}?${query}` : pathname
      router.push(href, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const closeDetail = useCallback(() => {
    updateSearch((next) => {
      next.delete("detail")
    })
  }, [updateSearch])

  const closeAction = useCallback(() => {
    updateSearch((next) => {
      next.delete("action")
      next.delete("id")
      next.delete("draft")
      next.delete("time")
      // Keep "date" - it is the shared view date for List/Timeline, not just form prefill
      next.delete("table")
      next.delete("service")
      next.delete("zone")
      next.delete("partySize")
      next.delete("duration")
      next.delete("durationMax")
    })
  }, [updateSearch])

  const reservation = useMemo((): DetailReservation | null => {
    if (!detail) return null
    return (
      getReservationById(detail, reservations, {
        storeReservations,
        tables,
      }) ?? null
    )
  }, [detail, reservations, storeReservations, tables])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-800/60 bg-zinc-950/85 backdrop-blur-xl">
        <div className="px-2 py-2 md:px-3 lg:px-4">
          <div className="overflow-x-auto scrollbar-none">
            <div className="mx-auto flex w-max items-center gap-1.5" role="tablist" aria-label="Reservation views">
              {RESERVATION_LENSES.map((lens) => {
                const selected = activeLens.href === lens.href
                const lensMetric = shellMetrics.lensMetrics[lens.id]
                const LensIcon = LENS_ICONS[lens.id]
                const dateParam = searchParams.get("date")
                const preserveDate =
                  (lens.id === "list" || lens.id === "timeline") &&
                  dateParam &&
                  dateParam !== todayIso &&
                  /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
                const lensHref = preserveDate ? `${lens.href}?date=${dateParam}` : lens.href
                return (
                  <Link
                    key={lens.id}
                    href={lensHref}
                    role="tab"
                    aria-selected={selected}
                    className={cn(
                      "group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-2xl border px-3 text-xs font-semibold tracking-[0.01em] transition-all md:h-10 md:px-3.5",
                      selected
                        ? "border-emerald-400/70 bg-[linear-gradient(135deg,rgba(16,185,129,0.26),rgba(5,150,105,0.14))] text-emerald-100 shadow-[0_0_22px_rgba(16,185,129,0.33)] ring-1 ring-emerald-500/30"
                        : "border-zinc-800/90 bg-[linear-gradient(160deg,rgba(39,39,42,0.76),rgba(24,24,27,0.8))] text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800/85 hover:text-zinc-100"
                    )}
                  >
                    <LensIcon className={cn("h-4 w-4", selected ? "text-emerald-300" : "text-zinc-500")} />
                    <span>{lens.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                        selected
                          ? "bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/35"
                          : "bg-zinc-800/90 text-zinc-300 ring-1 ring-zinc-700/70"
                      )}
                    >
                      {lensMetric.value}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

      </header>

      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

      <ReservationDetailPanel
        reservation={reservation}
        open={isDetailOpen}
        onClose={closeDetail}
      />

      <Dialog open={isActionOpen && isDesktop} onOpenChange={(open) => !open && closeAction()}>
        <DialogContent showCloseButton={false} className="reservation-form-dialog w-[min(1320px,98vw)] max-w-none overflow-hidden border-zinc-800 bg-zinc-950 p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{action === "edit" ? "Edit Reservation" : "New Reservation"}</DialogTitle>
            <DialogDescription>Reservation form</DialogDescription>
          </DialogHeader>
          <div className="h-[88vh]">
            <ReservationFormView
              key={formRenderKey}
              mode={mode}
              prefill={prefill}
              onRequestClose={closeAction}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={isActionOpen && !isDesktop} onOpenChange={(open) => !open && closeAction()}>
        <SheetContent side="bottom" showClose={false} className="h-[96dvh] border-zinc-800 bg-zinc-950 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{action === "edit" ? "Edit Reservation" : "New Reservation"}</SheetTitle>
            <SheetDescription>Reservation form</SheetDescription>
          </SheetHeader>
          <div className="h-full">
            <ReservationFormView
              key={`${formRenderKey}:mobile`}
              mode={mode}
              prefill={prefill}
              onRequestClose={closeAction}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export function ReservationsShellLayout({ initialReservationsView, children }: ReservationsShellLayoutProps) {
  return (
    <ReservationsDataProvider initialReservationsView={initialReservationsView}>
      <ReservationsShellLayoutInner>{children}</ReservationsShellLayoutInner>
    </ReservationsDataProvider>
  )
}
