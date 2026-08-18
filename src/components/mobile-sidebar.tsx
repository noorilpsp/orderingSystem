"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Store,
  ShoppingCart,
  Menu,
  BarChart3,
  Settings,
  ChevronDown,
  Megaphone,
  MenuIcon,
  Search,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { useDashboardUser } from "@/lib/hooks/useDashboardUser"
import { useTenant } from "@/lib/contexts/TenantContext"

const operationsItems = [
  { title: "Home", href: "/dashboard", icon: Home },
  { title: "Orders", href: "/orders", icon: ShoppingCart },
]

const businessItems = [
  { title: "Menu", href: "/menu", icon: Menu },
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

const systemCollapsible: Array<{
  title: string
  icon: typeof Store
  items: Array<{ title: string; href: string }>
}> = []

const systemItems = [
  { title: "Store", href: "/dashboard/stores", icon: Store },
]

const systemSettingsCollapsible: Array<{
  title: string
  icon: typeof Settings
  items: Array<{ title: string; href: string }>
}> = []

export function MobileSidebar() {
  const pathname = usePathname()
  const { name, roleLabel, initials } = useDashboardUser()
  const { getCurrentMembership } = useTenant()
  const storeName = getCurrentMembership()?.merchantName?.trim() || "Store"
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
        <SheetHeader className="p-4 border-b shrink-0 space-y-3">
          <div className="flex min-w-0 items-center gap-2">
            <SheetTitle className="min-w-0 flex-1 truncate text-left">{storeName}</SheetTitle>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSearchExpanded(!searchExpanded)}
              className="shrink-0"
              aria-label="Search menu"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {searchExpanded && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn("pl-9 h-9 w-full", searchQuery && "pr-9")}
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
        </SheetHeader>

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
                    <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate">
                    {name}
                    {roleLabel ? ` · ${roleLabel}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                    Online
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{name}</p>
                  {roleLabel ? <p className="text-xs text-muted-foreground">{roleLabel}</p> : null}
                </div>
              </div>
              <DropdownMenuSeparator />
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
