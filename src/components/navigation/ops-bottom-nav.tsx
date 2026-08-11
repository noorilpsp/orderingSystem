"use client"

import { useEffect, useMemo, useState } from "react"
import { Link } from "@/components/ui/link"
import { usePathname } from "next/navigation"
import { Bell, CalendarDays, ChefHat, Clock, Combine, ClipboardList, LayoutGrid, PencilRuler, ShoppingBasket, Table2, Users } from "lucide-react"

import { getLastViewedFloorplanClientGlobal } from "@/lib/floor-map/lastViewedFloorplan"
import { unlockIncomingOrderAlertAudio } from "@/lib/orders/incoming-order-alert-sound"
import { useMerchantKdsEnabled } from "@/lib/hooks/useMerchantKdsEnabled"
import { cn } from "@/lib/utils"

type OpsNavItem = {
  href: string
  label: string
  Icon: typeof ShoppingBasket
  active: (pathname: string) => boolean
}

const items: OpsNavItem[] = [
  {
    href: "/counter",
    label: "Cashier",
    Icon: ShoppingBasket,
    active: (pathname) => pathname.startsWith("/counter"),
  },
  {
    href: "/floor-map",
    label: "Floor Plan",
    Icon: LayoutGrid,
    active: (pathname) => pathname.startsWith("/floor-map"),
  },
  {
    href: "/kds",
    label: "KDS",
    Icon: ChefHat,
    active: (pathname) => pathname.startsWith("/kds"),
  },
  {
    href: "/builder",
    label: "Builder",
    Icon: PencilRuler,
    active: (pathname) => pathname.startsWith("/builder"),
  },
  {
    href: "/tables",
    label: "Tables",
    Icon: Table2,
    active: (pathname) => pathname.startsWith("/tables") || pathname.startsWith("/table/"),
  },
  {
    href: "/orders",
    label: "Orders",
    Icon: ClipboardList,
    active: (pathname) => pathname.startsWith("/orders"),
  },
  {
    href: "/merge-split",
    label: "Merge",
    Icon: Combine,
    active: (pathname) => pathname.startsWith("/merge-split"),
  },
  {
    href: "/communications",
    label: "Comms",
    Icon: Bell,
    active: (pathname) => pathname.startsWith("/communications"),
  },
  {
    href: "/reservations/list",
    label: "Reservations",
    Icon: CalendarDays,
    active: (pathname) => pathname.startsWith("/reservations") && !pathname.startsWith("/reservations/waitlist"),
  },
  {
    href: "/reservations/waitlist",
    label: "Waitlist",
    Icon: Clock,
    active: (pathname) => pathname.startsWith("/reservations/waitlist"),
  },
  {
    href: "/guests",
    label: "Guests",
    Icon: Users,
    active: (pathname) => pathname.startsWith("/guests"),
  },
]

export function OpsBottomNav() {
  const pathname = usePathname()
  const [lastFloorplanId, setLastFloorplanId] = useState<string | null>(null)
  const { kdsEnabled } = useMerchantKdsEnabled()

  useEffect(() => {
    setLastFloorplanId(getLastViewedFloorplanClientGlobal())
  }, [pathname])

  const resolvedItems = useMemo(
    () =>
      items
        .filter((item) => (item.href === "/kds" ? kdsEnabled : true))
        .map((item) => {
          if (item.href !== "/floor-map" || !lastFloorplanId) return item
          return {
            ...item,
            href: `/floor-map?floorplan=${encodeURIComponent(lastFloorplanId)}`,
          }
        }),
    [lastFloorplanId, kdsEnabled]
  )

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[70] border-t border-cyan-200/35 bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.94))] px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-14px_36px_rgba(2,6,23,0.5)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1680px] flex-nowrap items-stretch gap-1.5">
        {resolvedItems.map((item) => {
          const isActive = item.active(pathname)
          return (
            <Link
              key={item.href}
              prefetch={true}
              href={item.href}
              onPointerDown={() => {
                // Unlock during the nav click so /orders can autoplay without another tap.
                void unlockIncomingOrderAlertAudio()
              }}
              className={cn(
                "group flex min-w-0 flex-1 basis-0 items-center justify-center gap-1.5 rounded-xl border px-1 text-sm font-semibold transition-all sm:gap-2 sm:px-2",
                isActive
                  ? "border-cyan-300/55 bg-cyan-500/20 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.32)]"
                  : "border-transparent text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.Icon className="h-4 w-4 shrink-0" />
              <span className="hidden truncate sm:inline">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
