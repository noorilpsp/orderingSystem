"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  LayoutDashboard,
  Package,
  FolderOpen,
  Settings2,
  Calendar,
  Filter,
  Upload,
  Download,
  Image,
  MousePointer,
  Navigation,
  Layers,
  Palette,
  Smile,
} from "lucide-react"

const demoPages = [
  {
    title: "Overview",
    description: "Category-based menu overview with expandable sections",
    href: "/dashboard/demos/overview",
    icon: LayoutDashboard,
    category: "Core Components",
  },
  {
    title: "Menu Items",
    description: "ItemCard component with grid, list, and mobile variants",
    href: "/dashboard/demos/menu-items",
    icon: Package,
    category: "Core Components",
  },
  {
    title: "Categories",
    description: "Category management with drag-and-drop reordering",
    href: "/dashboard/demos/categories",
    icon: FolderOpen,
    category: "Core Components",
  },
  {
    title: "Customizations",
    description: "Customization groups with options and pricing",
    href: "/dashboard/demos/customizations",
    icon: Settings2,
    category: "Core Components",
  },
  {
    title: "Menus",
    description: "Menu schedules and holiday hours management",
    href: "/dashboard/demos/menus",
    icon: Calendar,
    category: "Core Components",
  },
  {
    title: "Design System",
    description: "StatusChip, PriceBadge, TagChip, and EmptyState components",
    href: "/dashboard/demos/design-system",
    icon: Palette,
    category: "UI Components",
  },
  {
    title: "Advanced Filters",
    description: "Comprehensive filtering system with presets and real-time results",
    href: "/dashboard/demos/advanced-filters-demo",
    icon: Filter,
    category: "Advanced Features",
  },
  {
    title: "Bulk Operations",
    description: "Multi-select operations with selection toolbar and bulk actions",
    href: "/dashboard/demos/bulk-operations-demo",
    icon: MousePointer,
    category: "Advanced Features",
  },
  {
    title: "Item Drawer",
    description: "Comprehensive drawer for editing menu items with three tabs",
    href: "/dashboard/demos/item-drawer-demo",
    icon: Package,
    category: "Advanced Features",
  },
  {
    title: "Modals Suite",
    description: "Create and edit modals for items, categories, and menus",
    href: "/dashboard/demos/modals-demo",
    icon: Layers,
    category: "Advanced Features",
  },
  {
    title: "Navigation & Controls",
    description: "MenuTabs and Toolbar components with search and filters",
    href: "/dashboard/demos/navigation-demo",
    icon: Navigation,
    category: "Advanced Features",
  },
  {
    title: "Drag & Drop",
    description: "Reorderable lists with smooth animations and keyboard support",
    href: "/dashboard/demos/drag-and-drop-demo",
    icon: MousePointer,
    category: "Advanced Features",
  },
  {
    title: "Import/Export",
    description: "Bulk data management with wizard and progress tracking",
    href: "/dashboard/demos/import-export-demo",
    icon: Upload,
    category: "Data Management",
  },
  {
    title: "Photo Management",
    description: "Photo upload with approval workflow and guidelines",
    href: "/dashboard/demos/photo-management-demo",
    icon: Image,
    category: "Data Management",
  },
  {
    title: "Advanced Customizations",
    description: "Conditional pricing, quantities, and secondary groups",
    href: "/dashboard/demos/advanced-customizations-demo",
    icon: Settings2,
    category: "Advanced Features",
  },
  {
    title: "Category Selector",
    description: "Searchable multi-select category filter with chips and keyboard accessibility",
    href: "/dashboard/demos/category-selector-demo",
    icon: Filter,
    category: "UI Components",
  },
  {
    title: "Emoji Input",
    description: "Emoji picker with initials support and search functionality",
    href: "/dashboard/demos/emoji-input-demo",
    icon: Smile,
    category: "UI Components",
  },
  {
    title: "Menu Drawer",
    description: "Right-side drawer for creating and editing menus with schedules",
    href: "/dashboard/demos/menu-drawer-demo",
    icon: Calendar,
    category: "Advanced Features",
  },
  {
    title: "Category Drawer",
    description: "Right-side drawer for creating and editing categories with emoji support",
    href: "/dashboard/demos/category-drawer-demo",
    icon: FolderOpen,
    category: "Advanced Features",
  },
  {
    title: "Customization Drawer",
    description: "Right-side drawer for creating and editing customization groups with options",
    href: "/dashboard/demos/customization-drawer-demo",
    icon: Settings2,
    category: "Advanced Features",
  },
]

const categories = ["Core Components", "UI Components", "Advanced Features", "Data Management"]

export default function DemosPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Component Demos</h1>
          <p className="text-gray-600">
            Interactive demonstrations of all menu management components and features
          </p>
        </div>

        {categories.map((category) => {
          const categoryDemos = demoPages.filter((demo) => demo.category === category)
          
          return (
            <div key={category} className="mb-12">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categoryDemos.map((demo) => {
                  const Icon = demo.icon
                  return (
                    <Link key={demo.href} href={demo.href}>
                      <Card className="h-full hover:shadow-lg transition-shadow duration-200 cursor-pointer">
                        <CardHeader>
                          <div className="flex items-center gap-3">
                            <Icon className="w-6 h-6 text-orange-600" />
                            <CardTitle className="text-lg">{demo.title}</CardTitle>
                          </div>
                          <CardDescription>{demo.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Badge variant="outline" className="text-xs">
                            Demo
                          </Badge>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Production Menu Manager</h3>
          <p className="text-blue-800 mb-4">
            All these components are now integrated into the unified menu management system.
          </p>
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Go to Menu Manager
          </Link>
        </div>
      </div>
    </div>
  )
}
