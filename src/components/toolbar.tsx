"use client"

import { useState, useEffect } from "react"
import { Search, ChevronDown, ChevronsUpDown, Plus, LayoutGrid, LayoutList, Upload, Download } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useDebounce } from "@/hooks/use-debounce"

interface ToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedView?: "grid" | "list"
  onViewChange?: (view: "grid" | "list") => void
  selectedStatus: string
  onStatusChange: (status: string) => void
  selectedCategories: string[]
  onCategoriesChange: (categories: string[]) => void
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  onAddItem: () => void
  onImportCsv?: () => void
  onExportCsv?: () => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  totalItems?: number
  categories?: Array<{ id: string; name: string; emoji?: string }>
}

const mockCategories = ["Appetizers", "Salads", "Pizzas", "Pasta", "Desserts"]
const mockTags = ["Vegan", "Vegetarian", "Gluten-Free", "Spicy", "Popular", "New"]
const statusOptions = ["All", "Live", "Draft", "Hidden", "Sold Out"]

const tagsWithEmojis = [
  { value: "Vegan", label: "Vegan", emoji: "🌱" },
  { value: "Vegetarian", label: "Vegetarian", emoji: "🥬" },
  { value: "Gluten-Free", label: "Gluten-Free", emoji: "🌾" },
  { value: "Spicy", label: "Spicy", emoji: "🌶️" },
  { value: "Popular", label: "Popular", emoji: "🔥" },
  { value: "New", label: "New", emoji: "✨" },
]

