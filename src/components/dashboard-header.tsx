"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SettingsIcon, LogOut } from "lucide-react"
import { MobileSidebar } from "@/components/mobile-sidebar"
import { Logo } from "@/components/logo"
import { ThemeToggleInline } from "@/components/theme-toggle-inline"
import { logout } from "@/app/actions/auth"
import { clearUserData } from "@/lib/utils/logout"
import { useDashboardUser } from "@/lib/hooks/useDashboardUser"

export function DashboardHeader() {
  const { name, roleLabel, initials } = useDashboardUser()

  const handleLogout = async () => {
    clearUserData()
    await logout()
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <div className="md:hidden">
        <MobileSidebar />
      </div>
      <SidebarTrigger className="-ml-1 hidden md:flex" />
      <Separator orientation="vertical" className="mr-2 h-4 hidden md:block" />

      <Logo className="h-7 w-auto" />

      <div className="ml-auto flex items-center gap-2 md:gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-sm font-medium">{name}</span>
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
