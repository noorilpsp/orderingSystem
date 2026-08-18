"use client"

import type React from "react"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import { DragHandle } from "./drag-handle"
import type { MenuItem, Category } from "@/types/menu-item"
import { SortableItem } from "./sortable-item"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

interface SortableCategoryContainerProps {
  category: Category
  items: MenuItem[]
  isExpanded?: boolean
  onToggle: () => void
  onAddItem: () => void
  renderHeader: () => React.ReactNode
  renderActions?: () => React.ReactNode
  renderItem: (item: MenuItem, isDragging: boolean) => React.ReactNode
  renderCategory?: (category: Category, isDragging: boolean) => React.ReactNode
  isDraggingOver: boolean
  isHoveredByDifferentItem?: boolean
}

export function SortableCategoryContainer({
  category,
  items,
  isExpanded = true,
  onToggle,
  onAddItem,
  renderHeader,
  renderActions,
  renderItem,
  renderCategory,
  isDraggingOver,
  isHoveredByDifferentItem = false,
}: SortableCategoryContainerProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: category.id,
    data: {
      type: "category",
      category,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  if (renderCategory) {
    return (
      <div
        ref={setSortableRef}
        style={style}
        className={cn(
          "transition-all duration-200",
          isDragging && "opacity-50 scale-[1.02] z-10",
          isHoveredByDifferentItem && "ring-2 ring-orange-400 dark:ring-orange-600 ring-offset-2 scale-[1.01]",
        )}
        {...attributes}
        {...listeners}
      >
        {renderCategory(category, isDragging)}
      </div>
    )
  }

  return (
    <div
      ref={setSortableRef}
      style={style}
      className={cn(
        "border border-border rounded-xl bg-card overflow-hidden transition-all duration-200",
        isDragging && "opacity-50 scale-[1.02] shadow-2xl z-10",
        isHoveredByDifferentItem &&
          "ring-2 ring-orange-400 dark:ring-orange-600 ring-offset-2 bg-orange-100/60 dark:bg-orange-950/40 border-orange-300 dark:border-orange-700 shadow-lg scale-[1.01]",
      )}
    >
      {/* Category Header with Drag Handle */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-4 bg-muted transition-colors duration-200",
          isHoveredByDifferentItem && "bg-orange-100/80 dark:bg-orange-950/60",
        )}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-muted-foreground/10 rounded transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <DragHandle isDragging={isDragging} />
        </div>
        <div className="flex-1 text-left cursor-pointer" onClick={onToggle}>
          {renderHeader()}
        </div>
        {renderActions && (
          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
            {renderActions()}
          </div>
        )}
      </div>

      {/* Items List */}
      {isExpanded && (
        <div className="min-h-[100px]">
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <div
              className={cn(
                "px-6 py-4 space-y-3 transition-colors duration-200",
                isHoveredByDifferentItem && "bg-orange-100/40 dark:bg-orange-950/30",
              )}
            >
              {items.length === 0 ? (
                <div
                  className={cn(
                    "text-center py-8 text-muted-foreground transition-colors duration-200",
                    isHoveredByDifferentItem && "text-orange-700 dark:text-orange-200 font-medium",
                  )}
                >
                  <p className="text-sm">No items in this category</p>
                  <p className="text-xs mt-1">
                    {isHoveredByDifferentItem
                      ? "Drop item here to add to category"
                      : "Drag items here or click below to add"}
                  </p>
                </div>
              ) : (
                items.map((item) => (
                  <SortableItem key={item.id} id={item.id} data={{ type: "item", item }}>
                    {(isDragging) => renderItem(item, isDragging)}
                  </SortableItem>
                ))
              )}
            </div>
          </SortableContext>

          {/* Add Item Button */}
          <div className="border-t border-border">
            <Button variant="ghost" className="w-full p-4 h-auto justify-start rounded-none" onClick={onAddItem}>
              <Plus className="w-5 h-5 mr-2" />
              Add item to {category.name}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
