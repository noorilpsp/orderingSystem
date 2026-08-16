"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Bell,
  Search,
  User,
  SettingsIcon,
  LogOut,
  ShoppingCart,
  CreditCard,
  Calendar,
  AlertTriangle,
  X,
} from "lucide-react"
import { MobileSidebar } from "@/components/mobile-sidebar"
import { Logo } from "@/components/logo"
import { LocationSelector } from "@/components/location-selector"
import { ThemeToggleInline } from "@/components/theme-toggle-inline"
import { cn } from "@/lib/utils"
import { logout } from "@/app/actions/auth"
import { clearUserData } from "@/lib/utils/logout"

const notifications = [
  {
    id: 1,
    title: "New order #1234 from Table 5",
    time: "2 min ago",
    icon: ShoppingCart,
    unread: true,
  },
  {
    id: 2,
    title: "Payment pending for order #1230",
    time: "15 min ago",
    icon: CreditCard,
    unread: true,
  },
  {
    id: 3,
    title: "Table 8 requested service",
    time: "20 min ago",
    icon: Bell,
    unread: true,
  },
  {
    id: 4,
    title: "Low stock alert: Chicken Breast",
    time: "1 hour ago",
    icon: AlertTriangle,
    unread: false,
  },
  {
    id: 5,
    title: "Reservation for 6 people at 7 PM",
    time: "2 hours ago",
    icon: Calendar,
    unread: false,
  },
]

const locations = [
  { name: "Downtown Location", orders: 3, tables: "8/15", status: "online", address: "123 Main St, Downtown" },
  { name: "Mall Branch", orders: 5, tables: "12/20", status: "online", address: "456 Mall Ave, Shopping District" },
  { name: "Airport Store", orders: 2, tables: "5/10", status: "closed", address: "789 Airport Rd, Terminal 2" },
]

export function DashboardHeader() {
  const pathname = usePathname()
  const [notificationList, setNotificationList] = React.useState(notifications)
  const [searchOpen, setSearchOpen] = React.useState(false)

  const handleLogout = async () => {
    // Clear all client-side user data before server-side logout
    clearUserData()
    // Server-side logout will redirect
    await logout()
  }
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedLocation, setSelectedLocation] = React.useState(locations[0])
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const unreadCount = notificationList.filter((n) => n.unread).length

  const markAllAsRead = () => {
    setNotificationList(notificationList.map((n) => ({ ...n, unread: false })))
  }

  const markAsRead = (id: number) => {
    setNotificationList(notificationList.map((n) => (n.id === id ? { ...n, unread: false } : n)))
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      {/* Left side: Mobile menu + Sidebar trigger + Logo */}
      <div className="md:hidden">
        <MobileSidebar />
      </div>
      <SidebarTrigger className="-ml-1 hidden md:flex" />
      <Separator orientation="vertical" className="mr-2 h-4 hidden md:block" />

      <Logo className="h-7 w-auto" />

      <div className="hidden md:block ml-4">
        <LocationSelector />
      </div>

      {/* Right side: Search, Notifications, User profile */}
      <div className="ml-auto flex items-center gap-2 md:gap-3">
        {/* Search - Desktop: full input, Mobile: icon with centered popover */}
        <div className="hidden md:block">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 h-9"
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
        </div>

        <div className="md:hidden">
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Search className="h-5 w-5" />
                <span className="sr-only">Search</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-3rem)] max-w-sm p-2" align="center" side="bottom">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
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
            </PopoverContent>
          </Popover>
        </div>

        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {unreadCount}
                </Badge>
              )}
              <span className="sr-only">Notifications</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[calc(100vw-3rem)] md:w-80 p-0"
            align={isMobile ? "end" : "end"}
            alignOffset={isMobile ? -8 : 0}
            side="bottom"
            sideOffset={isMobile ? -1 : 0}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-xs text-primary hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <ScrollArea className="max-h-96">
              <div className="divide-y">
                {notificationList.map((notification) => {
                  const NotifIcon = notification.icon
                  return (
                    <button
                      key={notification.id}
                      onClick={() => markAsRead(notification.id)}
                      className={cn(
                        "w-full p-4 text-left hover:bg-accent transition-colors flex items-start gap-3",
                        notification.unread && "bg-accent/50",
                      )}
                    >
                      <NotifIcon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{notification.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                      </div>
                      {notification.unread && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
            <div className="p-3 border-t">
              <button className="text-sm text-primary hover:underline w-full text-center">
                View all notifications
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src="/placeholder.svg?height=28&width=28" alt="John Doe" />
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-sm font-medium">John Doe</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">John Doe</p>
              <p className="text-xs text-muted-foreground">Owner</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="h-4 w-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <SettingsIcon className="h-4 w-4 mr-2" />
              Account Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground px-2">Theme</DropdownMenuLabel>
            <div className="px-2 py-2">
              <ThemeToggleInline />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
