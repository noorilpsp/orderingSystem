"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { SortableCategoryContainer } from "./sortable-category-container"
import type { MenuItem, Category } from "@/types/menu-item"

interface CategoryDraggableListProps {
  categories: Category[]
  items: MenuItem[]
  onReorderCategories: (categories: Category[]) => void
  onMoveItemToCategory: (itemId: string, fromCategoryId: string, toCategoryId: string) => void
  onReorderItemsInCategory: (categoryId: string, items: MenuItem[]) => void
  renderItem: (item: MenuItem, isDragging: boolean) => React.ReactNode
  renderCategoryHeader: (category: Category) => React.ReactNode
  renderCategoryActions?: (category: Category) => React.ReactNode
  renderCategory?: (category: Category, isDragging: boolean) => React.ReactNode
  onCategoryToggle: (categoryId: string) => void
  onAddItemToCategory: (categoryId: string) => void
}

function preferItemCollisions(args: Parameters<CollisionDetection>[0]) {
  const pointerHits = pointerWithin(args)
  const collisions = pointerHits.length > 0 ? pointerHits : closestCorners(args)
  const itemHit = collisions.find((collision) => {
    const container = args.droppableContainers.find((droppable) => droppable.id === collision.id)
    return container?.data.current?.type === "item"
  })
  return itemHit ? [itemHit] : collisions
}

