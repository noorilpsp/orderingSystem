"use client"

import { useState, useCallback, useMemo } from "react"
import { CategoriesContent } from "@/components/categories-content"
import { CategoriesToolbar } from "@/components/categories-toolbar"
import { CreateCategoryDrawer } from "@/components/drawers/create-category-drawer"
import { EditCategoryDrawer } from "@/components/drawers/edit-category-drawer"
// import { DeleteCategoryDialog } from "@/components/modals/delete-category-dialog"
import { useMenu } from "../menu-context"
import type { Category } from "@/types/category"
import type { CatalogI18n } from "@/lib/catalog-i18n"

export default function MenuCategoriesPage() {
  const { categories, items, menus = [], createCategory, updateCategory, deleteCategory, reorderCategories } = useMenu()
  const [isLoading, setIsLoading] = useState(false)
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  // Removed complex dialog state - using simple browser confirm instead

  // Calculate uncategorized items count
  const uncategorizedCount = items.filter((item) => !item.categories || item.categories.length === 0).length

  // Removed complex dialog cleanup - using simple browser confirm instead

  const mapMenuIdsToNames = useCallback(
    (menuIds: string[] = []) =>
      menuIds.map((id) => menus.find((menu) => menu.id === id)?.name).filter((name): name is string => Boolean(name)),
    [menus],
  )

  const categoriesForDisplay = useMemo(
    () =>
      categories.map((category) => {
        const resolvedMenuNames = mapMenuIdsToNames(category.menuIds)
        const hasResolvedNames = resolvedMenuNames.length > 0 || category.menuIds.length === 0

        // Calculate actual item count from items data
        const actualItemCount = items.filter((item) => item.categories && item.categories.includes(category.id)).length

        return {
          ...category,
          itemCount: actualItemCount,
          menuNames: hasResolvedNames ? resolvedMenuNames : (category.menuNames ?? []),
        }
      }),
    [categories, mapMenuIdsToNames, items],
  )

  const handleOpenCreateDrawer = useCallback(() => {
    setCreateDrawerOpen(true)
  }, [])

  const handleCreateCategory = useCallback(
    (categoryData: {
      name: string
      description?: string
      menuIds: string[]
      emoji?: string
      i18n?: CatalogI18n | null
    }) => {
      const newCategory = {
        ...categoryData,
        displayOrder: categories.length + 1,
        menuNames: mapMenuIdsToNames(categoryData.menuIds),
      }
      createCategory(newCategory)
      setCreateDrawerOpen(false)
    },
    [categories.length, createCategory, mapMenuIdsToNames],
  )

  const handleEditCategory = useCallback(
    (id: string) => {
      const category = categories.find((c) => c.id === id)
      if (!category) return

      setEditingCategory(category)
      setEditDrawerOpen(true)
    },
    [categories],
  )

  const handleSaveCategory = useCallback(
    async (
      id: string,
      updates: {
        name: string
        description?: string
        menuIds: string[]
        emoji?: string
        i18n?: CatalogI18n | null
      },
    ) => {
      try {
        // Find the current category to preserve displayOrder
        const currentCategory = categories.find((c) => c.id === id)
        await updateCategory(id, {
          ...updates,
          displayOrder: currentCategory?.displayOrder, // Preserve existing order
          menuNames: mapMenuIdsToNames(updates.menuIds),
        })
        setEditDrawerOpen(false)
        setEditingCategory(null)
      } catch (error) {
        // Error is already handled in updateCategory, just re-throw so drawer can handle it
        throw error
      }
    },
    [categories, mapMenuIdsToNames, updateCategory],
  )

  const handleDeleteCategory = useCallback(
    (id: string) => {
      const category = categories.find((c) => c.id === id)
      if (!category) return

      deleteCategory(id)
    },
    [categories, deleteCategory],
  )

  // Removed complex delete confirmation - using simple browser confirm instead

  const handleReorder = useCallback(
    (reorderedCategories: Category[]) => {
      // Normalize categories and let the context handle optimistic updates
      const normalizedCategories = reorderedCategories.map((category: Category) => ({
        ...category,
        menuNames: mapMenuIdsToNames(category.menuIds),
      }))
      reorderCategories(normalizedCategories)
    },
    [mapMenuIdsToNames, reorderCategories],
  )

  const filteredCategories = useMemo(
    () =>
      categoriesForDisplay.filter(
        (cat) =>
          cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cat.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [categoriesForDisplay, searchQuery],
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="px-6 pt-8 pb-6 border-b border-border">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground mt-2">Manage your menu categories and organize items</p>
        </div>

        <div className="p-6 space-y-6">
          <CategoriesToolbar
            onCreateCategory={handleOpenCreateDrawer}
            onSearch={setSearchQuery}
            totalCategories={categories.length}
          />

          <CategoriesContent
            categories={filteredCategories}
            items={items}
            onCreateCategory={handleOpenCreateDrawer}
            onEditCategory={handleEditCategory}
            onDeleteCategory={handleDeleteCategory}
            onReorder={handleReorder}
            uncategorizedCount={uncategorizedCount}
            isLoading={isLoading}
          />
        </div>
      </div>

      <CreateCategoryDrawer
        isOpen={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
        menus={menus || []}
        onSave={handleCreateCategory}
      />

      <EditCategoryDrawer
        category={editingCategory}
        isOpen={editDrawerOpen}
        menus={menus || []}
        onClose={() => {
          setEditDrawerOpen(false)
          setEditingCategory(null)
        }}
        onSave={handleSaveCategory}
        onDelete={handleDeleteCategory}
      />
    </div>
  )
}
