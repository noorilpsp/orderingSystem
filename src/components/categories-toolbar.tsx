"use client"

import type React from "react"

import { Search, Plus, Download, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState } from "react"

interface CategoriesToolbarProps {
  onCreateCategory: () => void
  onSearch?: (query: string) => void
  onImportCsv?: () => void
  onExportCsv?: () => void
  totalCategories?: number
}

export function CategoriesToolbar({
  onCreateCategory,
  onSearch,
  onImportCsv,
  onExportCsv,
  totalCategories = 0,
}: CategoriesToolbarProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    onSearch?.(query)
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between bg-card border border-border rounded-lg p-4">
      {/* Search Input */}
      <div className="flex-1 min-w-0 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${totalCategories} ${totalCategories === 1 ? "category" : "categories"}...`}
          className="pl-10"
          value={searchQuery}
          onChange={handleSearchChange}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-transparent"
          title="Import categories"
          onClick={onImportCsv}
        >
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline">Import</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-transparent"
          title="Export categories"
          onClick={onExportCsv}
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Export</span>
        </Button>
        <Button onClick={onCreateCategory} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Category</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>
    </div>
  )
}
