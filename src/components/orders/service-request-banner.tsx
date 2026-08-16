"use client"

import { BellRing, CheckCircle2, CreditCard, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { OrdersServiceRequest } from "@/lib/orders/ordersView"
import { useStaffLocale } from "@/lib/ops-i18n"
import { cn } from "@/lib/utils"

type ServiceRequestBannerProps = {
  requests: OrdersServiceRequest[]
  pendingId: string | null
  onAcknowledge: (request: OrdersServiceRequest) => void
}

export function ServiceRequestBanner({
  requests,
  pendingId,
  onAcknowledge,
}: ServiceRequestBannerProps) {
  const { t } = useStaffLocale()
  if (requests.length === 0) return null

  return (
    <section
      className="mb-3 space-y-2"
      aria-label={t("service.aria")}
    >
      {requests.map((request) => {
        const isWaiter = request.requestType === "waiter"
        const pending = pendingId === request.id
        return (
          <div
            key={request.id}
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 shadow-lg ring-1",
              isWaiter
                ? "border-red-400/60 bg-gradient-to-r from-red-600/30 via-red-500/20 to-red-400/10 ring-red-400/30"
                : "border-amber-400/60 bg-gradient-to-r from-amber-600/30 via-amber-500/20 to-amber-400/10 ring-amber-400/30",
            )}
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <span
                className={cn(
                  "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-black",
                  isWaiter ? "bg-red-400" : "bg-amber-400",
                )}
              >
                {isWaiter ? (
                  <BellRing className="h-3.5 w-3.5" />
                ) : (
                  <CreditCard className="h-3.5 w-3.5" />
                )}
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isWaiter ? "text-red-50" : "text-amber-50",
                  )}
                >
                  {t("source.tableWithCode", { code: request.tableNumber })}
                  {" · "}
                  {isWaiter ? t("service.waiterCalled") : t("service.checkRequested")}
                </p>
                <p
                  className={cn(
                    "text-xs",
                    isWaiter ? "text-red-100/90" : "text-amber-100/90",
                  )}
                >
                  {isWaiter ? t("service.waiterHint") : t("service.checkHint")}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              disabled={pending}
              className={cn(
                "h-8 shrink-0 px-3 text-xs font-semibold text-black disabled:opacity-60",
                isWaiter
                  ? "bg-emerald-400 hover:bg-emerald-300"
                  : "bg-amber-400 hover:bg-amber-300",
              )}
              onClick={() => onAcknowledge(request)}
            >
              {pending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              )}
              {pending
                ? t("common.saving")
                : isWaiter
                  ? t("service.handled")
                  : t("service.checkDelivered")}
            </Button>
          </div>
        )
      })}
    </section>
  )
}
