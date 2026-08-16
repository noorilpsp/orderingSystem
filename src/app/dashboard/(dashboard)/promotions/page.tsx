"use client"

import { PromotionsManager } from "@/components/promotions/promotions-manager"

export default function PromotionsPage() {
  return (
    <div className="flex min-h-0 h-full w-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Promotions</h1>
            <p className="text-sm text-muted-foreground">
              Strike through sale prices on the menu, or run buy 1 get 1. Loyalty still stacks at checkout.
            </p>
          </div>
          <PromotionsManager />
        </div>
      </div>
    </div>
  )
}
