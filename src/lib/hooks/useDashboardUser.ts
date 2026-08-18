"use client"

import { useMemo } from "react"
import { usePermissionsContext } from "@/lib/contexts/PermissionsContext"
import { useTenant } from "@/lib/contexts/TenantContext"
import { getInitials } from "@/lib/utils"

function formatMerchantRole(role: "owner" | "admin" | "manager"): string {
  switch (role) {
    case "owner":
      return "Owner"
    case "admin":
      return "Admin"
    case "manager":
      return "Manager"
    default: {
      const _exhaustive: never = role
      return _exhaustive
    }
  }
}

export function useDashboardUser() {
  const { sessionPermissions } = usePermissionsContext()
  const { getCurrentMembership } = useTenant()
  const membership = getCurrentMembership()

  return useMemo(() => {
    const email = sessionPermissions?.email?.trim() || null
    const name =
      sessionPermissions?.fullName?.trim() ||
      email?.split("@")[0] ||
      "User"
    const roleLabel = membership
      ? formatMerchantRole(membership.role)
      : sessionPermissions?.isPlatformAdmin
        ? "Admin"
        : ""

    return {
      name,
      email,
      roleLabel,
      initials: getInitials(name),
    }
  }, [sessionPermissions, membership])
}
