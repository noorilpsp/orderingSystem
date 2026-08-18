export interface Menu {
  id: string
  name: string
  schedule: Array<{
    days: number[] // 0=Sunday, 1=Monday, etc.
    startTime: string
    endTime: string
  }>
  orderTypes: ("delivery" | "pickup" | "dine-in")[]
  categoryCount: number
  itemCount: number
  isActive: boolean
}

export interface HolidayHours {
  id: string
  date: string // ISO date string
  status: "closed" | "modified"
  hours?: string // e.g., "17:00-23:00"
}

export interface MenusContentProps {
  menus: Menu[]
  isLoading?: boolean
  holidayHours?: HolidayHours[]
  onCreateMenu: () => void
  onEditMenu: (id: string) => void
  onDeleteMenu: (id: string) => void
  onToggleActive: (id: string) => void
  onDuplicateMenu?: (id: string) => void
  onViewItems?: (id: string) => void
  onAddHoliday?: () => void
  onEditHoliday?: (id: string) => void
  onDeleteHoliday?: (id: string) => void
}
