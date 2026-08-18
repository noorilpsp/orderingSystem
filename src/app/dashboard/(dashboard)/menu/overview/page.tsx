"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { OverviewContent } from "@/components/overview-content"
import { Toolbar } from "@/components/toolbar"
import { ItemDrawer } from "@/components/item-drawer"
import { useMenu } from "../menu-context"
import { toast } from "sonner"
import React from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { MenuItem } from "@/types/menu-item"

const availableTags = ["Vegan", "Vegetarian", "Gluten-Free", "Spicy", "Popular", "New", "Chef's Pick"]

export default function MenuOverviewPage() {
  const { items, categories, loading, updateItem, reorderCategories, createItem, reorderItems } = useMenu()
  const searchParams = useSearchParams()
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(categories.map((c) => c.id)))
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("All")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [itemDrawer, setItemDrawer] = useState<{
    open: boolean
    item: MenuItem | null
  }>({
    open: false,
    item: null,
  })

  useEffect(() => {
    const categoryParam = searchParams.get("category")
    const uncategorizedParam = searchParams.get("uncategorized")

    if (categoryParam) {
      setSelectedCategories([categoryParam])
      setSearchQuery("")
    } else if (uncategorizedParam === "true") {
      setSelectedCategories([])
      setSearchQuery("")
    }
  }, [searchParams])

  const categoriesWithExpanded = useMemo(() => {
    return categories.map((cat) => ({
      ...cat,
      isExpanded: expandedCategories.has(cat.id),
    }))
  }, [categories, expandedCategories])

  const [hasInitialized, setHasInitialized] = useState(false)

  React.useEffect(() => {
    if (categories.length > 0 && expandedCategories.size === 0 && !hasInitialized) {
      setExpandedCategories(new Set(categories.map((c) => c.id)))
      setHasInitialized(true)
    }
  }, [categories, expandedCategories.size, hasInitialized])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch =
          item.name.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.tags.some((tag) => typeof tag === "string" && tag.toLowerCase().includes(query))
        if (!matchesSearch) return false
      }

      if (selectedStatus !== "All") {
        if (item.status !== selectedStatus.toLowerCase()) return false
      }

      if (selectedCategories.length > 0) {
        const hasMatchingCategory = selectedCategories.some((catId) => item.categories.includes(catId))
        if (!hasMatchingCategory) return false
      }

      if (selectedTags.length > 0) {
        const hasMatchingTag = selectedTags.some((tag) => item.tags.includes(tag))
        if (!hasMatchingTag) return false
      }

      return true
    })
  }, [items, searchQuery, selectedStatus, selectedCategories, selectedTags])

  const handleItemClick = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id)
      setItemDrawer({ open: true, item: item || null })
    },
    [items],
  )

  const handleCreateItem = useCallback(() => {
    setItemDrawer({ open: true, item: null })
  }, [])

  const handleSaveItem = useCallback(
    (itemData: Partial<MenuItem>) => {
      if (itemDrawer.item) {
        updateItem(itemDrawer.item.id, itemData)
        toast.success(`${itemData.name || "Item"} updated successfully`)
      } else {
        createItem(itemData)
        toast.success(`${itemData.name || "Item"} created successfully`)
      }
      setItemDrawer({ open: false, item: null })
    },
    [itemDrawer.item, updateItem, createItem],
  )

  const handleCategoryToggle = useCallback((id: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }, [])

  const handleToggleCollapse = useCallback(() => {
    setExpandedCategories((prev) => {
      if (prev.size === categories.length) {
        return new Set()
      }
      return new Set(categories.map((c) => c.id))
    })
  }, [categories])

  const handleAddItemToCategory = useCallback(
    (categoryId: string) => {
      const category = categories.find((c) => c.id === categoryId)
      if (!category) return
      const newItemWithCategory: Partial<MenuItem> = {
        name: "",
        description: "",
        price: 0,
        currency: "USD",
        status: "draft",
        categories: [categoryId],
        tags: [],
        dietaryTags: [],
        customizationGroups: [],
        availabilityMode: "menu-hours",
        customSchedule: [{ days: [], startTime: "7:00 AM", endTime: "11:00 AM" }],
        nutrition: {},
      }
      setItemDrawer({ open: true, item: newItemWithCategory as MenuItem })
    },
    [categories],
  )

  const handleReorderCategories = useCallback(
    (reorderedCategories: any[]) => {
      const cleanedCategories = reorderedCategories.map(({ isExpanded, ...category }) => category)
      reorderCategories(cleanedCategories)
    },
    [reorderCategories],
  )

  const handleReorderItems = useCallback(
    (categoryId: string, reorderedItems: MenuItem[]) => {
      reorderItems(reorderedItems, categoryId)
    },
    [reorderItems],
  )

  const handleMoveItemToCategory = React.useCallback(
    (itemId: string, fromCategoryId: string, toCategoryId: string) => {
      const item = items.find((i) => i.id === itemId)
      if (!item) return

      const updatedCategories = item.categories?.filter((catId) => catId !== fromCategoryId) || []
      if (!updatedCategories.includes(toCategoryId)) {
        updatedCategories.push(toCategoryId)
      }

      updateItem(itemId, { categories: updatedCategories })
      toast.success(`Moved ${item.name} to ${categories.find((c) => c.id === toCategoryId)?.name}`)
    },
    [items, categories, updateItem],
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="px-6 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Menu Items Overview</h1>
              <p className="text-sm text-muted-foreground mt-2">View and manage all your menu items by category</p>
            </div>
            <Button onClick={handleCreateItem} className="px-6">
              <Plus className="w-4 h-4 mr-2" />
              New Item
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <Toolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            selectedCategories={selectedCategories}
            onCategoriesChange={setSelectedCategories}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            isCollapsed={false}
            onToggleCollapse={handleToggleCollapse}
            onAddItem={handleCreateItem}
            totalItems={filteredItems.length}
            categories={categories}
          />

          <OverviewContent
            categories={categoriesWithExpanded}
            items={filteredItems}
            view="list"
            isLoading={loading}
            onItemClick={handleItemClick}
            onCategoryToggle={handleCategoryToggle}
            onAddItemToCategory={handleAddItemToCategory}
            onReorderCategories={handleReorderCategories}
            onReorderItems={handleReorderItems}
            onMoveItemToCategory={handleMoveItemToCategory}
          />
        </div>
      </div>

      <ItemDrawer
        item={itemDrawer.item}
        isOpen={itemDrawer.open}
        onClose={() => setItemDrawer({ open: false, item: null })}
        onSave={handleSaveItem}
        categories={categories}
      />
    </div>
  )
}
