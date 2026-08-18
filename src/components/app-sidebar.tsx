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
  Search,
  X,
  Megaphone,
  ChefHat,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ThemeToggleInline } from "@/components/theme-toggle-inline"
import { logout } from "@/app/actions/auth"
import { clearUserData } from "@/lib/utils/logout"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useMerchantKdsEnabled } from "@/lib/hooks/useMerchantKdsEnabled"
import { useDashboardUser } from "@/lib/hooks/useDashboardUser"
import { useTenant } from "@/lib/contexts/TenantContext"

const operationsItems = [
  { title: "Home", href: "/dashboard", icon: Home },
  { title: "Orders", href: "/dashboard/orders", icon: ShoppingCart },
  { title: "Kitchen Display", href: "/kds", icon: ChefHat },
  { title: "KDS Settings", href: "/dashboard/kds", icon: Settings },
]

const businessItems = [
  { title: "Menu", href: "/dashboard/menu/overview", icon: Menu },
]

const businessCollapsible = [
  {
    title: "Marketing",
    icon: Megaphone,
    defaultOpen: false,
    items: [
      { title: "Promotions", href: "/dashboard/promotions" },
      { title: "Loyalty / Rewards", href: "/dashboard/loyalty" },
      { title: "Campaigns", href: "/dashboard/campaigns" },
    ],
  },
  {
    title: "Analytics",
    icon: BarChart3,
    defaultOpen: false,
    items: [
      { title: "Reports", href: "/dashboard/reports" },
      { title: "Performance", href: "/dashboard/performance" },
      { title: "Customer Insights", href: "/dashboard/customer-insights" },
      { title: "Downloads", href: "/dashboard/downloads" },
    ],
  },
]

const systemCollapsible: Array<{
  title: string
  icon: typeof Store
  defaultOpen: boolean
  items: Array<{ title: string; href: string }>
}> = []

const systemItems = [
  { title: "Store", href: "/dashboard/stores", icon: Store },
]

const systemSettingsCollapsible: Array<{
  title: string
  icon: typeof Settings
  defaultOpen: boolean
  items: Array<{ title: string; href: string }>
}> = []

