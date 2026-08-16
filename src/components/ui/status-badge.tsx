import { cn } from "@/lib/utils"
import type { StatusKey } from "@/lib/constants"

interface StatusBadgeProps {
  status: StatusKey | string
  label?: string
  size?: "sm" | "md"
  className?: string
}

const sizeClasses = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
}

const statusVariants = {
  // Order statuses (ops-aligned hues: sky / amber / red / emerald / rose / fuchsia)
  pending: "bg-gray-300 text-gray-900 dark:bg-gray-600 dark:text-white",
  new: "bg-sky-500 text-white dark:bg-sky-500/90 dark:text-sky-50",
  preparing: "bg-amber-500 text-white dark:bg-amber-500/90 dark:text-amber-50",
  served: "bg-emerald-500 text-white dark:bg-emerald-500/90 dark:text-emerald-50",
  delivered: "bg-emerald-500 text-white",
  delayed: "bg-red-500 text-white",
  paid: "bg-emerald-600 text-white",
  active: "bg-sky-500 text-white",
  ready: "bg-red-500 text-white dark:bg-red-500/90 dark:text-red-50",
  voided: "bg-rose-500 text-white dark:bg-rose-500/90 dark:text-rose-50",
  refunded: "bg-fuchsia-500 text-white dark:bg-fuchsia-500/90 dark:text-fuchsia-50",

  // Reservation statuses
  reserved: "bg-yellow-500 text-white dark:bg-yellow-500 dark:text-white",
  confirmed: "bg-blue-500 text-white",
  arrived: "bg-orange-400 text-black dark:bg-orange-300 dark:text-black",
  seated: "bg-green-500 text-white",
  completed: "bg-emerald-500 text-white dark:bg-emerald-500/90 dark:text-emerald-50",
  cancelled: "bg-rose-500 text-white",
  noShow: "bg-gray-700 text-white dark:bg-gray-500 dark:text-white",

  // Table statuses
  available: "bg-green-500 text-white dark:bg-green-500 dark:text-white",
  occupied: "bg-red-500 text-white dark:bg-red-500 dark:text-white",
  waitlist: "bg-purple-500 text-white",
  grace: "bg-amber-400 text-black dark:bg-amber-300 dark:text-white",
  conflict: "bg-orange-500 text-white",
  cleaning: "bg-gray-500 text-white dark:bg-gray-600 dark:text-white",

  // Generic
  warning: "bg-yellow-500 text-black",
} as const

export function StatusBadge({ status, label, size = "sm", className }: StatusBadgeProps) {
  const displayLabel = label || status.charAt(0).toUpperCase() + status.slice(1)
  const normalizedStatus = status.toLowerCase()

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap min-w-[84px] text-center",
        sizeClasses[size],
        statusVariants[normalizedStatus as keyof typeof statusVariants] || statusVariants.confirmed,
        className,
      )}
    >
      {displayLabel}
    </span>
  )
}