export function CategoryDraggableList({
  categories,
  items,
  onReorderCategories,
  onMoveItemToCategory,
  onReorderItemsInCategory,
  renderItem,
  renderCategoryHeader,
  renderCategoryActions,
  renderCategory,
  onCategoryToggle,
  onAddItemToCategory,
}: CategoryDraggableListProps) {
  const safeCategories = categories ?? []
  const safeItems = items ?? []
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<"category" | "item" | null>(null)
  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const getItemsForCategory = (categoryId: string) => {
    return safeItems
      .filter((item) => item.categories?.includes(categoryId))
      .sort((a, b) => {
        const aOrder = a.categoryOrders?.[categoryId]
        const bOrder = b.categoryOrders?.[categoryId]
        if (typeof aOrder === "number" && typeof bOrder === "number" && aOrder !== bOrder) {
          return aOrder - bOrder
        }
        return 0
      })
  }

  // Find which category an item belongs to
  const findCategoryForItem = (itemId: string) => {
    const item = safeItems.find((i) => i.id === itemId)
    if (!item || !item.categories || item.categories.length === 0) return null
    return item.categories[0] // Return first category
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setActiveId(active.id as string)

    // Determine if dragging a category or an item
    const isCategory = safeCategories.some((cat) => cat.id === active.id)
    setActiveType(isCategory ? "category" : "item")
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event

    if (!over) {
      setHoveredCategoryId(null)
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    if (activeType === "item") {
      // Check if hovering over a category container (droppable)
      const overCategory = safeCategories.find((cat) => cat.id === overId)
      if (overCategory) {
        setHoveredCategoryId(overCategory.id)
        return
      }
      
      // Check if hovering over an item, and get its category
      const overItem = safeItems.find((item) => item.id === overId)
      if (overItem && overItem.categories && overItem.categories.length > 0) {
        setHoveredCategoryId(overItem.categories[0])
        return
      }
      
      // If we can't determine the category, keep the previous hovered category
      // This prevents flickering when moving between items
    } else {
      setHoveredCategoryId(null)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    // Always reset state at the end
    const resetState = () => {
      setActiveId(null)
      setActiveType(null)
      setHoveredCategoryId(null)
    }

    if (!over) {
      resetState()
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    // Safety check: ensure we have a valid active type
    if (!activeType) {
      resetState()
      return
    }

    if (activeType === "category") {
      // Reordering categories
      const oldIndex = safeCategories.findIndex((cat) => cat.id === activeId)
      const newIndex = safeCategories.findIndex((cat) => cat.id === overId)

      if (oldIndex !== newIndex && oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(safeCategories, oldIndex, newIndex)
        onReorderCategories(reordered)
      }
    } else if (activeType === "item") {
      const activeCategory = findCategoryForItem(activeId)

      if (!activeCategory) {
        setActiveId(null)
        setActiveType(null)
        setHoveredCategoryId(null)
        return
      }

      // First, check if dropped directly on a category container (droppable)
      const targetCategory = safeCategories.find((cat) => cat.id === overId)
      
      if (targetCategory) {
        if (targetCategory.id !== activeCategory) {
          onMoveItemToCategory(activeId, activeCategory, targetCategory.id)
        } else {
          const categoryItemList = getItemsForCategory(activeCategory)
          const categoryItemIds = new Set(categoryItemList.map((item) => item.id))
          const overItemId = event.collisions
            ?.map((collision) => String(collision.id))
            .find((id) => categoryItemIds.has(id) && id !== activeId)

          if (overItemId) {
            const activeIndex = categoryItemList.findIndex((item) => item.id === activeId)
            const overIndex = categoryItemList.findIndex((item) => item.id === overItemId)
            if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
              onReorderItemsInCategory(activeCategory, arrayMove(categoryItemList, activeIndex, overIndex))
            }
          }
        }
      } else {
        // Check if dropped on an item
        const overItem = safeItems.find((item) => item.id === overId)

        if (overItem && overItem.categories && overItem.categories.length > 0) {
          const overItemCategory = overItem.categories[0]

          if (overItemCategory === activeCategory) {
            // Reordering within the same category
            const categoryItems = getItemsForCategory(activeCategory)
            const activeIndex = categoryItems.findIndex((item) => item.id === activeId)
            const overIndex = categoryItems.findIndex((item) => item.id === overId)

            if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
              const reordered = arrayMove(categoryItems, activeIndex, overIndex)
              onReorderItemsInCategory(activeCategory, reordered)
            }
          } else if (overItemCategory !== activeCategory) {
            // Moving to a different category via dropping on an item
            onMoveItemToCategory(activeId, activeCategory, overItemCategory)
          }
        }
        // If dropped on something that's not a category or item, do nothing
        // This prevents items from being moved to unexpected locations
      }
    }

    resetState()
  }

  const handleDragCancel = () => {
    // Reset all drag state when drag is cancelled
    // This prevents items from being moved when drag is interrupted
    setActiveId(null)
    setActiveType(null)
    setHoveredCategoryId(null)
  }

  // Get the active item or category for the drag overlay
  const activeItem = activeType === "item" ? safeItems.find((item) => item.id === activeId) : null
  const activeCategory = activeType === "category" ? safeCategories.find((cat) => cat.id === activeId) : null

  const activeCategoryId = activeType === "item" && activeId ? findCategoryForItem(activeId) : null

  // Render without DndContext on server to avoid hydration mismatch
  // This matches the structure of SortableCategoryContainer but without drag functionality
  if (!isMounted) {
    return (
      <div className="space-y-4">
        {safeCategories.map((category) => {
          const categoryItems = getItemsForCategory(category.id)
          return (
            <div key={category.id} className="border border-border rounded-xl bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-4 bg-muted">
                <div className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-muted-foreground/10 rounded transition-colors">
                  {/* Drag handle placeholder */}
                </div>
                <div className="flex-1 text-left">
                  {renderCategoryHeader(category)}
                </div>
                {renderCategoryActions && (
                  <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    {renderCategoryActions(category)}
                  </div>
                )}
              </div>
              {category.isExpanded && (
                <div className="px-6 py-4 space-y-3">
                  {categoryItems.map((item) => (
                    <div key={item.id}>{renderItem(item, false)}</div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={preferItemCollisions}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={safeCategories.map((cat) => cat.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">
          {safeCategories.map((category) => {
            const categoryItems = getItemsForCategory(category.id)
            const isHoveredByDifferentItem =
              activeType === "item" && hoveredCategoryId === category.id && activeCategoryId !== category.id

            return (
              <SortableCategoryContainer
                key={category.id}
                category={category}
                items={categoryItems}
                isExpanded={category.isExpanded}
                onToggle={() => onCategoryToggle(category.id)}
                onAddItem={() => onAddItemToCategory(category.id)}
                renderHeader={() => renderCategoryHeader(category)}
                renderActions={renderCategoryActions ? () => renderCategoryActions(category) : undefined}
                renderItem={renderItem}
                renderCategory={renderCategory}
                isDraggingOver={activeType === "item" && activeId !== null}
                isHoveredByDifferentItem={isHoveredByDifferentItem}
              />
            )
          })}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeItem && <div className="opacity-90 shadow-2xl">{renderItem(activeItem, true)}</div>}
        {activeCategory && (
          <div className="opacity-90 shadow-2xl border border-border rounded-xl bg-card p-4">
            {renderCategoryHeader(activeCategory)}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
