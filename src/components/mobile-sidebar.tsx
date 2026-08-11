"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Store,
  Grid3x3,
  ShoppingCart,
  Menu,
  CreditCard,
  UserCircle,
  Calendar,
  BarChart3,
  Settings,
  ChevronDown,
  Megaphone,
  MenuIcon,
  Search,
  X,
  Package,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { unlockIncomingOrderAlertAudio } from "@/lib/orders/incoming-order-alert-sound"

const operationsItems = [
  { title: "Home", href: "/dashboard", icon: Home },
  {
    title: "Orders",
    href: "/orders",
    icon: ShoppingCart,
    badge: "5",
    badgeColor: "bg-red-500/10 text-red-700 border-red-500/20",
  },
  { title: "Tables", href: "/tables", icon: Grid3x3 },
  { title: "Reservations", href: "/reservations", icon: Calendar },
]

const businessItems = [
  { title: "Menu", href: "/menu", icon: Menu },
  { title: "Inventory", href: "/inventory", icon: Package },
]

const businessCollapsible = [
  {
    title: "Marketing",
    icon: Megaphone,
    items: [
      { title: "Promotions", href: "/promotions" },
      { title: "Loyalty / Rewards", href: "/loyalty" },
      { title: "Campaigns", href: "/campaigns" },
    ],
  },
  {
    title: "Analytics",
    icon: BarChart3,
    items: [
      { title: "Reports", href: "/reports" },
      { title: "Performance", href: "/performance" },
      { title: "Customer Insights", href: "/customer-insights" },
      { title: "Exports", href: "/exports" },
    ],
  },
]

const systemCollapsible = [
  {
    title: "Stores",
    icon: Store,
    items: [
      { title: "Store Info", href: "/stores" },
      { title: "Floorplan & Tables", href: "/stores/floorplan" },
      { title: "Cross-location Comparison", href: "/stores/comparison" },
    ],
  },
  {
    title: "Payments",
    icon: CreditCard,
    items: [
      { title: "History", href: "/payments/history" },
      { title: "Refunds", href: "/payments/refunds" },
      { title: "Payouts", href: "/payments/payouts" },
      { title: "Invoices", href: "/payments/invoices" },
      { title: "Invoice Settings", href: "/payments/invoice-settings" },
      { title: "Banking", href: "/payments/banking" },
    ],
  },
]

const systemItems = [{ title: "Users / Staff", href: "/staff", icon: UserCircle }]

const systemSettingsCollapsible = [
  {
    title: "Settings",
    icon: Settings,
    items: [
      { title: "Restaurant Info", href: "/settings/restaurant" },
      { title: "Notification Settings", href: "/settings/notifications" },
      { title: "Integrations", href: "/settings/integrations" },
      { title: "Subscription / Billing", href: "/settings/subscription" },
      { title: "Legal & Compliance", href: "/settings/legal" },
    ],
  },
]

const locations = [
  { name: "Downtown Location", orders: 3, tables: "8/15", status: "online", address: "123 Main St, Downtown" },
  { name: "Mall Branch", orders: 5, tables: "12/20", status: "online", address: "456 Mall Ave, Shopping District" },
  { name: "Airport Store", orders: 2, tables: "5/10", status: "closed", address: "789 Airport Rd, Terminal 2" },
]

