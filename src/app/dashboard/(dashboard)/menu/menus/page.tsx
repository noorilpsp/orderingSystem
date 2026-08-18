"use client"

import { useState, useCallback, useMemo } from "react"
import { MenusContent } from "@/components/menus-content"
import { MenusToolbar } from "@/components/menus-toolbar"
import { CreateMenuDrawer } from "@/components/drawers/create-menu-drawer"
import { EditMenuDrawer } from "@/components/drawers/edit-menu-drawer"
import { useMenu } from "../menu-context"
import { toast } from "sonner"
import type { HolidayHours, Menu } from "@/types/menu"

const mockHolidays: HolidayHours[] = [
  { id: "1", date: "2025-12-25", status: "closed" },
  { id: "2", date: "2025-12-31", status: "modified", hours: "17:00-23:00" },
  { id: "3", date: "2026-01-01", status: "modified", hours: "10:00-18:00" },
]

export default function MenuMenusPage() {
  const { menus, loading, createMenu, updateMenu, deleteMenu, toggleMenuActive, duplicateMenu } = useMenu()
  const [holidayHours, setHolidayHours] = useState<HolidayHours[]>(mockHolidays)
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedView, setSelectedView] = useState<"grid" | "list">("grid")

  const filteredMenus = useMemo(() => {
    return menus.filter((menu) => menu.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [menus, searchQuery])

  const handleCreateMenu = useCallback(() => {
    setCreateDrawerOpen(true)
  }, [])

  const handleSaveMenu = useCallback(
    (menuData: {
      name: string
      schedule: Array<{
        days: number[]
        startTime: string
        endTime: string
      }>
      orderTypes: ("delivery" | "pickup" | "dine-in")[]
    }) => {
      const newMenu = {
        ...menuData,
        isActive: true,
      }
      createMenu(newMenu)
      setCreateDrawerOpen(false)
    },
    [createMenu],
  )

  const handleEditMenu = useCallback(
    (id: string) => {
      const menu = menus.find((m) => m.id === id)
      if (!menu) return

      setEditingMenu(menu)
      setEditDrawerOpen(true)
    },
    [menus],
  )

  const handleSaveMenuEdit = useCallback(
    (
      id: string,
      updates: {
        name: string
        schedule: Array<{
          days: number[]
          startTime: string
          endTime: string
        }>
        orderTypes: ("delivery" | "pickup" | "dine-in")[]
      },
    ) => {
      updateMenu(id, updates)
      setEditDrawerOpen(false)
      setEditingMenu(null)
    },
    [updateMenu],
  )

  const handleDeleteMenu = useCallback(
    (id: string) => {
      // Confirmation is already handled by DeleteConfirmationDialog in MenusContent
      deleteMenu(id)
    },
    [deleteMenu],
  )

  const handleToggleActive = useCallback(
    (id: string) => {
      toggleMenuActive(id)
    },
    [toggleMenuActive],
  )

  const handleDuplicateMenu = useCallback(
    (id: string) => {
      const menu = menus.find((m) => m.id === id)
      if (!menu) return

      duplicateMenu(id)
      toast.success(`${menu.name} duplicated`)
    },
    [menus, duplicateMenu],
  )

  const handleViewItems = useCallback((id: string) => {
    // Navigate to items page with menu filter
    // For now, just show a message
    toast.info("Navigate to items page with menu filter")
  }, [])

  const handleAddHoliday = useCallback(() => {
    const date = prompt("Enter holiday date (YYYY-MM-DD):")
    if (!date) return

    const status = confirm("Is this holiday closed all day? (OK = closed, Cancel = modified hours)")
    let hours = ""

    if (!status) {
      hours = prompt("Enter modified hours (HH:MM-HH:MM):") || ""
    }

    const newHoliday: HolidayHours = {
      id: Date.now().toString(),
      date,
      status: status ? "closed" : "modified",
      hours: status ? undefined : hours,
    }

    setHolidayHours((prev) => [...prev, newHoliday])
    toast.success("Holiday hours added")
  }, [])

  const handleEditHoliday = useCallback(
    (id: string) => {
      const holiday = holidayHours.find((h) => h.id === id)
      if (!holiday) return

      const newDate = prompt("Enter new date (YYYY-MM-DD):", holiday.date)
      if (!newDate || newDate === holiday.date) return

      setHolidayHours((prev) => prev.map((h) => (h.id === id ? { ...h, date: newDate } : h)))
      toast.success("Holiday updated")
    },
    [holidayHours],
  )

  const handleDeleteHoliday = useCallback(
    (id: string) => {
      const holiday = holidayHours.find((h) => h.id === id)
      if (!holiday) return

      const confirmDelete = confirm(`Are you sure you want to delete holiday hours for ${holiday.date}?`)
      if (!confirmDelete) return

      setHolidayHours((prev) => prev.filter((h) => h.id !== id))
      toast.success("Holiday hours deleted")
    },
    [holidayHours],
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-background">
        <div className="max-w-7xl mx-auto px-6 pt-8 pb-6 border-b border-border">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Menus</h1>
          <p className="text-sm text-muted-foreground mt-2">Manage your menus, schedules, and availability settings</p>
        </div>
      </div>

      <MenusToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedView={selectedView}
        onViewChange={setSelectedView}
        onAddMenu={handleCreateMenu}
        totalMenus={menus.length}
      />

      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <MenusContent
          menus={filteredMenus}
          isLoading={loading}
          holidayHours={holidayHours}
          onCreateMenu={handleCreateMenu}
          onEditMenu={handleEditMenu}
          onDeleteMenu={handleDeleteMenu}
          onToggleActive={handleToggleActive}
          onDuplicateMenu={handleDuplicateMenu}
          onViewItems={handleViewItems}
          onAddHoliday={handleAddHoliday}
          onEditHoliday={handleEditHoliday}
          onDeleteHoliday={handleDeleteHoliday}
        />

        <CreateMenuDrawer
          isOpen={createDrawerOpen}
          onClose={() => setCreateDrawerOpen(false)}
          onSave={handleSaveMenu}
        />

        <EditMenuDrawer
          key={editingMenu?.id || "new"}
          menu={editingMenu}
          isOpen={editDrawerOpen}
          onClose={() => {
            setEditDrawerOpen(false)
            setEditingMenu(null)
          }}
          onSave={handleSaveMenuEdit}
          onDelete={handleDeleteMenu}
        />
      </div>
    </div>
  )
}