export function AppSidebar() {
  const pathname = usePathname()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const { kdsEnabled } = useMerchantKdsEnabled()
  const { name, roleLabel, initials } = useDashboardUser()
  const { getCurrentMembership } = useTenant()
  const storeName = getCurrentMembership()?.merchantName?.trim() || "Store"
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchExpanded, setSearchExpanded] = React.useState(false)

  const [openTooltips, setOpenTooltips] = React.useState<Set<string>>(new Set())

  const handleLogout = async () => {
    // Clear all client-side user data before server-side logout
    clearUserData()
    // Server-side logout will redirect
    await logout()
  }

  React.useEffect(() => {
    if (isCollapsed) {
      setOpenTooltips(new Set())
      setSearchExpanded(false)
    }
  }, [isCollapsed])

  const filterItems = React.useCallback(
    (items: any[]) => {
      const featureFiltered = items.filter((item) => {
        if (item.href === "/kds" || item.href === "/dashboard/kds") {
          return kdsEnabled
        }
        return true
      })
      if (!searchQuery) return featureFiltered
      return featureFiltered.filter((item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    },
    [searchQuery, kdsEnabled],
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
    <Sidebar collapsible="icon">
      {!isCollapsed && (
      <SidebarHeader>
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1">
            <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-semibold">{storeName}</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 bg-transparent"
            onClick={() => setSearchExpanded(!searchExpanded)}
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
              className={cn("pl-9 h-9", searchQuery && "pr-9")}
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
      </SidebarHeader>
      )}

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase font-semibold text-muted-foreground px-4 py-2">
            Operations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <TooltipProvider>
                {filteredOperationsItems.map((item) => {
                  const Icon = item.icon
                  const isActive = item.href === "/dashboard" 
                    ? pathname === "/dashboard" || pathname === "/dashboard/"
                    : pathname?.startsWith(item.href) ?? false
                  return (
                    <SidebarMenuItem key={item.href}>
                      <Tooltip open={isCollapsed && openTooltips.has(item.href)}>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className={cn(isActive && "border-l-4 rounded-l-lg border-foreground dark:border-white")}
                            onMouseEnter={() => {
                              if (isCollapsed) {
                                setOpenTooltips((prev) => new Set(prev).add(item.href))
                              }
                            }}
                            onMouseLeave={() => {
                              if (isCollapsed) {
                                setOpenTooltips((prev) => {
                                  const next = new Set(prev)
                                  next.delete(item.href)
                                  return next
                                })
                              }
                            }}
                          >
                            <Link href={item.href} className="px-4 py-2.5">
                              <Icon className="h-4 w-4" />
                              <span>{item.title}</span>
                              {item.badge && (
                                <Badge variant={item.badgeVariant} className="ml-auto text-xs">
                                  {item.badge}
                                </Badge>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        {isCollapsed && (
                          <TooltipContent side="right">
                            <p>{item.title}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </SidebarMenuItem>
                  )
                })}
              </TooltipProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-0.5" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase font-semibold text-muted-foreground px-4 py-2">
            Business
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <TooltipProvider>
                {filteredBusinessItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname?.startsWith(item.href) ?? false
                  return (
                    <SidebarMenuItem key={item.href}>
                      <Tooltip open={isCollapsed && openTooltips.has(item.href)}>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className={cn(isActive && "border-l-4 rounded-l-lg border-foreground dark:border-white")}
                            onMouseEnter={() => {
                              if (isCollapsed) {
                                setOpenTooltips((prev) => new Set(prev).add(item.href))
                              }
                            }}
                            onMouseLeave={() => {
                              if (isCollapsed) {
                                setOpenTooltips((prev) => {
                                  const next = new Set(prev)
                                  next.delete(item.href)
                                  return next
                                })
                              }
                            }}
                          >
                            <Link href={item.href} className="px-4 py-2.5">
                              <Icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        {isCollapsed && (
                          <TooltipContent side="right">
                            <p>{item.title}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </SidebarMenuItem>
                  )
                })}

                {filteredBusinessCollapsible.map((section) => {
                  const Icon = section.icon
                  const isAnyChildActive = section.items.some((item) => pathname === item.href)

                  return (
                    <Collapsible key={section.title} defaultOpen={section.defaultOpen} className="group/collapsible">
                      <SidebarMenuItem>
                        <Tooltip open={isCollapsed && openTooltips.has(section.title)}>
                          <TooltipTrigger asChild>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton
                                isActive={isAnyChildActive}
                                className={cn(
                                  "px-4 py-2.5",
                                  isAnyChildActive && "border-l-4 rounded-l-lg border-foreground dark:border-white",
                                )}
                                onMouseEnter={() => {
                                  if (isCollapsed) {
                                    setOpenTooltips((prev) => new Set(prev).add(section.title))
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (isCollapsed) {
                                    setOpenTooltips((prev) => {
                                      const next = new Set(prev)
                                      next.delete(section.title)
                                      return next
                                    })
                                  }
                                }}
                              >
                                <Icon className="h-4 w-4" />
                                <span>{section.title}</span>
                                <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                          </TooltipTrigger>
                          {isCollapsed && (
                            <TooltipContent side="right">
                              <p>{section.title}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {section.items.map((item) => {
                              const isActive = pathname?.startsWith(item.href) ?? false
                              return (
                                <SidebarMenuSubItem key={item.href}>
                                  <SidebarMenuSubButton asChild isActive={isActive} className="pl-8 py-2">
                                    <Link href={item.href}>{item.title}</Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              )
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                })}
              </TooltipProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-0.5" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase font-semibold text-muted-foreground px-4 py-2">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <TooltipProvider>
                {filteredSystemCollapsible.map((section) => {
                  const Icon = section.icon
                  const isAnyChildActive = section.items.some((item) => pathname === item.href)

                  return (
                    <Collapsible key={section.title} defaultOpen={section.defaultOpen} className="group/collapsible">
                      <SidebarMenuItem>
                        <Tooltip open={isCollapsed && openTooltips.has(section.title)}>
                          <TooltipTrigger asChild>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton
                                isActive={isAnyChildActive}
                                className={cn(
                                  "px-4 py-2.5",
                                  isAnyChildActive && "border-l-4 rounded-l-lg border-foreground dark:border-white",
                                )}
                                onMouseEnter={() => {
                                  if (isCollapsed) {
                                    setOpenTooltips((prev) => new Set(prev).add(section.title))
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (isCollapsed) {
                                    setOpenTooltips((prev) => {
                                      const next = new Set(prev)
                                      next.delete(section.title)
                                      return next
                                    })
                                  }
                                }}
                              >
                                <Icon className="h-4 w-4" />
                                <span>{section.title}</span>
                                <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                          </TooltipTrigger>
                          {isCollapsed && (
                            <TooltipContent side="right">
                              <p>{section.title}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {section.items.map((item) => {
                              const isActive = pathname?.startsWith(item.href) ?? false
                              return (
                                <SidebarMenuSubItem key={item.href}>
                                  <SidebarMenuSubButton asChild isActive={isActive} className="pl-8 py-2">
                                    <Link href={item.href}>{item.title}</Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              )
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                })}

                {filteredSystemItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname?.startsWith(item.href) ?? false
                  return (
                    <SidebarMenuItem key={item.href}>
                      <Tooltip open={isCollapsed && openTooltips.has(item.href)}>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className={cn(isActive && "border-l-4 rounded-l-lg border-foreground dark:border-white")}
                            onMouseEnter={() => {
                              if (isCollapsed) {
                                setOpenTooltips((prev) => new Set(prev).add(item.href))
                              }
                            }}
                            onMouseLeave={() => {
                              if (isCollapsed) {
                                setOpenTooltips((prev) => {
                                  const next = new Set(prev)
                                  next.delete(item.href)
                                  return next
                                })
                              }
                            }}
                          >
                            <Link href={item.href} className="px-4 py-2.5">
                              <Icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        {isCollapsed && (
                          <TooltipContent side="right">
                            <p>{item.title}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </SidebarMenuItem>
                  )
                })}

                {filteredSystemSettingsCollapsible.map((section) => {
                  const Icon = section.icon
                  const isAnyChildActive = section.items.some((item) => pathname === item.href)

                  return (
                    <Collapsible key={section.title} defaultOpen={section.defaultOpen} className="group/collapsible">
                      <SidebarMenuItem>
                        <Tooltip open={isCollapsed && openTooltips.has(section.title)}>
                          <TooltipTrigger asChild>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton
                                isActive={isAnyChildActive}
                                className={cn(
                                  "px-4 py-2.5",
                                  isAnyChildActive && "border-l-4 rounded-l-lg border-foreground dark:border-white",
                                )}
                                onMouseEnter={() => {
                                  if (isCollapsed) {
                                    setOpenTooltips((prev) => new Set(prev).add(section.title))
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (isCollapsed) {
                                    setOpenTooltips((prev) => {
                                      const next = new Set(prev)
                                      next.delete(section.title)
                                      return next
                                    })
                                  }
                                }}
                              >
                                <Icon className="h-4 w-4" />
                                <span>{section.title}</span>
                                <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                          </TooltipTrigger>
                          {isCollapsed && (
                            <TooltipContent side="right">
                              <p>{section.title}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {section.items.map((item) => {
                              const isActive = pathname?.startsWith(item.href) ?? false
                              return (
                                <SidebarMenuSubItem key={item.href}>
                                  <SidebarMenuSubButton asChild isActive={isActive} className="pl-8 py-2">
                                    <Link href={item.href}>{item.title}</Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              )
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                })}
              </TooltipProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 px-4 py-3 h-auto hover:bg-accent",
                isCollapsed && "justify-center px-2",
              )}
            >
              {!isCollapsed && (
                <>
                  <div className="relative shrink-0">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-sidebar" />
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
                </>
              )}
              {isCollapsed && (
                <div className="relative">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500 border border-sidebar" />
                </div>
              )}
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
            <DropdownMenuLabel className="text-xs text-muted-foreground px-2">Theme</DropdownMenuLabel>
            <div className="px-2 py-2">
              <ThemeToggleInline />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
