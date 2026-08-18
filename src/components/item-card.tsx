"use client"

import type React from "react"

import { useState } from "react"
import Image from "next/image"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { StatusChip } from "@/components/status-chip"
import { PriceBadge } from "@/components/price-badge"
import { TagChip } from "@/components/tag-chip"
import { MoreVertical, Edit, Copy, Eye, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MenuItem } from "@/types/menu-item"
import type { Category } from "@/types/category"

interface ItemCardProps {
  item: MenuItem
  variant: "grid" | "list" | "list-large" | "mobile"
  categories?: Category[]
  isSelected?: boolean
  selectionMode?: boolean
  onSelect?: (id: string) => void
  onClick?: (id: string) => void
  onQuickAction?: (id: string, action: string) => void
}

export function ItemCard({
  item,
  variant,
  categories = [],
  isSelected = false,
  selectionMode = false,
  onSelect,
  onClick,
  onQuickAction,
}: ItemCardProps) {
  const [imageHovered, setImageHovered] = useState(false)
  const [cardHovered, setCardHovered] = useState(false) // Track card hover state
  const isSoldOut = item.status === "soldout"
  const caloriesLabel = item.nutrition?.calories ? `${item.nutrition.calories} cal` : null

  // Helper function to get category name from ID
  const getCategoryName = (categoryId: string) => {
    if (!categories || !Array.isArray(categories)) return categoryId
    const category = categories.find((cat) => cat.id === categoryId)
    return category?.name || categoryId
  }

  const getDietaryEmoji = (tag: string) => {
    const emojiMap: Record<string, string> = {
      vegetarian: "🥬",
      vegan: "🌱",
      "gluten-free": "🌾",
      "dairy-free": "🥛",
      "nut-free": "🥜",
      "sugar-free": "🍯",
      keto: "🥑",
      paleo: "🥩",
      "low-carb": "🥗",
      "high-protein": "💪",
      organic: "🌿",
      raw: "🥕",
      halal: "☪️",
      kosher: "✡️",
    }
    return emojiMap[tag.toLowerCase()] || "🥗"
  }

  const getAllergenEmoji = (allergen: string) => {
    const emojiMap: Record<string, string> = {
      nuts: "🥜",
      dairy: "🥛",
      shellfish: "🦐",
      gluten: "🌾",
      soy: "🫘",
      eggs: "🥚",
      peanuts: "🥜",
      "tree nuts": "🌰",
      fish: "🐟",
      sesame: "🌰",
      mustard: "🌶️",
      celery: "🥬",
      lupin: "🫘",
      molluscs: "🐚",
    }
    return emojiMap[allergen.toLowerCase()] || "⚠️"
  }

  const getAttributeEmoji = (tag: string) => {
    const emojiMap: Record<string, string> = {
      spicy: "🌶️",
      popular: "🔥",
      new: "✨",
      "chef-pick": "👨‍🍳",
      "chef's pick": "👨‍🍳",
      "chefs pick": "👨‍🍳",
    }
    return emojiMap[tag.toLowerCase()] || "🏷️"
  }

  /**
   * If the tag/allergen name starts with an emoji (e.g. "🔥 Hot"),
   * split it into { icon, label }. Otherwise fall back to the map lookup.
   */
  const parseTagDisplay = (
    name: string,
    fallbackIcon: (s: string) => string,
  ): { icon: string; label: string } => {
    const match = name.match(/^(\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*)\s*/u)
    if (match) {
      return { icon: match[1] ?? match[0].trim(), label: name.slice(match[0].length).trim() || name }
    }
    return { icon: fallbackIcon(name), label: name }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger onClick if clicking on interactive elements
    const target = e.target as HTMLElement
    if (target.closest("button") || target.closest("[role=checkbox]") || target.closest("[data-dropdown-trigger]")) {
      return
    }
    onClick?.(item.id)
  }

  const handleQuickAction = (e: React.MouseEvent, action: string) => {
    e.stopPropagation()
    onQuickAction?.(item.id, action)
  }

  const showCheckbox = selectionMode || cardHovered || isSelected || (variant === "mobile" && onSelect)

  // Grid Variant (Desktop ≥1024px)
  if (variant === "grid") {
    return (
      <Card
        className={cn(
          "w-[300px] overflow-hidden rounded-xl border transition-all duration-200 hover:shadow-lg cursor-pointer",
          isSelected && "border-primary bg-primary/5 ring-1 ring-primary/20",
          isSoldOut && "opacity-70",
          selectionMode && "hover:border-slate-700",
        )}
        onClick={handleCardClick}
        onMouseEnter={() => setCardHovered(true)} // Track hover
        onMouseLeave={() => setCardHovered(false)} // Track hover
      >
        {/* Image Section */}
        <div
          className="relative aspect-square overflow-hidden"
          onMouseEnter={() => setImageHovered(true)}
          onMouseLeave={() => setImageHovered(false)}
        >
          <Image
            src={item.image || "/placeholder.svg?height=300&width=300"}
            alt={item.name}
            fill
            className={cn(
              "object-cover transition-transform duration-300",
              imageHovered && "scale-105",
              isSoldOut && "grayscale",
            )}
            loading="lazy"
          />

          {/* Status Chip - Top Right */}
          <div className="absolute top-2 right-2">
            <StatusChip status={item.status} size="sm" />
          </div>

          {/* Sold Out Overlay */}
          {isSoldOut && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
              <div className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold text-lg">Sold Out</div>
              {item.soldOutUntil && (
                <div className="text-white text-sm mt-2">
                  Until:{" "}
                  {item.soldOutUntil instanceof Date
                    ? item.soldOutUntil.toLocaleDateString()
                    : new Date(item.soldOutUntil).toLocaleDateString()}
                </div>
              )}
            </div>
          )}

          {/* Quick Actions Overlay - Shows on Hover */}
          {imageHovered &&
            !isSoldOut &&
            !selectionMode && ( // Hide in selection mode
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-4 transition-opacity duration-200">
                <button
                  onClick={(e) => handleQuickAction(e, "edit")}
                  className="p-3 bg-white rounded-full hover:bg-blue-50 hover:shadow-md transition-all duration-200 cursor-pointer group"
                  aria-label="Edit item"
                >
                  <Edit className="w-5 h-5 text-gray-900 group-hover:text-blue-600 transition-colors duration-200" />
                </button>
                <button
                  onClick={(e) => handleQuickAction(e, "preview")}
                  className="p-3 bg-white rounded-full hover:bg-green-50 hover:shadow-md transition-all duration-200 cursor-pointer group"
                  aria-label="Preview item"
                >
                  <Eye className="w-5 h-5 text-gray-900 group-hover:text-green-600 transition-colors duration-200" />
                </button>
                <button
                  onClick={(e) => handleQuickAction(e, "duplicate")}
                  className="p-3 bg-white rounded-full hover:bg-purple-50 hover:shadow-md transition-all duration-200 cursor-pointer group"
                  aria-label="Duplicate item"
                >
                  <Copy className="w-5 h-5 text-gray-900 group-hover:text-purple-600 transition-colors duration-200" />
                </button>
              </div>
            )}

          {/* Checkbox - Top Left */}
          {onSelect && showCheckbox && (
            <div
              className={cn(
                "absolute top-2 left-2 transition-all duration-150",
                !isSelected && !cardHovered && "opacity-0 scale-80",
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect(item.id)}
                aria-label={`Select ${item.name}`}
                className="bg-white border-2 border-gray-300 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900 w-5 h-5 min-h-0 min-w-0" // gray-900 checkbox
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="p-4 space-y-3">
          {/* Name */}
          <h3 className="text-lg font-semibold text-foreground line-clamp-2">{item.name}</h3>

          {/* Description */}
          {item.description && <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>}

          {/* Categories */}
          {item.categories && item.categories.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {item.categories &&
                Array.isArray(item.categories) &&
                item.categories.map((categoryId, index) => {
                  const category =
                    categories && Array.isArray(categories) ? categories.find((cat) => cat.id === categoryId) : null
                  return (
                    <Badge key={index} variant="outline" className="text-xs flex items-center gap-1">
                      {category?.emoji && <span>{category.emoji}</span>}
                      <span>{getCategoryName(categoryId)}</span>
                    </Badge>
                  )
                })}
            </div>
          )}

          {/* All Tags */}
          <div className="flex flex-wrap gap-1.5">
            {/* Dietary Tags */}
            {item.dietaryTags &&
              item.dietaryTags.map((tag, index) => {
                const { icon, label } = parseTagDisplay(tag, getDietaryEmoji)
                return <TagChip key={`dietary-${index}`} label={label} variant="dietary" icon={icon} />
              })}

            {/* Allergens */}
            {item.nutrition?.allergens &&
              item.nutrition.allergens.map((allergen, index) => {
                const { icon, label } = parseTagDisplay(allergen, getAllergenEmoji)
                return <TagChip key={`allergen-${index}`} label={label} variant="allergen" icon={icon} />
              })}

            {/* Attribute Tags */}
            {item.tags.slice(0, 3).map((tag, index) => {
              const raw = typeof tag === "string" ? tag : (tag as any).label
              const { icon, label } = parseTagDisplay(raw, getAttributeEmoji)
              return <TagChip key={`tag-${index}`} label={label} variant="attribute" icon={icon} />
            })}

            {/* Show more if there are additional tags */}
            {item.tags.length > 3 && <TagChip label={`+${item.tags.length - 3} more`} variant="custom" />}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <PriceBadge price={item.price} currency={item.currency} />
              {caloriesLabel && <span className="text-xs text-muted-foreground">{caloriesLabel}</span>}
            </div>

            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild data-dropdown-trigger>
                <button
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-900/40 hover:shadow-sm rounded-lg transition-all duration-200 group" // slate hover background
                  aria-label="More actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-5 h-5 text-muted-foreground group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors duration-200" />{" "}
                  {/* slate hover colors */}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => handleQuickAction(e, "view")}>
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => handleQuickAction(e, "edit")}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => handleQuickAction(e, "duplicate")}>
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => handleQuickAction(e, isSoldOut ? "mark-live" : "mark-soldout")}>
                  {isSoldOut ? "Mark Live" : "Mark Sold Out"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => handleQuickAction(e, "delete")}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>
    )
  }

  // List Large Variant - horizontal layout with bigger images
  if (variant === "list-large") {
    return (
      <Card
        className={cn(
          "w-full overflow-hidden rounded-lg border transition-all duration-200 hover:shadow-md cursor-pointer group", // Added group class for hover effects
          isSelected && "border-primary bg-primary/5 ring-1 ring-primary/20",
          isSoldOut && "opacity-70",
          selectionMode && "hover:border-slate-700",
        )}
        onClick={handleCardClick}
        onMouseEnter={() => setCardHovered(true)}
        onMouseLeave={() => setCardHovered(false)}
      >
        <div className="flex items-center pt-3 md:pt-4 px-3 md:px-4 pb-0 gap-3 md:gap-4">
          {onSelect && (
            <div
              className={cn(
                "transition-all duration-200 ease-out overflow-hidden", // Reduced animation duration from 300ms to 200ms for faster sliding
                isSelected ? "w-5 opacity-100" : "w-0 opacity-0 group-hover:w-5 group-hover:opacity-100",
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect(item.id)}
                aria-label={`Select ${item.name}`}
                className="bg-white border-2 border-gray-300 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900 w-5 h-5 min-h-0 min-w-0" // gray-900 checkbox
              />
            </div>
          )}

          <div className="relative w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden transition-transform duration-200 ease-out">
            <Image
              src={item.image || "/placeholder.svg?height=100&width=100"}
              alt={item.name}
              fill
              className={cn("object-cover", isSoldOut && "grayscale")}
              loading="lazy"
            />
            {isSoldOut && (
              <div className="absolute inset-0 bg-red-600/80 flex items-center justify-center">
                <span className="text-white text-xs font-bold">SOLD OUT</span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            {/* Name */}
            <h3 className="text-lg font-semibold text-foreground line-clamp-1">{item.name}</h3>

            {/* Description */}
            {item.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{item.description}</p>
            )}

            <div className="space-y-2">
              {/* Categories */}
              {item.categories && item.categories.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {item.categories.map((categoryId, index) => {
                    const category =
                      categories && Array.isArray(categories) ? categories.find((cat) => cat.id === categoryId) : null
                    return (
                      <Badge key={index} variant="outline" className="text-xs flex items-center gap-1">
                        {category?.emoji && <span>{category.emoji}</span>}
                        <span>{category?.name || categoryId}</span>
                      </Badge>
                    )
                  })}
                </div>
              )}

              {/* All Tags */}
              <div className="flex gap-1 flex-wrap">
                {/* Dietary Tags */}
                {item.dietaryTags &&
                  item.dietaryTags.map((tag, index) => {
                    const { icon, label } = parseTagDisplay(tag, getDietaryEmoji)
                    return <TagChip key={`dietary-${index}`} label={label} variant="dietary" icon={icon} />
                  })}

                {/* Allergens */}
                {item.nutrition?.allergens &&
                  item.nutrition.allergens.map((allergen, index) => {
                    const { icon, label } = parseTagDisplay(allergen, getAllergenEmoji)
                    return <TagChip key={`allergen-${index}`} label={label} variant="allergen" icon={icon} />
                  })}

                {/* Attribute Tags */}
                {item.tags.slice(0, 3).map((tag, index) => {
                  const raw = typeof tag === "string" ? tag : (tag as any).label
                  const { icon, label } = parseTagDisplay(raw, getAttributeEmoji)
                  return <TagChip key={`tag-${index}`} label={label} variant="attribute" icon={icon} />
                })}

                {/* Show more if there are additional tags */}
                {item.tags.length > 3 && <TagChip label={`+${item.tags.length - 3} more`} variant="custom" />}
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 flex flex-col items-end gap-2 self-center">
            <StatusChip status={item.status} size="sm" />
            <div className="flex items-center gap-2">
              <PriceBadge price={item.price} currency={item.currency} />
              {caloriesLabel && <span className="text-xs text-muted-foreground">{caloriesLabel}</span>}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild data-dropdown-trigger>
              <button
                className="flex-shrink-0 p-2 hover:bg-muted rounded-lg transition-colors self-center"
                aria-label="More actions"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-5 h-5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => handleQuickAction(e, "view")}>
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => handleQuickAction(e, "edit")}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => handleQuickAction(e, "duplicate")}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => handleQuickAction(e, isSoldOut ? "mark-live" : "mark-soldout")}>
                {isSoldOut ? "Mark Live" : "Mark Sold Out"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => handleQuickAction(e, "delete")} className="text-red-600 focus:text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    )
  }

  // List Variant (Tablet 768-1023px)
  if (variant === "list") {
    return (
      <Card
        className={cn(
          "w-full overflow-hidden rounded-lg border transition-all duration-200 hover:shadow-md cursor-pointer",
          isSelected && "border-primary bg-primary/5 ring-1 ring-primary/20",
          isSoldOut && "opacity-70",
          selectionMode && "hover:border-slate-700",
        )}
        onClick={handleCardClick}
        onMouseEnter={() => setCardHovered(true)} // Track hover
        onMouseLeave={() => setCardHovered(false)} // Track hover
      >
        <div className="flex items-center pt-4 px-4 pb-0 gap-4">
          {/* Checkbox */}
          {onSelect && (
            <div className={cn("transition-all duration-150", !showCheckbox && "opacity-0 scale-80")}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect(item.id)}
                aria-label={`Select ${item.name}`}
                className="bg-white border-2 border-gray-300 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900 w-5 h-5 min-h-0 min-w-0" // gray-900 checkbox
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {/* Thumbnail */}
          <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden">
            <Image
              src={item.image || "/placeholder.svg?height=64&width=64"}
              alt={item.name}
              fill
              className={cn("object-cover", isSoldOut && "grayscale")}
              loading="lazy"
            />
            {isSoldOut && (
              <div className="absolute inset-0 bg-red-600/80 flex items-center justify-center">
                <span className="text-white text-xs font-bold">SOLD</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="text-base font-semibold text-foreground truncate">{item.name}</h3>
            {item.description && <p className="text-sm text-muted-foreground truncate">{item.description}</p>}
            <div className="space-y-2">
              {/* Categories */}
              {item.categories && item.categories.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {item.categories.map((categoryId, index) => {
                    const category =
                      categories && Array.isArray(categories) ? categories.find((cat) => cat.id === categoryId) : null
                    return (
                      <Badge key={index} variant="outline" className="text-xs flex items-center gap-1">
                        {category?.emoji && <span>{category.emoji}</span>}
                        <span>{category?.name || categoryId}</span>
                      </Badge>
                    )
                  })}
                </div>
              )}

              {/* All Tags */}
              <div className="flex gap-1 flex-wrap">
                {/* Dietary Tags */}
                {item.dietaryTags &&
                  item.dietaryTags.map((tag, index) => {
                    const { icon, label } = parseTagDisplay(tag, getDietaryEmoji)
                    return <TagChip key={`dietary-${index}`} label={label} variant="dietary" icon={icon} />
                  })}

                {/* Allergens */}
                {item.nutrition?.allergens &&
                  item.nutrition.allergens.map((allergen, index) => {
                    const { icon, label } = parseTagDisplay(allergen, getAllergenEmoji)
                    return <TagChip key={`allergen-${index}`} label={label} variant="allergen" icon={icon} />
                  })}

                {/* Attribute Tags */}
                {item.tags.slice(0, 2).map((tag, index) => {
                  const raw = typeof tag === "string" ? tag : (tag as any).label
                  const { icon, label } = parseTagDisplay(raw, getAttributeEmoji)
                  return <TagChip key={`tag-${index}`} label={label} variant="attribute" icon={icon} />
                })}
              </div>
            </div>
          </div>

          {/* Price and Status */}
          <div className="flex-shrink-0 flex flex-col items-end gap-2">
            <StatusChip status={item.status} size="sm" />
            <div className="flex items-center gap-2">
              <PriceBadge price={item.price} currency={item.currency} />
              {caloriesLabel && <span className="text-xs text-muted-foreground">{caloriesLabel}</span>}
            </div>
          </div>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild data-dropdown-trigger>
              <button
                className="flex-shrink-0 p-2 hover:bg-muted rounded-lg transition-colors"
                aria-label="More actions"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-5 h-5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => handleQuickAction(e, "view")}>
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => handleQuickAction(e, "edit")}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => handleQuickAction(e, "duplicate")}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => handleQuickAction(e, isSoldOut ? "mark-live" : "mark-soldout")}>
                {isSoldOut ? "Mark Live" : "Mark Sold Out"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => handleQuickAction(e, "delete")} className="text-red-600 focus:text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    )
  }

  // Mobile Variant (<768px)
  return (
    <Card
      className={cn(
        "w-full overflow-hidden rounded-xl border transition-all duration-200",
        isSelected && "border-primary bg-primary/5 ring-1 ring-primary/20",
        isSoldOut && "opacity-70",
      )}
      onClick={handleCardClick}
    >
      {/* Image Section */}
      <div className="relative aspect-video overflow-hidden">
        <Image
          src={item.image || "/placeholder.svg?height=400&width=600"}
          alt={item.name}
          fill
          className={cn("object-cover", isSoldOut && "grayscale")}
          loading="lazy"
        />

        {/* Status Chip - Top Right */}
        <div className="absolute top-2 right-2">
          <StatusChip status={item.status} size="sm" />
        </div>

        {/* Sold Out Overlay */}
        {isSoldOut && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
            <div className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold text-lg">Sold Out</div>
            {item.soldOutUntil && (
              <div className="text-white text-sm mt-2">
                Until:{" "}
                {item.soldOutUntil instanceof Date
                  ? item.soldOutUntil.toLocaleDateString()
                  : new Date(item.soldOutUntil).toLocaleDateString()}
              </div>
            )}
          </div>
        )}

        {/* Checkbox - Top Left */}
        {onSelect && showCheckbox && (
          <div className="absolute top-2 left-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onSelect(item.id)}
              aria-label={`Select ${item.name}`}
              className="bg-white border-2 border-gray-300 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900 w-5 h-5 min-h-0 min-w-0" // gray-900 checkbox
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4 space-y-3">
        {/* Name */}
        <h3 className="text-lg font-semibold text-foreground line-clamp-2">{item.name}</h3>

        {/* Description */}
        {item.description && <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>}

        {/* Price and Categories */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <PriceBadge price={item.price} currency={item.currency} />
            {caloriesLabel && <span className="text-xs text-muted-foreground">{caloriesLabel}</span>}
          </div>

          {/* Categories - placed next to price */}
          {item.categories && item.categories.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {item.categories &&
                Array.isArray(item.categories) &&
                item.categories.map((categoryId, index) => {
                  const category =
                    categories && Array.isArray(categories) ? categories.find((cat) => cat.id === categoryId) : null
                  return (
                    <Badge key={index} variant="outline" className="text-xs flex items-center gap-1">
                      {category?.emoji && <span>{category.emoji}</span>}
                      <span>{getCategoryName(categoryId)}</span>
                    </Badge>
                  )
                })}
            </div>
          )}
        </div>

        {/* All Other Tags - placed below price */}
        <div className="flex flex-wrap gap-1.5">
          {/* Dietary Tags */}
          {item.dietaryTags &&
            item.dietaryTags.map((tag, index) => {
              const { icon, label } = parseTagDisplay(tag, getDietaryEmoji)
              return <TagChip key={`dietary-${index}`} label={label} variant="dietary" icon={icon} />
            })}

          {/* Allergens */}
          {item.nutrition?.allergens &&
            item.nutrition.allergens.map((allergen, index) => {
              const { icon, label } = parseTagDisplay(allergen, getAllergenEmoji)
              return <TagChip key={`allergen-${index}`} label={label} variant="allergen" icon={icon} />
            })}

          {/* Attribute Tags */}
          {item.tags.slice(0, 3).map((tag, index) => {
            const raw = typeof tag === "string" ? tag : (tag as any).label
            const { icon, label } = parseTagDisplay(raw, getAttributeEmoji)
            return <TagChip key={`tag-${index}`} label={label} variant="attribute" icon={icon} />
          })}

          {/* Show more if there are additional tags */}
          {item.tags.length > 3 && <TagChip label={`+${item.tags.length - 3} more`} variant="custom" />}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={(e) => handleQuickAction(e, "edit")}
            className="flex-1 h-10 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2" // gray-900 button
          >
            <Edit className="w-5 h-5" />
            Edit
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild data-dropdown-trigger>
              <button
                className="h-10 px-6 border border-border hover:bg-muted rounded-lg transition-colors flex items-center justify-center"
                aria-label="More actions"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-5 h-5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => handleQuickAction(e, "view")}>
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => handleQuickAction(e, "edit")}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => handleQuickAction(e, "duplicate")}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => handleQuickAction(e, isSoldOut ? "mark-live" : "mark-soldout")}>
                {isSoldOut ? "Mark Live" : "Mark Sold Out"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => handleQuickAction(e, "delete")} className="text-red-600 focus:text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  )
}
