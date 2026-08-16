"use client"

import React from "react"
import { MenuProvider } from "./menu-context"
import { MenuTabs } from "@/components/menu-tabs"

export default function MenuLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MenuProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <MenuTabs />

        <div className="min-h-0 flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </MenuProvider>
  )
}
