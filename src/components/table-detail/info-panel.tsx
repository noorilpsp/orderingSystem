"use client"

import { useMerchantLocalization } from "@/lib/hooks/useMerchantLocalization"
import { useState, useEffect } from "react"
import { ArrowRight, Clock, Plus, Star, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TableDetail } from "@/lib/table-data"
import { minutesAgo } from "@/lib/table-data"

interface InfoPanelProps {
  table: TableDetail
  showTitle?: boolean
}

export function InfoPanel({ table, showTitle = true }: InfoPanelProps) {
  const { formatMoney } = useMerchantLocalization()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const seatedMinutes = mounted && table.seatedAt ? minutesAgo(table.seatedAt) : 0
  const lastCheckMinutes = mounted && table.lastCheckIn ? minutesAgo(table.lastCheckIn) : 0
  const seatedTime = mounted && table.seatedAt
    ? new Date(table.seatedAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "--:--"

  return (
    <div className="flex flex-col gap-5">
      {showTitle && (
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Table Info
        </h2>
      )}

      {/* Server */}
      {table.server && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Server
          </h3>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {table.server.name}{" "}
                  <span className="text-muted-foreground">(You)</span>
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-primary">
              Transfer
            </Button>
          </div>
        </section>
      )}

      <div className="h-px bg-border" />

      {/* Notes */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Notes
        </h3>
        <div className="mt-2 space-y-2">
          {table.notes.map((note) => (
            <div
              key={note.text}
              className="rounded-lg bg-secondary/70 px-3 py-2"
            >
              <p className="text-sm text-foreground">
                {note.icon} {note.text}
              </p>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="mt-2 gap-1 text-xs text-primary">
          <Plus className="h-3 w-3" />
          Add Note
        </Button>
      </section>

      <div className="h-px bg-border" />

      {/* Bill Summary */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Bill Summary
        </h3>
        <div className="mt-2 space-y-1.5 rounded-lg bg-secondary/70 px-3 py-3">
          <div className="flex justify-between text-sm text-foreground">
            <span>Subtotal</span>
            <span>{formatMoney(table.bill.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Tax</span>
            <span>{formatMoney(table.bill.tax)}</span>
          </div>
          <div className="my-1 h-px bg-border" />
          <div className="flex justify-between text-sm font-semibold text-foreground">
            <span>Total</span>
            <span>{formatMoney(table.bill.total)}</span>
          </div>
        </div>
      </section>

      {table.seatedAt && (
        <>
          <div className="h-px bg-border" />

          {/* Visit Info */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Visit Info
            </h3>
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Seated: {seatedTime} ({seatedMinutes} min ago)
                </span>
              </div>
              {table.lastCheckIn && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Last check-in: {lastCheckMinutes} min ago</span>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* Returning Guest */}
      {table.returningGuest && (
        <>
          <div className="h-px bg-border" />
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Returning Guest
            </h3>
            <div className="mt-2 rounded-lg bg-secondary/70 px-3 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10">
                  <Star className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {table.returningGuest.name}
                    {" \u00B7 "}
                    {table.returningGuest.visits} visits
                    {table.returningGuest.vip && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                        VIP
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Usually: {table.returningGuest.usualOrder.join(", ")}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 gap-1 text-xs text-primary"
              >
                View History
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
