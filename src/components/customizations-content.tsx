"use client"

import { useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/empty-state"
import { DeleteConfirmationDialog } from "@/components/modals/delete-confirmation-dialog"
import {
  Settings2,
  Package,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Star,
  X,
  Eye,
  Loader2,
} from "lucide-react"
import type { CustomizationGroup, CustomizationsContentProps } from "@/types/customization"
import { CUSTOMIZATION_TEMPLATES } from "@/lib/menu/customization-templates"
import { CUSTOMIZATION_TEMPLATE_PACKS } from "@/lib/menu/customization-template-packs"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

export function CustomizationsContent({
  groups,
  isLoading = false,
  onCreateGroup,
  onEditGroup,
  onDeleteGroup,
  onDuplicateGroup,
  onUseTemplate,
  onUseTemplatePack,
}: CustomizationsContentProps) {
  const templatesRef = useRef<HTMLDivElement>(null)
  const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null)
  const [showInfoBanner, setShowInfoBanner] = useState(true)
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    groupId: string
    groupName: string
  }>({
    open: false,
    groupId: "",
    groupName: "",
  })

  const handleDelete = () => {
    onDeleteGroup(deleteDialog.groupId)
    setDeleteDialog({ open: false, groupId: "", groupName: "" })
  }

  const handleUseTemplate = async (templateId: string) => {
    if (!onUseTemplate) {
      toast.error("Templates are unavailable right now")
      return
    }
    try {
      setCreatingTemplateId(templateId)
      await onUseTemplate(templateId)
    } finally {
      setCreatingTemplateId(null)
    }
  }

  const handleUseTemplatePack = async (packId: string) => {
    if (!onUseTemplatePack) {
      toast.error("Advanced packs are unavailable right now")
      return
    }
    try {
      setCreatingTemplateId(packId)
      await onUseTemplatePack(packId)
    } finally {
      setCreatingTemplateId(null)
    }
  }

  const advancedPacksSection = (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Advanced starter packs</h2>
        <p className="text-sm text-gray-600">
          Create linked groups with conditional pricing, quantities, or secondary groups
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CUSTOMIZATION_TEMPLATE_PACKS.map((pack) => {
          const isCreating = creatingTemplateId === pack.id
          return (
            <Card key={pack.id} className="p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start gap-3">
                <div className="text-3xl">{pack.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold">{pack.name}</h3>
                  <p className="mt-1 text-xs text-gray-600">{pack.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Creates {pack.createsGroupCount} groups
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pack.features.map((feature) => (
                      <Badge key={feature} variant="secondary" className="text-[10px]">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full bg-transparent"
                    disabled={creatingTemplateId !== null}
                    onClick={() => void handleUseTemplatePack(pack.id)}
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      "Use pack"
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )

  const templatesSection = (
    <div ref={templatesRef} className="space-y-8">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Quick Start Templates</h2>
          <p className="text-sm text-gray-600">Create common customization groups with one click</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {CUSTOMIZATION_TEMPLATES.map((template) => {
            const isCreating = creatingTemplateId === template.id
            return (
              <Card key={template.id} className="p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{template.icon}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{template.name}</h3>
                    <p className="mt-1 text-xs text-gray-600">
                      {template.options.length} options included
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full bg-transparent"
                      disabled={creatingTemplateId !== null}
                      onClick={() => void handleUseTemplate(template.id)}
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating…
                        </>
                      ) : (
                        "Use Template"
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {advancedPacksSection}
    </div>
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3 flex-1">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-72" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-9 w-9 rounded-md" />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="space-y-8">
        <EmptyState
          icon={<Settings2 className="w-16 h-16 text-gray-300" />}
          title="No customization groups yet"
          description="Customization groups let customers personalize menu items (sizes, toppings, etc.)"
          action={{
            label: "Create First Group",
            onClick: onCreateGroup,
          }}
          secondaryAction={{
            label: "Browse Templates",
            onClick: () => {
              templatesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
            },
          }}
        />

        {templatesSection}
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {showInfoBanner && (
          <div className="bg-blue-50 dark:bg-blue-950/40 border-l-4 border-blue-400 dark:border-blue-600 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Customization groups are reusable.</strong> Create once, attach to multiple items.
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                  Examples: Sizes, Toppings, Dressings, Cook Temperature
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInfoBanner(false)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {groups.map((group) => (
            <CustomizationGroupCard
              key={group.id}
              group={group}
              onEdit={() => onEditGroup(group.id)}
              onDuplicate={() => {
                onDuplicateGroup(group.id)
                toast.success(`Duplicated ${group.name}`)
              }}
              onDelete={() =>
                setDeleteDialog({
                  open: true,
                  groupId: group.id,
                  groupName: group.name,
                })
              }
            />
          ))}
        </div>

        {templatesSection}

        <DeleteConfirmationDialog
          open={deleteDialog.open}
          onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
          onConfirm={handleDelete}
          entityType="customization"
          entityName={deleteDialog.groupName}
          variant="simple"
        />
      </div>
    </TooltipProvider>
  )
}

interface CustomizationGroupCardProps {
  group: CustomizationGroup
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function CustomizationGroupCard({ group, onEdit, onDuplicate, onDelete }: CustomizationGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const previewOptions = group.options.slice(0, 3)
  const hasMoreOptions = group.options.length > 3

  const formatPrice = (delta: number) => {
    if (delta === 0) return "$0.00"
    return `+$${delta.toFixed(2)}`
  }

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <h3 className="text-xl font-semibold">{group.name}</h3>
            <p className="text-sm text-gray-600">{group.customerInstructions}</p>

            <div className="flex flex-wrap gap-2">
              {group.rules.required && (
                <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100">
                  Required
                </Badge>
              )}
              <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                Min: {group.rules.min}, Max: {group.rules.max}
              </Badge>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 text-sm text-gray-600 cursor-help w-fit">
                  <Package className="w-4 h-4" />
                  <span>
                    Used by {group.itemCount} {group.itemCount === 1 ? "item" : "items"}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-semibold text-xs">Items using this group:</p>
                  {group.itemNames.slice(0, 5).map((name, i) => (
                    <p key={i} className="text-xs">
                      • {name}
                    </p>
                  ))}
                  {group.itemNames.length > 5 && (
                    <p className="text-xs text-gray-400">+{group.itemNames.length - 5} more</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Group
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate Group
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("View items feature coming soon")}>
                <Eye className="w-4 h-4 mr-2" />
                View Items Using This
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Separator />

        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="space-y-3">
            <div className="space-y-2">
              {(isExpanded ? group.options : previewOptions).map((option) => (
                <div
                  key={option.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{option.name}</span>
                    {option.isDefault && (
                      <div className="flex items-center gap-1 text-amber-600">
                        <Star className="w-3 h-3 fill-current" />
                        <span className="text-xs">Default</span>
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-gray-600">{formatPrice(option.priceDelta)}</span>
                </div>
              ))}
            </div>

            {hasMoreOptions && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full" aria-expanded={isExpanded}>
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-2" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-2" />
                      Show all {group.options.length} options
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>

          <CollapsibleContent className="space-y-3 mt-3" />
        </Collapsible>

        <Separator />

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onEdit} className="flex-1 bg-transparent">
            <Edit className="w-4 h-4 mr-2" />
            Edit Options
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toast.info("Attach to items feature coming soon")}
            className="flex-1"
          >
            <Plus className="w-4 h-4 mr-2" />
            Attach to Items
          </Button>
        </div>
      </div>
    </Card>
  )
}