export function MobileSidebar() {
  const pathname = usePathname()
  const [selectedLocation, setSelectedLocation] = React.useState(locations[0])
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchExpanded, setSearchExpanded] = React.useState(false)

  const filterItems = React.useCallback(
    (items: any[]) => {
      if (!searchQuery) return items
      return items.filter((item) => item.title.toLowerCase().includes(searchQuery.toLowerCase()))
    },
    [searchQuery],
  )

  const filterCollapsibleSections = React.useCallback(
    (sections: any[]) => {
      if (!searchQuery) return sections
      return sections
        .map((section) => ({
          ...section,
          items: section.items.filter((item: any) => item.title.toLowerCase().includes(searchQuery.toLowerCase())),
        }))
        .filter((section) => section.items.length > 0)
    },
    [searchQuery],
  )

  const filteredOperationsItems = filterItems(operationsItems)
  const filteredBusinessItems = filterItems(businessItems)
  const filteredBusinessCollapsible = filterCollapsibleSections(businessCollapsible)
  const filteredSystemCollapsible = filterCollapsibleSections(systemCollapsible)
  const filteredSystemItems = filterItems(systemItems)
  const filteredSystemSettingsCollapsible = filterCollapsibleSections(systemSettingsCollapsible)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <MenuIcon className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[320px] p-0 flex flex-col h-full overflow-hidden">
        <SheetHeader className="p-4 border-b shrink-0">
          <SheetTitle>Restaurant Dashboard</SheetTitle>
        </SheetHeader>

        <div className="p-4 border-b shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex-1 justify-between bg-transparent">
                  <span className="text-sm font-medium truncate">{selectedLocation.name}</span>
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                {locations.map((location) => (
                  <DropdownMenuItem
                    key={location.name}
                    onClick={() => setSelectedLocation(location)}
                    className="flex flex-col items-start gap-1 py-3"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full",
                            location.status === "online" ? "bg-green-500" : "bg-gray-400",
                          )}
                        />
                        <span className="font-medium">{location.name}</span>
                      </div>
                      {selectedLocation.name === location.name && (
                        <Badge variant="secondary" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground pl-4">{location.address}</div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setSearchExpanded(!searchExpanded)}
              className="shrink-0"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {searchExpanded && (
            <div className="relative animate-in slide-in-from-top-2 duration-200 mx-auto max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-9 w-full" // Added pr-9 for clear button space
                autoFocus
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 overflow-y-auto">
          <nav className="px-3 py-2 space-y-1">
            <div className="px-3 py-2">
              <p className="text-xs uppercase font-semibold text-muted-foreground">Operations</p>
            </div>
            {filteredOperationsItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  onPointerDown={() => {
                    if (item.href === "/orders") {
                      void unlockIncomingOrderAlertAudio()
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3.5 text-base font-medium transition-all min-h-[44px]",
                    isActive
                      ? "bg-muted/50 text-foreground border-l-4 border-foreground dark:border-white"
                      : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1">{item.title}</span>
                  {item.badge && <Badge className={cn("text-xs", item.badgeColor)}>{item.badge}</Badge>}
                </Link>
              )
            })}

            <Separator className="my-1.5" />

            <div className="px-3 py-2">
              <p className="text-xs uppercase font-semibold text-muted-foreground">Business</p>
            </div>
            {filteredBusinessItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3.5 text-base font-medium transition-all min-h-[44px]",
                    isActive
                      ? "bg-muted/50 text-foreground border-l-4 border-foreground dark:border-white"
                      : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1">{item.title}</span>
                </Link>
              )
            })}

            <Accordion type="multiple" className="space-y-1">
              {filteredBusinessCollapsible.map((section) => {
                const Icon = section.icon
                const isAnyChildActive = section.items.some((item) => pathname === item.href)

                return (
                  <AccordionItem key={section.title} value={section.title} className="border-0">
                    <AccordionTrigger
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-4 py-3.5 text-base font-medium transition-all hover:no-underline hover:bg-accent min-h-[44px]",
                        isAnyChildActive
                          ? "bg-muted/50 text-foreground border-l-4 border-foreground dark:border-white"
                          : "text-sidebar-foreground",
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Icon className="h-5 w-5" />
                        <span className="flex-1 text-left">{section.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0 pt-1">
                      <div className="space-y-1 pl-7">
                        {section.items.map((item) => {
                          const isActive = pathname === item.href
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className={cn(
                                "block rounded-lg px-4 py-2.5 text-sm transition-all min-h-[44px] flex items-center",
                                isActive
                                  ? "bg-muted/50 text-foreground font-medium"
                                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                              )}
                            >
                              {item.title}
                            </Link>
                          )
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>

            <Separator className="my-1.5" />

            <div className="px-3 py-2">
              <p className="text-xs uppercase font-semibold text-muted-foreground">System</p>
            </div>

            <Accordion type="multiple" className="space-y-1">
              {filteredSystemCollapsible.map((section) => {
                const Icon = section.icon
                const isAnyChildActive = section.items.some((item) => pathname === item.href)

                return (
                  <AccordionItem key={section.title} value={section.title} className="border-0">
                    <AccordionTrigger
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-4 py-3.5 text-base font-medium transition-all hover:no-underline hover:bg-accent min-h-[44px]",
                        isAnyChildActive
                          ? "bg-muted/50 text-foreground border-l-4 border-foreground dark:border-white"
                          : "text-sidebar-foreground",
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Icon className="h-5 w-5" />
                        <span className="flex-1 text-left">{section.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0 pt-1">
                      <div className="space-y-1 pl-7">
                        {section.items.map((item) => {
                          const isActive = pathname === item.href
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className={cn(
                                "block rounded-lg px-4 py-2.5 text-sm transition-all min-h-[44px] flex items-center",
                                isActive
                                  ? "bg-muted/50 text-foreground font-medium"
                                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                              )}
                            >
                              {item.title}
                            </Link>
                          )
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>

            {filteredSystemItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3.5 text-base font-medium transition-all min-h-[44px]",
                    isActive
                      ? "bg-muted/50 text-foreground border-l-4 border-foreground dark:border-white"
                      : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1">{item.title}</span>
                </Link>
              )
            })}

            <Accordion type="multiple" className="space-y-1">
              {filteredSystemSettingsCollapsible.map((section) => {
                const Icon = section.icon
                const isAnyChildActive = section.items.some((item) => pathname === item.href)

                return (
                  <AccordionItem key={section.title} value={section.title} className="border-0">
                    <AccordionTrigger
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-4 py-3.5 text-base font-medium transition-all hover:no-underline hover:bg-accent min-h-[44px]",
                        isAnyChildActive
                          ? "bg-muted/50 text-foreground border-l-4 border-foreground dark:border-white"
                          : "text-sidebar-foreground",
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Icon className="h-5 w-5" />
                        <span className="flex-1 text-left">{section.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0 pt-1">
                      <div className="space-y-1 pl-7">
                        {section.items.map((item) => {
                          const isActive = pathname === item.href
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className={cn(
                                "block rounded-lg px-4 py-2.5 text-sm transition-all min-h-[44px] flex items-center",
                                isActive
                                  ? "bg-muted/50 text-foreground font-medium"
                                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                              )}
                            >
                              {item.title}
                            </Link>
                          )
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </nav>
        </ScrollArea>

        <div className="border-t p-4 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-auto p-0 hover:bg-accent rounded-md px-3 py-2"
              >
                <div className="relative shrink-0">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src="/placeholder.svg?height=40&width=40" alt="John Doe" />
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium">John Doe · Owner</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                    Online
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">John Doe</p>
                <p className="text-xs text-muted-foreground">Owner</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <UserCircle className="h-4 w-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="h-4 w-4 mr-2" />
                Account Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SheetContent>
    </Sheet>
  )
}
