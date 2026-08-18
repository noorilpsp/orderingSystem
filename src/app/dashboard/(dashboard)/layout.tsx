"use client"

import type React from "react"
import dynamic from "next/dynamic"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { PermissionsProvider, usePermissionsContext } from "@/lib/contexts/PermissionsContext"
import { TenantProvider } from "@/lib/contexts/TenantContext"
import { LocationProvider } from "@/lib/contexts/LocationContext"

const AppSidebar = dynamic(
  () => import("@/components/app-sidebar").then((mod) => mod.AppSidebar),
  { ssr: false }
)
const DashboardHeader = dynamic(
  () => import("@/components/dashboard-header").then((mod) => mod.DashboardHeader),
  { ssr: false }
)
const CommandPalette = dynamic(
  () => import("@/components/command-palette").then((mod) => mod.CommandPalette),
  { ssr: false }
)
const RestaurantHydrationRunner = dynamic(
  () => import("@/components/restaurant-hydration-runner").then((mod) => mod.RestaurantHydrationRunner),
  { ssr: false }
)

// Inner component that has access to PermissionsContext
function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { sessionPermissions, loading: permissionsLoading } = usePermissionsContext()

  // Wait for permissions to load before rendering TenantProvider
  // This ensures merchant memberships are available
  if (permissionsLoading || !sessionPermissions) {
    return (
      <div className="flex min-h-screen w-full">
        <div className="flex flex-1 items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }

  // Extract merchant memberships for TenantProvider
  const merchantMemberships = sessionPermissions.merchantMemberships.map((m) => ({
    merchantId: m.merchantId,
    merchantName: m.merchantName,
    role: m.role,
    isActive: m.isActive,
    membershipCreatedAt: m.membershipCreatedAt,
  }))

  const userId = sessionPermissions.userId

  if (merchantMemberships.length === 0 && process.env.NODE_ENV === "development") {
    console.warn("[DashboardLayout] No merchant memberships found:", {
      userId,
      sessionPermissions,
      merchantMembershipsCount: sessionPermissions.merchantMemberships.length,
    })
  }

  // If user has no merchant memberships, show a message with debug info
  if (merchantMemberships.length === 0) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center max-w-md">
              <h2 className="text-xl font-semibold mb-2">No Merchants Found</h2>
              <p className="text-muted-foreground mb-4">
                You don't have access to any merchants. Please contact support.
              </p>
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4 text-left text-sm">
                  <summary className="cursor-pointer text-muted-foreground">Debug Info</summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                    {JSON.stringify(
                      {
                        userId: sessionPermissions.userId,
                        email: sessionPermissions.email,
                        merchantMembershipsCount: sessionPermissions.merchantMemberships.length,
                        rawMemberships: sessionPermissions.merchantMemberships,
                      },
                      null,
                      2
                    )}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      </SidebarProvider>
    )
  }

  return (
    <TenantProvider initialMerchants={merchantMemberships} userId={userId}>
      <LocationProvider>
      <RestaurantHydrationRunner />
      <SidebarProvider className="h-svh max-h-svh overflow-hidden">
        <div className="flex h-full min-h-0 w-full overflow-hidden">
          <AppSidebar />
          <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <DashboardHeader />
            <main className="flex min-h-0 flex-1 flex-col min-w-0 overflow-hidden" aria-label="Main content">
              {children}
            </main>
            <CommandPalette />
          </SidebarInset>
        </div>
      </SidebarProvider>
      </LocationProvider>
    </TenantProvider>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PermissionsProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </PermissionsProvider>
  )
}
