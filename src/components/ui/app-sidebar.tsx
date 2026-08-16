"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Store,
  ShoppingCart,
  Menu,
  UserCircle,
  BarChart3,
  Settings,
  ChevronDown,
  MapPin,
  Search,
  X,
  Megaphone,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { unlockIncomingOrderAlertAudio } from "@/lib/orders/incoming-order-alert-sound"
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

const operationsItems = [
  { title: "Home", href: "/dashboard", icon: Home },
  {
    title: "Orders",
    href: "/orders",
    icon: ShoppingCart,
    badge: "5",
    badgeVariant: "destructive" as const,
  },
]

const businessItems = [
  { title: "Menu", href: "/menu", icon: Menu },
]

const businessCollapsible = [
  {
    title: "Marketing",
    icon: Megaphone,
    defaultOpen: false,
    items: [
      { title: "Promotions", href: "/promotions" },
      { title: "Loyalty / Rewards", href: "/loyalty" },
      { title: "Campaigns", href: "/campaigns" },
    ],
  },
  {
    title: "Analytics",
    icon: BarChart3,
    defaultOpen: false,
    items: [
      { title: "Reports", href: "/reports" },
      { title: "Performance", href: "/performance" },
      { title: "Customer Insights", href: "/customer-insights" },
      { title: "Downloads", href: "/downloads" },
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

const locations = [
  { name: "Downtown Location", orders: 3, tables: "8/15", status: "online", address: "123 Main St, Downtown" },
  { name: "Mall Branch", orders: 5, tables: "12/20", status: "online", address: "456 Mall Ave, Shopping District" },
  { name: "Airport Store", orders: 2, tables: "5/10", status: "closed", address: "789 Airport Rd, Terminal 2" },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [selectedLocation, setSelectedLocation] = React.useState(locations[0])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchExpanded, setSearchExpanded] = React.useState(false)
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  const [openTooltips, setOpenTooltips] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    if (isCollapsed) {
      setOpenTooltips(new Set())
      setSearchExpanded(false)
    }
  }, [isCollapsed])

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
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className={cn("flex items-center gap-1", isCollapsed && "mx-0")}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "bg-transparent flex-1",
                        isCollapsed ? "justify-center px-0 h-8 w-8" : "justify-between",
                      )}
                    >
                      {!isCollapsed && (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <MapPin className="h-4 w-4 shrink-0" />
                            <span className="text-sm font-medium truncate">{selectedLocation.name}</span>
                          </div>
                          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                        </>
                      )}
                      {isCollapsed && <MapPin className="h-3.5 w-3.5 shrink-0" />}
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
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  <p>{selectedLocation.name}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {!isCollapsed && (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 bg-transparent"
              onClick={() => setSearchExpanded(!searchExpanded)}
            >
              <Search className="h-4 w-4" />
            </Button>
          )}
        </div>

        {!isCollapsed && searchExpanded && (
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
                  const isActive = pathname === item.href
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
                            <Link
                              href={item.href}
                              className="px-4 py-2.5"
                              onPointerDown={() => {
                                if (item.href === "/orders") {
                                  void unlockIncomingOrderAlertAudio()
                                }
                              }}
                            >
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
                  const isActive = pathname === item.href
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
                              const isActive = pathname === item.href
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
                              const isActive = pathname === item.href
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
                  const isActive = pathname === item.href
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
                              const isActive = pathname === item.href
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
                      <AvatarImage src="/placeholder.svg?height=36&width=36" alt="John Doe" />
                      <AvatarFallback>JD</AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-sidebar" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium">John Doe · Owner</p>
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
                    <AvatarImage src="/placeholder.svg?height=28&width=28" alt="John Doe" />
                    <AvatarFallback className="text-xs">JD</AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500 border border-sidebar" />
                </div>
              )}
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
            <DropdownMenuLabel className="text-xs text-muted-foreground px-2">Theme</DropdownMenuLabel>
            <div className="px-2 py-2">
              <ThemeToggleInline />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