export function Toolbar({
  searchQuery,
  onSearchChange,
  selectedView,
  onViewChange,
  selectedStatus,
  onStatusChange,
  selectedCategories,
  onCategoriesChange,
  selectedTags,
  onTagsChange,
  onAddItem,
  onImportCsv,
  onExportCsv,
  isCollapsed,
  onToggleCollapse,
  totalItems = 127,
  categories,
}: ToolbarProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery)
  const [isSearching, setIsSearching] = useState(false)
  const debouncedSearchQuery = useDebounce(localSearchQuery, 250)

  useEffect(() => {
    if (debouncedSearchQuery !== searchQuery) {
      onSearchChange(debouncedSearchQuery)
      setIsSearching(false)
    }
  }, [debouncedSearchQuery, searchQuery, onSearchChange])

  const handleSearchChange = (value: string) => {
    setLocalSearchQuery(value)
    setIsSearching(true)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        document.getElementById("toolbar-search")?.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleCategoryToggle = (categoryId: string) => {
    const newCategories = selectedCategories.includes(categoryId)
      ? selectedCategories.filter((c) => c !== categoryId)
      : [...selectedCategories, categoryId]
    onCategoriesChange(newCategories)
  }

  const handleTagToggle = (tag: string) => {
    const newTags = selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag]
    onTagsChange(newTags)
  }

  const handleClearFilters = () => {
    onStatusChange("All")
    onCategoriesChange([])
    onTagsChange([])
    setLocalSearchQuery("")
    onSearchChange("")
  }

  const hasActiveFilters =
    selectedStatus !== "All" || selectedCategories.length > 0 || selectedTags.length > 0 || searchQuery !== ""

  const getSearchWidth = () => {
    const activeFilterCount =
      (selectedStatus !== "All" ? 1 : 0) +
      selectedCategories.length +
      selectedTags.length +
      (searchQuery !== "" ? 1 : 0)

    if (activeFilterCount === 0) return "180px"
    if (activeFilterCount <= 2) return "160px"
    if (activeFilterCount <= 4) return "140px"
    return "120px"
  }

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm">
      {/* Desktop Layout */}
      <div className="hidden lg:flex items-center gap-3 min-h-16 px-6 py-2 w-full">
        {/* Left: Search - Dynamic width based on filters */}
        <div className="relative" style={{ width: getSearchWidth(), transition: "width 0.2s ease" }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="toolbar-search"
            type="text"
            placeholder={`Search ${totalItems} items...`}
            value={localSearchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-16 w-full"
            aria-describedby="search-count"
            aria-label="Search menu items"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground">
            ⌘K
          </kbd>
          {isSearching && (
            <div className="absolute right-12 top-1/2 -translate-y-1/2">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-orange-600" />
            </div>
          )}
        </div>

        {/* Center: Filters */}
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto scrollbar-hide pr-2">
          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent whitespace-nowrap">
                Status: {selectedStatus}
                {selectedStatus !== "All" && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                    1
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {statusOptions.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => onStatusChange(status)}
                  className={cn(selectedStatus === status && "bg-accent")}
                >
                  {status}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Category Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent whitespace-nowrap">
                Categories
                {selectedCategories.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-5 min-w-5 rounded-full px-1.5 flex items-center justify-center"
                    aria-live="polite"
                  >
                    {selectedCategories.length}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {(categories || []).map((category) => (
                <DropdownMenuCheckboxItem
                  key={category.id}
                  checked={selectedCategories.includes(category.id)}
                  onCheckedChange={() => handleCategoryToggle(category.id)}
                >
                  <span className="mr-2">{category.emoji || "📂"}</span>
                  {category.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tags Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent whitespace-nowrap">
                Tags
                {selectedTags.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-5 min-w-5 rounded-full px-1.5 flex items-center justify-center"
                    aria-live="polite"
                  >
                    {selectedTags.length}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {tagsWithEmojis.map((tag) => (
                <DropdownMenuCheckboxItem
                  key={tag.value}
                  checked={selectedTags.includes(tag.value)}
                  onCheckedChange={() => handleTagToggle(tag.value)}
                >
                  <span className="mr-2">{tag.emoji}</span>
                  {tag.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-sm text-muted-foreground hover:text-foreground whitespace-nowrap"
            >
              Clear all
            </Button>
          )}
        </div>

        {/* Right: Actions */}
        <div className="relative z-10 flex items-center gap-2 shrink-0 bg-card pl-1">
          {onViewChange && selectedView && (
            <div className="flex items-center gap-1 border rounded-md shrink-0">
              <Button
                variant={selectedView === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => onViewChange("grid")}
                className="h-9 w-9"
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={selectedView === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => onViewChange("list")}
                className="h-9 w-9"
                aria-label="List view"
              >
                <LayoutList className="h-4 w-4" />
              </Button>
            </div>
          )}

          {onToggleCollapse && (
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleCollapse}
              aria-label="Collapse categories"
              title="Collapse categories"
            >
              <ChevronsUpDown className="h-4 w-4" />
            </Button>
          )}

          <Button onClick={onAddItem} className="bg-orange-600 hover:bg-orange-700 px-6">
            <Plus className="h-4 w-4 mr-2" />
            New Item
          </Button>
          {onImportCsv && (
            <Button variant="outline" onClick={onImportCsv} className="px-4">
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
          )}
          {onExportCsv && (
            <Button variant="outline" onClick={onExportCsv} className="px-4">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Tablet Layout (768-1023px) */}
      <div className="hidden md:flex lg:hidden flex-col gap-3 p-4 overflow-x-hidden">
        {/* Row 1: Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={`Search ${totalItems} items...`}
              value={localSearchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Row 2: Filters + Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-hide">
            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap bg-transparent">
                  Status: {selectedStatus}
                  {selectedStatus !== "All" && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center"
                    >
                      1
                    </Badge>
                  )}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {statusOptions.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => onStatusChange(status)}
                    className={cn(selectedStatus === status && "bg-accent")}
                  >
                    {status}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Category Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap bg-transparent">
                  Categories
                  {selectedCategories.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5">
                      {selectedCategories.length}
                    </Badge>
                  )}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {(categories || []).map((category) => (
                  <DropdownMenuCheckboxItem
                    key={category.id}
                    checked={selectedCategories.includes(category.id)}
                    onCheckedChange={() => handleCategoryToggle(category.id)}
                  >
                    <span className="mr-2">{category.emoji || "📂"}</span>
                    {category.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Tags Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap bg-transparent">
                  Tags
                  {selectedTags.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5">
                      {selectedTags.length}
                    </Badge>
                  )}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {tagsWithEmojis.map((tag) => (
                  <DropdownMenuCheckboxItem
                    key={tag.value}
                    checked={selectedTags.includes(tag.value)}
                    onCheckedChange={() => handleTagToggle(tag.value)}
                  >
                    <span className="mr-2">{tag.emoji}</span>
                    {tag.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-sm text-muted-foreground whitespace-nowrap"
              >
                Clear all
              </Button>
            )}
          </div>

          {onViewChange && selectedView && (
            <div className="flex items-center gap-1 border rounded-md shrink-0">
              <Button
                variant={selectedView === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => onViewChange("grid")}
                className="h-9 w-9"
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={selectedView === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => onViewChange("list")}
                className="h-9 w-9"
                aria-label="List view"
              >
                <LayoutList className="h-4 w-4" />
              </Button>
            </div>
          )}

          {onToggleCollapse && (
            <Button variant="outline" size="icon" onClick={onToggleCollapse} aria-label="Collapse categories">
              <ChevronsUpDown className="h-4 w-4" />
            </Button>
          )}

          <Button onClick={onAddItem} className="bg-orange-600 hover:bg-orange-700 px-6">
            <Plus className="h-4 w-4 mr-2" />
            New Item
          </Button>
          {onImportCsv && (
            <Button variant="outline" onClick={onImportCsv} className="px-4">
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
          )}
          {onExportCsv && (
            <Button variant="outline" onClick={onExportCsv} className="px-4">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Layout (<768px) */}
      <div className="flex md:hidden flex-col gap-3 p-4 overflow-x-hidden">
        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={`Search ${totalItems} items...`}
              value={localSearchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          {onViewChange && selectedView && (
            <div className="flex items-center gap-1 border rounded-md shrink-0">
              <Button
                variant={selectedView === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => onViewChange("grid")}
                className="h-9 w-9"
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={selectedView === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => onViewChange("list")}
                className="h-9 w-9"
                aria-label="List view"
              >
                <LayoutList className="h-4 w-4" />
              </Button>
            </div>
          )}
          {onToggleCollapse && (
            <Button variant="outline" size="icon" onClick={onToggleCollapse} aria-label="Collapse categories">
              <ChevronsUpDown className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Filters - Horizontal Scroll */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1">
          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap snap-start bg-transparent">
                Status: {selectedStatus}
                {selectedStatus !== "All" && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                    1
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {statusOptions.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => onStatusChange(status)}
                  className={cn(selectedStatus === status && "bg-accent")}
                >
                  {status}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Category Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap snap-start bg-transparent">
                Categories
                {selectedCategories.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5">
                    {selectedCategories.length}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {(categories || []).map((category) => (
                <DropdownMenuCheckboxItem
                  key={category.id}
                  checked={selectedCategories.includes(category.id)}
                  onCheckedChange={() => handleCategoryToggle(category.id)}
                >
                  <span className="mr-2">{category.emoji || "📂"}</span>
                  {category.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tags Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap snap-start bg-transparent">
                Tags
                {selectedTags.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5">
                    {selectedTags.length}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {tagsWithEmojis.map((tag) => (
                <DropdownMenuCheckboxItem
                  key={tag.value}
                  checked={selectedTags.includes(tag.value)}
                  onCheckedChange={() => handleTagToggle(tag.value)}
                >
                  <span className="mr-2">{tag.emoji}</span>
                  {tag.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-sm text-muted-foreground hover:text-foreground whitespace-nowrap snap-start"
            >
              Clear all
            </Button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onImportCsv && (
            <Button variant="outline" onClick={onImportCsv} className="flex-1">
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
          )}
          {onExportCsv && (
            <Button variant="outline" onClick={onExportCsv} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>

        {/* Add Button - Full Width */}
        <Button onClick={onAddItem} className="w-full bg-orange-600 hover:bg-orange-700">
          <Plus className="h-4 w-4 mr-2" />
          New Item
        </Button>
      </div>
    </div>
  )
}
