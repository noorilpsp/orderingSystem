"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import {
  Clock,
  Truck,
  ShoppingBag,
  Utensils,
  FolderOpen,
  Package,
  Calendar,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Eye,
} from "lucide-react"
import type { MenusContentProps } from "@/types/menu"
import { formatSchedule, formatTime, formatDate } from "@/lib/menu-utils"
import { DeleteConfirmationDialog } from "@/components/modals/delete-confirmation-dialog"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

export function MenusContent({
  menus,
  isLoading = false,
  holidayHours = [],
  onCreateMenu,
  onEditMenu,
  onDeleteMenu,
  onToggleActive,
  onDuplicateMenu,
  onViewItems,
  onAddHoliday,
  onEditHoliday,
  onDeleteHoliday,
}: MenusContentProps) {
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; menuId: string; menuName: string }>({
    isOpen: false,
    menuId: "",
    menuName: "",
  })
  const [deleteHolidayDialog, setDeleteHolidayDialog] = useState<{
    isOpen: boolean
    holidayId: string
    holidayDate: string
  }>({
    isOpen: false,
    holidayId: "",
    holidayDate: "",
  })

  const handleToggleActive = (id: string) => {
    onToggleActive(id)
    const menu = menus.find((m) => m.id === id)
    if (menu) {
      toast.success(`${menu.name} ${menu.isActive ? "deactivated" : "activated"}`)
    }
  }

  const handleDeleteMenu = (id: string, name: string) => {
    setDeleteDialog({ isOpen: true, menuId: id, menuName: name })
  }

  const confirmDeleteMenu = () => {
    onDeleteMenu(deleteDialog.menuId)
    setDeleteDialog({ isOpen: false, menuId: "", menuName: "" })
  }

  const handleDeleteHoliday = (id: string, date: string) => {
    setDeleteHolidayDialog({ isOpen: true, holidayId: id, holidayDate: date })
  }

  const confirmDeleteHoliday = () => {
    if (onDeleteHoliday) {
      onDeleteHoliday(deleteHolidayDialog.holidayId)
      toast.success("Holiday hours deleted")
    }
    setDeleteHolidayDialog({ isOpen: false, holidayId: "", holidayDate: "" })
  }

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case "delivery":
        return <Truck className="w-4 h-4" />
      case "pickup":
        return <ShoppingBag className="w-4 h-4" />
      case "dine-in":
        return <Utensils className="w-4 h-4" />
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mb-12">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-56" />
              <div className="flex gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-px w-full" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-9" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (menus.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <Clock className="w-24 h-24 text-gray-300 mb-6" />
          <h2 className="text-2xl font-semibold mb-2">No menus created yet</h2>
          <p className="text-gray-600 text-center max-w-md mb-8">
            Menus help you organize items by time of day. Create your first menu to get started.
          </p>
          <div className="flex gap-4">
            <Button onClick={onCreateMenu}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Menu
            </Button>
            <Button variant="ghost">Learn about menus</Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {menus.map((menu) => (
          <Card key={menu.id} className="relative p-6 hover:shadow-lg transition-shadow duration-300" role="article">
            {/* Active Badge */}
            <button
              onClick={() => handleToggleActive(menu.id)}
              className="absolute top-4 right-4"
              role="switch"
              aria-checked={menu.isActive}
            >
              <Badge
                variant={menu.isActive ? "default" : "secondary"}
                className={
                  menu.isActive
                    ? "bg-green-100 text-green-700 hover:bg-green-200 transition-colors duration-200"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors duration-200"
                }
              >
                {menu.isActive ? "🟢 Active" : "⏸ Inactive"}
              </Badge>
            </button>

            {/* Menu Name */}
            <h3 className="text-xl font-semibold mb-4 pr-24">{menu.name}</h3>

            {/* Schedule */}
            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2 text-gray-600">
                <Clock className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  {formatSchedule(menu.schedule).map((line, index) => (
                    <p key={index} className="text-sm">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {/* Order Types */}
            <div className="flex items-center gap-3 mb-4">
              {menu.orderTypes.map((type) => (
                <div key={type} className="flex items-center gap-1.5 text-sm text-gray-500">
                  {getOrderTypeIcon(type)}
                  <span className="capitalize">{type}</span>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FolderOpen className="w-4 h-4" />
                <span>
                  {menu.categoryCount} {menu.categoryCount === 1 ? "Category" : "Categories"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Package className="w-4 h-4" />
                <span>
                  {menu.itemCount} {menu.itemCount === 1 ? "Item" : "Items"}
                </span>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Actions */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => onEditMenu(menu.id)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Hours
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEditMenu(menu.id)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Menu
                  </DropdownMenuItem>
                  {onDuplicateMenu && (
                    <DropdownMenuItem onClick={() => onDuplicateMenu(menu.id)}>
                      <Copy className="w-4 h-4 mr-2" />
                      Duplicate Menu
                    </DropdownMenuItem>
                  )}
                  {onViewItems && (
                    <DropdownMenuItem onClick={() => onViewItems(menu.id)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Items
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDeleteMenu(menu.id, menu.name)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Menu
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Card>
        ))}
      </div>

      {/* Holiday Hours Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-2">Holiday Hours</h2>
        <p className="text-gray-600 mb-6">Set special hours for holidays that apply to all menus</p>

        <Card className="p-6">
          {holidayHours.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Calendar className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No holiday hours set</h3>
              <p className="text-gray-600 text-center max-w-md mb-6">
                Add custom hours for holidays when your restaurant has different availability
              </p>
              {onAddHoliday && (
                <Button onClick={onAddHoliday} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Holiday Hours
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-0">
              {holidayHours.map((holiday, index) => (
                <div
                  key={holiday.id}
                  className={`flex items-center justify-between py-4 ${
                    index !== holidayHours.length - 1 ? "border-b" : ""
                  }`}
                >
                  <div>
                    <p className="font-semibold mb-1">{formatDate(holiday.date)}</p>
                    {holiday.status === "closed" ? (
                      <p className="text-sm text-red-600">⛔ Closed All Day</p>
                    ) : (
                      <p className="text-sm text-blue-600">
                        🕐 Modified Hours:{" "}
                        {holiday.hours
                          ? `${formatTime(holiday.hours.split("-")[0])} - ${formatTime(holiday.hours.split("-")[1])}`
                          : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {onEditHoliday && (
                      <Button variant="ghost" size="sm" onClick={() => onEditHoliday(holiday.id)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    {onDeleteHoliday && (
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteHoliday(holiday.id, holiday.date)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {onAddHoliday && (
                <div className="pt-4">
                  <Button onClick={onAddHoliday} variant="outline" className="w-full bg-transparent">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Holiday Hours
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Delete Menu Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialog.isOpen}
        onOpenChange={(open) => !open && setDeleteDialog({ isOpen: false, menuId: "", menuName: "" })}
        onConfirm={confirmDeleteMenu}
        entityType="menu"
        entityName={deleteDialog.menuName}
      />

      {/* Delete Holiday Dialog */}
      <DeleteConfirmationDialog
        open={deleteHolidayDialog.isOpen}
        onOpenChange={(open) => !open && setDeleteHolidayDialog({ isOpen: false, holidayId: "", holidayDate: "" })}
        onConfirm={confirmDeleteHoliday}
        entityType="menu"
        entityName={formatDate(deleteHolidayDialog.holidayDate)}
      />
    </>
  )
}
