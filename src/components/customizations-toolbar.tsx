"use client"

import type React from "react"

import { Search, Plus, Download, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState } from "react"

interface CustomizationsToolbarProps {
  onCreateGroup: () => void
  onSearch?: (query: string) => void
  onImportCsv?: () => void
  onExportCsv?: () => void
  totalGroups?: number
}

export function CustomizationsToolbar({
  onCreateGroup,
  onSearch,
  onImportCsv,
  onExportCsv,
  totalGroups = 0,
}: CustomizationsToolbarProps) {
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
          placeholder={`Search ${totalGroups} customization groups...`}
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
          title="Import customization groups"
          onClick={onImportCsv}
        >
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline">Import</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-transparent"
          title="Export customization groups"
          onClick={onExportCsv}
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Export</span>
        </Button>
        <Button onClick={onCreateGroup} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Customization Group</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>
    </div>
  )
}
