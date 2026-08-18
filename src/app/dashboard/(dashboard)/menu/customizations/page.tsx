"use client"

import { useState, useCallback } from "react"
import { CustomizationsContent } from "@/components/customizations-content"
import { CustomizationDrawer } from "@/components/customization-drawer"
import { CustomizationsToolbar } from "@/components/customizations-toolbar"
import { CustomizationImportModal } from "@/components/modals/customization-import-modal"
import { useMenu } from "../menu-context"
import {
  CUSTOMIZATION_TEMPLATES,
  customizationGroupFromTemplate,
} from "@/lib/menu/customization-templates"
import { applyCustomizationTemplatePack } from "@/lib/menu/customization-template-packs"
import { downloadCustomizationGroupsCsv } from "@/lib/menu/export-customizations"
import { toast } from "sonner"
import type { CustomizationGroup } from "@/types/customization"

export default function MenuCustomizationsPage() {
  const {
    customizationGroups,
    loading,
    createCustomizationGroup,
    updateCustomizationGroup,
    deleteCustomizationGroup,
    duplicateCustomizationGroup,
    importCustomizationGroups,
  } = useMenu()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<CustomizationGroup | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [importOpen, setImportOpen] = useState(false)

  const handleCreateGroup = useCallback(() => {
    setEditingGroup(null)
    setDrawerOpen(true)
  }, [])

  const handleEditGroup = useCallback(
    (id: string) => {
      const group = customizationGroups.find((g) => g.id === id)
      if (!group) return

      setEditingGroup(group)
      setDrawerOpen(true)
    },
    [customizationGroups],
  )

  const handleSaveGroup = useCallback(
    (groupData: CustomizationGroup) => {
      if (editingGroup) {
        updateCustomizationGroup(editingGroup.id, groupData)
        toast.success("Customization group updated")
      } else {
        createCustomizationGroup(groupData)
        toast.success("Customization group created")
      }
      setDrawerOpen(false)
      setEditingGroup(null)
    },
    [editingGroup, updateCustomizationGroup, createCustomizationGroup],
  )

  const handleDeleteGroup = useCallback(
    (id: string) => {
      const group = customizationGroups.find((g) => g.id === id)
      if (!group) return

      if (group.itemCount > 0) {
        const confirmDelete = confirm(
          `This customization group is used by ${group.itemCount} items. Deleting it will remove it from all items. Continue?`,
        )
        if (!confirmDelete) return
      }

      deleteCustomizationGroup(id)
      toast.success(`${group.name} deleted`)
    },
    [customizationGroups, deleteCustomizationGroup],
  )

  const handleDuplicateGroup = useCallback(
    (id: string) => {
      const group = customizationGroups.find((g) => g.id === id)
      if (!group) return

      duplicateCustomizationGroup(id)
      toast.success(`${group.name} duplicated`)
    },
    [customizationGroups, duplicateCustomizationGroup],
  )

  const uniqueGroupName = useCallback(
    (baseName: string) => {
      const taken = new Set(
        customizationGroups.map((group) => group.name.toLowerCase()),
      )
      if (!taken.has(baseName.toLowerCase())) return baseName
      let index = customizationGroups.length + 1
      let candidate = `${baseName} ${index}`
      while (taken.has(candidate.toLowerCase())) {
        index += 1
        candidate = `${baseName} ${index}`
      }
      return candidate
    },
    [customizationGroups],
  )

  const handleUseTemplate = useCallback(
    async (templateId: string) => {
      const template = CUSTOMIZATION_TEMPLATES.find((entry) => entry.id === templateId)
      if (!template) {
        toast.error("Template not found")
        return
      }

      const groupData = customizationGroupFromTemplate(template)
      groupData.name = uniqueGroupName(template.name)

      await createCustomizationGroup(groupData)
    },
    [createCustomizationGroup, uniqueGroupName],
  )

  const handleUseTemplatePack = useCallback(
    async (packId: string) => {
      try {
        const usedNames = new Set<string>()
        const pack = await applyCustomizationTemplatePack(
          packId,
          createCustomizationGroup,
          (baseName) => {
            let name = uniqueGroupName(baseName)
            let suffix = 2
            while (usedNames.has(name.toLowerCase())) {
              name = uniqueGroupName(`${baseName} ${suffix}`)
              suffix += 1
            }
            usedNames.add(name.toLowerCase())
            return name
          },
        )
        toast.success(`${pack.name} created`)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create advanced pack"
        toast.error(message)
      }
    },
    [createCustomizationGroup, uniqueGroupName],
  )

  const handleDrawerClose = () => {
    setDrawerOpen(false)
    setEditingGroup(null)
  }

  const handleExportCsv = useCallback(() => {
    if (customizationGroups.length === 0) {
      toast.error("No customization groups to export")
      return
    }
    downloadCustomizationGroupsCsv(customizationGroups)
  }, [customizationGroups])

  const filteredGroups = customizationGroups.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="px-6 pt-8 pb-6 border-b border-border">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Customizations</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Manage customization groups that customers can use to personalize items
          </p>
        </div>

        <div className="p-6 space-y-6">
          <CustomizationsToolbar
            onCreateGroup={handleCreateGroup}
            onSearch={setSearchQuery}
            onImportCsv={() => setImportOpen(true)}
            onExportCsv={handleExportCsv}
            totalGroups={customizationGroups.length}
          />

          <CustomizationsContent
            groups={filteredGroups}
            isLoading={loading}
            onCreateGroup={handleCreateGroup}
            onEditGroup={handleEditGroup}
            onDeleteGroup={handleDeleteGroup}
            onDuplicateGroup={handleDuplicateGroup}
            onUseTemplate={handleUseTemplate}
            onUseTemplatePack={handleUseTemplatePack}
          />
        </div>
      </div>

      <CustomizationDrawer
        group={editingGroup}
        isOpen={drawerOpen}
        onClose={handleDrawerClose}
        onSave={handleSaveGroup}
        onDelete={handleDeleteGroup}
        availableGroups={customizationGroups}
      />

      <CustomizationImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        existingGroupNames={customizationGroups.map((group) => group.name)}
        onImport={importCustomizationGroups}
      />
    </div>
  )
}
