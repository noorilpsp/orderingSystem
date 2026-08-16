"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { ItemCard } from "@/components/item-card"
import { Toolbar } from "@/components/toolbar"
import { SelectionToolbar } from "@/components/selection-toolbar"
import { ItemDrawer } from "@/components/item-drawer"
import { BulkActionModal } from "@/components/bulk-action-modal"
import { DeleteConfirmationDialog } from "@/components/modals/delete-confirmation-dialog"
import { MenuImportModal } from "@/components/modals/menu-import-modal"
import { useMenu } from "../menu-context"
import type { MenuItem } from "@/types/menu-item"
import { toast } from "sonner"
import { downloadMenuItemsCsv } from "@/lib/menu/export-items"
import { useMerchantKdsEnabled } from "@/lib/hooks/useMerchantKdsEnabled"

const availableTags = ["Vegan", "Vegetarian", "Gluten-Free", "Spicy", "Popular", "New", "Chef's Pick"]

export default function MenuItemsPage() {
  const { items, categories, menus, locationId, createItem, updateItem, deleteItem, bulkUpdateItems, bulkDeleteItems, importItems } = useMenu()
  const { kdsEnabled } = useMerchantKdsEnabled()
  const searchParams = useSearchParams()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [view, setView] = useState<"grid" | "list">("grid")
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
  const [bulkActionModal, setBulkActionModal] = useState<{
    open: boolean
    action: "tags" | "change-status" | "categories" | "delete" | null
  }>({
    open: false,
    action: null,
  })
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    open: boolean
    item: MenuItem | null
  }>({
    open: false,
    item: null,
  })
  const [menuImportOpen, setMenuImportOpen] = useState(false)

  // Handle URL parameters for filtering
  useEffect(() => {
    const categoryParam = searchParams.get("category")
    const uncategorizedParam = searchParams.get("uncategorized")

    if (categoryParam) {
      // Filter by specific category
      setSelectedCategories([categoryParam])
      setSearchQuery("") // Clear search when filtering by category
    } else if (uncategorizedParam === "true") {
      // Filter for uncategorized items
      setSelectedCategories([]) // No categories selected means uncategorized
      setSearchQuery("") // Clear search when filtering uncategorized
    }
  }, [searchParams])

  // Real-time filtering with memoization for performance
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch =
          item.name.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.tags.some((tag) => tag.toLowerCase().includes(query))
        if (!matchesSearch) return false
      }

      // Status filter
      if (selectedStatus !== "All") {
        if (item.status !== selectedStatus.toLowerCase()) return false
      }

      // Categories filter
      if (selectedCategories.length > 0) {
        const hasMatchingCategory = selectedCategories.some((catId) => item.categories.includes(catId))
        if (!hasMatchingCategory) return false
      } else if (searchParams.get("uncategorized") === "true") {
        // Special case: filter for uncategorized items only
        if (item.categories && item.categories.length > 0) return false
      }

      // Tags filter
      if (selectedTags.length > 0) {
        const hasMatchingTag = selectedTags.some((tag) => item.tags.includes(tag))
        if (!hasMatchingTag) return false
      }

      return true
    })
  }, [items, searchQuery, selectedStatus, selectedCategories, selectedTags])

  const handleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]))
  }, [])

  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredItems.map((item) => item.id))
    }
  }, [selectedIds.length, filteredItems])

  const handleClearSelection = useCallback(() => {
    setSelectedIds([])
  }, [])

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
    async (itemData: Partial<MenuItem>) => {
      try {
        if (itemDrawer.item) {
          await updateItem(itemDrawer.item.id, itemData)
        } else {
          await createItem(itemData)
        }
        setItemDrawer({ open: false, item: null })
      } catch (error) {
        // Error is already handled by context, just re-throw so drawer knows
        throw error
      }
    },
    [itemDrawer.item, updateItem, createItem],
  )

  const handleDeleteItem = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id)
      deleteItem(id)
      toast.success(`${item?.name || "Item"} deleted`)
      setItemDrawer({ open: false, item: null })
    },
    [items, deleteItem],
  )

  const handleQuickAction = useCallback(
    async (action: string) => {
      if (selectedIds.length === 0) return

      try {
        if (action === "mark-live") {
          bulkUpdateItems(selectedIds, { status: "live" })
          toast.success(`${selectedIds.length} items marked as live`)
        } else if (action === "mark-soldout") {
          bulkUpdateItems(selectedIds, { status: "soldout" })
          toast.success(`${selectedIds.length} items marked as sold out`)
        } else if (action === "hide") {
          bulkUpdateItems(selectedIds, { status: "hidden" })
          toast.success(`${selectedIds.length} items hidden`)
        } else if (action === "duplicate") {
          // Duplicate selected items
          const itemsToDuplicate = items.filter((item) => selectedIds.includes(item.id))
          for (const item of itemsToDuplicate) {
            const duplicateData = {
              ...item,
              name: `${item.name} (Copy)`,
              status: "draft" as const,
            }
            createItem(duplicateData)
          }
          toast.success(`${selectedIds.length} items duplicated`)
        }
        setSelectedIds([])
      } catch (error) {
        toast.error("Failed to perform action")
      }
    },
    [selectedIds, bulkUpdateItems, items, createItem],
  )

  const handleMoreAction = useCallback((action: string) => {
    if (action.startsWith("status-") || action === "set-status") {
      setBulkActionModal({ open: true, action: "change-status" })
    } else if (action === "tags") {
      setBulkActionModal({ open: true, action: "tags" })
    } else if (action === "categories") {
      setBulkActionModal({ open: true, action: "categories" })
    } else if (action === "delete") {
      setBulkActionModal({ open: true, action: "delete" })
    }
  }, [])

  const handleBulkActionConfirm = useCallback(
    async (data: any) => {
      try {
        if (bulkActionModal.action === "tags") {
          const tagsToApply: string[] = Array.isArray(data.tags) ? data.tags : []
          if (tagsToApply.length === 0) {
            toast.error("Select at least one tag")
            return
          }
          const selectedItems = items.filter((item) => selectedIds.includes(item.id))
          for (const item of selectedItems) {
            const newTags = [...new Set([...item.tags, ...tagsToApply])]
            updateItem(item.id, { tags: newTags })
          }
          toast.success(`Updated tags for ${selectedIds.length} items`)
        } else if (bulkActionModal.action === "change-status") {
          bulkUpdateItems(selectedIds, { status: data.status })
          toast.success(`Status updated for ${selectedIds.length} items`)
        } else if (bulkActionModal.action === "categories") {
          const categoryIds: string[] = Array.isArray(data.categoryIds) ? data.categoryIds : []
          if (categoryIds.length === 0) {
            toast.error("Select at least one category")
            return
          }
          const selectedItems = items.filter((item) => selectedIds.includes(item.id))
          for (const item of selectedItems) {
            const newCategories = [...new Set([...item.categories, ...categoryIds])]
            updateItem(item.id, { categories: newCategories })
          }
          toast.success(`Updated categories for ${selectedIds.length} items`)
        } else if (bulkActionModal.action === "delete") {
          bulkDeleteItems(selectedIds)
          toast.success(`${selectedIds.length} items deleted`)
        }
        setSelectedIds([])
        setBulkActionModal({ open: false, action: null })
      } catch (error) {
        toast.error("Failed to perform bulk action")
      }
    },
    [bulkActionModal.action, selectedIds, items, updateItem, bulkUpdateItems, bulkDeleteItems],
  )

  const handleQuickActionItem = useCallback(
    (id: string, action: string) => {
      const item = items.find((i) => i.id === id)
      if (!item) return

      try {
        if (action === "edit") {
          // Open the item drawer for editing
          setItemDrawer({ open: true, item })
        } else if (action === "preview") {
          // Open the item drawer for viewing (read-only)
          setItemDrawer({ open: true, item })
        } else if (action === "duplicate") {
          const duplicateData = {
            ...item,
            name: `${item.name} (Copy)`,
            status: "draft" as const,
          }
          createItem(duplicateData)
          toast.success(`${item.name} duplicated`)
        } else if (action === "toggle-status") {
          const newStatus = item.status === "live" ? "hidden" : "live"
          updateItem(id, { status: newStatus })
          toast.success(`${item.name} ${newStatus === "live" ? "published" : "hidden"}`)
        } else if (action === "delete") {
          // Show confirmation dialog instead of deleting immediately
          setDeleteConfirmation({ open: true, item })
          return
        }
      } catch (error) {
        toast.error("Failed to perform action")
      }
    },
    [items, updateItem, createItem, setItemDrawer],
  )

  const handleConfirmDelete = useCallback(() => {
    if (deleteConfirmation.item) {
      deleteItem(deleteConfirmation.item.id)
      toast.success(`${deleteConfirmation.item.name} deleted`)
      setDeleteConfirmation({ open: false, item: null })
    }
  }, [deleteConfirmation.item, deleteItem])

  const handleExportCsv = useCallback(() => {
    if (items.length === 0) {
      toast.error("No items to export")
      return
    }
    downloadMenuItemsCsv(items, categories, kdsEnabled)
    toast.success(`Exported ${items.length} item${items.length === 1 ? "" : "s"}`)
  }, [items, categories, kdsEnabled])

  const selectedItems = items.filter((item) => selectedIds.includes(item.id))

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="px-6 pt-8 pb-6 border-b border-border">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Items</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Manage all your menu items, organize by categories, and set availability status
          </p>
        </div>

        <div className="p-6 space-y-6">
          <Toolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedView={view}
            onViewChange={setView}
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            selectedCategories={selectedCategories}
            onCategoriesChange={setSelectedCategories}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            onAddItem={handleCreateItem}
            onImportCsv={() => setMenuImportOpen(true)}
            onExportCsv={handleExportCsv}
            totalItems={filteredItems.length}
            categories={categories}
          />

          {/* Items Grid/List */}
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchQuery || selectedStatus !== "All" || selectedCategories.length > 0 || selectedTags.length > 0
                  ? "No items match your filters"
                  : "No items found"}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile View */}
              <div className="md:hidden space-y-4">
                {filteredItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    variant="mobile"
                    categories={categories}
                    isSelected={selectedIds.includes(item.id)}
                    selectionMode={selectedIds.length > 0}
                    onSelect={handleSelect}
                    onClick={handleItemClick}
                    onQuickAction={handleQuickActionItem}
                  />
                ))}
              </div>

              {/* Tablet & Desktop View */}
              <div
                className={
                  view === "grid"
                    ? "hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    : "hidden md:block space-y-3 max-w-5xl"
                }
              >
                {filteredItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    variant={view === "grid" ? "grid" : "list-large"}
                    categories={categories}
                    isSelected={selectedIds.includes(item.id)}
                    selectionMode={selectedIds.length > 0}
                    onSelect={handleSelect}
                    onClick={handleItemClick}
                    onQuickAction={handleQuickActionItem}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Selection Toolbar */}
      {selectedIds.length > 0 && (
        <SelectionToolbar
          selectedCount={selectedIds.length}
          totalCount={filteredItems.length}
          isAllSelected={selectedIds.length === filteredItems.length}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onQuickAction={handleQuickAction}
          onMoreAction={handleMoreAction}
        />
      )}

      {/* Item Drawer */}
      <ItemDrawer
        key={itemDrawer.item?.id || "new"}
        item={itemDrawer.item}
        isOpen={itemDrawer.open}
        onClose={() => setItemDrawer({ open: false, item: null })}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
        categories={categories}
      />

      {/* Bulk Action Modal */}
      <BulkActionModal
        open={bulkActionModal.open}
        onOpenChange={(open) => setBulkActionModal({ ...bulkActionModal, open })}
        action={bulkActionModal.action}
        selectedCount={selectedIds.length}
        selectedItems={selectedItems.map((item) => ({ id: item.id, name: item.name }))}
        availableTags={availableTags}
        availableCategories={categories}
        onConfirm={handleBulkActionConfirm}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteConfirmation.open}
        onOpenChange={(open) => setDeleteConfirmation({ ...deleteConfirmation, open })}
        onConfirm={handleConfirmDelete}
        entityType="item"
        entityName={deleteConfirmation.item?.name || "this item"}
      />

      <MenuImportModal
        open={menuImportOpen}
        onOpenChange={setMenuImportOpen}
        locationId={locationId}
        categories={categories}
        menus={menus}
        onImport={importItems}
      />
    </div>
  )
}
