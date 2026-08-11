"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  CreditCard,
  Download,
  FileText,
  RefreshCw,
  Settings,
  Plus,
  Search,
  LayoutDashboard,
  ShoppingCart,
  Users,
  BarChart3,
  Filter,
  DollarSign,
} from "lucide-react"
import { unlockIncomingOrderAlertAudio } from "@/lib/orders/incoming-order-alert-sound"

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false)
    command()
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search for transactions, actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Recent">
          <CommandItem>
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Transaction tx_20241120_0001</span>
          </CommandItem>
          <CommandItem>
            <RefreshCw className="mr-2 h-4 w-4" />
            <span>Refund tx_20241115_0045</span>
          </CommandItem>
          <CommandItem>
            <FileText className="mr-2 h-4 w-4" />
            <span>Daily reconciliation report</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => runCommand(() => console.log("New transaction"))}>
            <Plus className="mr-2 h-4 w-4" />
            <span>New Transaction</span>
            <kbd className="ml-auto text-xs">⌘N</kbd>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => console.log("Export"))}>
            <Download className="mr-2 h-4 w-4" />
            <span>Export Transactions</span>
            <kbd className="ml-auto text-xs">⌘E</kbd>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => console.log("Generate report"))}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Generate Report</span>
            <kbd className="ml-auto text-xs">⌘R</kbd>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => console.log("Sync"))}>
            <RefreshCw className="mr-2 h-4 w-4" />
            <span>Sync Now</span>
            <kbd className="ml-auto text-xs">⌘⇧S</kbd>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/transactions/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
            <kbd className="ml-auto text-xs">⌘,</kbd>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Filters">
          <CommandItem onSelect={() => runCommand(() => console.log("Filter: failed"))}>
            <Filter className="mr-2 h-4 w-4" />
            <span>Show only failed transactions</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => console.log("Filter: refunds"))}>
            <RefreshCw className="mr-2 h-4 w-4" />
            <span>Show only refunds</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => console.log("Filter: high-value"))}>
            <DollarSign className="mr-2 h-4 w-4" />
            <span>Show high-value (&gt;€500)</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => console.log("Filter: today"))}>
            <Search className="mr-2 h-4 w-4" />
            <span>Show today's transactions</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard"))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Go to Dashboard</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                void unlockIncomingOrderAlertAudio()
                router.push("/orders")
              })
            }
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            <span>Go to Orders</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/customers"))}>
            <Users className="mr-2 h-4 w-4" />
            <span>Go to Customers</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/reports"))}>
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>Go to Reports</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
