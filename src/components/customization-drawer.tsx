"use client"

import * as React from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { X, MoreVertical, AlertCircle, Plus, GripVertical, Trash2, Star } from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { normalizeCatalogI18n } from "@/lib/catalog-i18n"
import type {
  CustomizationGroup,
  AdvancedCustomizationGroup,
  ConditionalPricing,
  ConditionalQuantities,
  SecondaryGroups,
  DefaultSelections,
} from "@/types/customization"
import { ConditionalPricingBuilder } from "@/components/customization/conditional-pricing-builder"
import { ConditionalQuantitiesBuilder } from "@/components/customization/conditional-quantities-builder"
import { SecondaryGroupsManager } from "@/components/customization/secondary-groups-manager"
import { DefaultSelectionsUI } from "@/components/customization/default-selections-ui"
import { UnsavedChangesModal } from "@/components/modals/unsaved-changes-modal"

const customizationSchema = z.object({
  name: z.string().min(1, "Group name is required").max(50),
  nameAr: z.string().max(50).optional(),
  customerInstructions: z.string().min(1, "Customer instructions are required").max(200),
  customerInstructionsAr: z.string().max(200).optional(),
  internalNotes: z.string().optional(),
  rules: z.object({
    min: z.number().min(0),
    max: z.number().min(1),
    required: z.boolean(),
  }),
  options: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1, "Option name is required"),
        nameAr: z.string().max(100).optional(),
        priceDelta: z.number(),
        isDefault: z.boolean(),
        order: z.number(),
      }),
    )
    .min(1, "At least one option is required"),
})

type CustomizationFormData = z.infer<typeof customizationSchema>

interface CustomizationDrawerProps {
  group: CustomizationGroup | null
  isOpen: boolean
  onClose: () => void
  onSave: (group: CustomizationGroup) => void
  onDelete: (id: string) => void
  availableGroups?: CustomizationGroup[]
}

export function CustomizationDrawer({
  group,
  isOpen,
  onClose,
  onSave,
  onDelete,
  availableGroups = [],
}: CustomizationDrawerProps) {
  const [isSaving, setIsSaving] = React.useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null)
  const [showUnsavedModal, setShowUnsavedModal] = React.useState(false)
  const [isClosing, setIsClosing] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("basic")

  // Advanced features state
  const [conditionalPricing, setConditionalPricing] = React.useState<ConditionalPricing>({
    enabled: false,
    basedOnGroupId: "",
    priceMatrix: {},
  })
  const [conditionalQuantities, setConditionalQuantities] = React.useState<ConditionalQuantities>({
    enabled: false,
    basedOnGroupId: "",
    rulesMatrix: {},
  })
  const [secondaryGroups, setSecondaryGroups] = React.useState<SecondaryGroups>({
    rules: [],
  })
  const [defaultSelections, setDefaultSelections] = React.useState<DefaultSelections>({})

  const form = useForm<CustomizationFormData>({
    resolver: zodResolver(customizationSchema),
    defaultValues: group
      ? {
          name: group.name,
          nameAr: group.i18n?.ar?.name ?? group.nameAr ?? "",
          customerInstructions: group.customerInstructions,
          customerInstructionsAr:
            group.i18n?.ar?.customerInstructions ?? group.customerInstructionsAr ?? "",
          internalNotes: group.internalNotes || "",
          rules: group.rules,
          options: group.options.map((opt) => ({
            ...opt,
            nameAr: opt.i18n?.ar?.name ?? opt.nameAr ?? "",
          })),
        }
      : {
          name: "",
          nameAr: "",
          customerInstructions: "",
          customerInstructionsAr: "",
          internalNotes: "",
          rules: {
            min: 0,
            max: 1,
            required: false,
          },
          options: [
            {
              id: `opt-${Date.now()}`,
              name: "",
              nameAr: "",
              priceDelta: 0,
              isDefault: false,
              order: 0,
            },
          ],
        },
  })

  const {
    formState: { isDirty, errors },
  } = form

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "options",
  })

  React.useEffect(() => {
    if (isClosing) return // Don't reset form when drawer is closing
    if (!isOpen) {
      setShowDeleteConfirm(false)
    }
  }, [isOpen, isClosing])

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab("basic")
      setIsClosing(false)
      setShowDeleteConfirm(false)
      
      // Initialize form and advanced features based on whether we have a group
      if (group) {
        // Editing existing group - load data from group
        form.reset({
          name: group.name,
          nameAr: group.i18n?.ar?.name ?? group.nameAr ?? "",
          customerInstructions: group.customerInstructions,
          customerInstructionsAr:
            group.i18n?.ar?.customerInstructions ?? group.customerInstructionsAr ?? "",
          internalNotes: group.internalNotes || "",
          rules: group.rules,
          options: group.options.map((opt) => ({
            ...opt,
            nameAr: opt.i18n?.ar?.name ?? opt.nameAr ?? "",
          })),
        })

        // Initialize advanced features from group
        const advancedGroup = group as AdvancedCustomizationGroup
        setConditionalPricing(advancedGroup.conditionalPricing || {
          enabled: false,
          basedOnGroupId: "",
          priceMatrix: {},
        })
        setConditionalQuantities(advancedGroup.conditionalQuantities || {
          enabled: false,
          basedOnGroupId: "",
          rulesMatrix: {},
        })
        setSecondaryGroups(advancedGroup.secondaryGroups || {
          rules: [],
        })
        setDefaultSelections(advancedGroup.defaultSelections || {})
      } else {
        // Creating new group - reset to defaults
        form.reset({
          name: "",
          nameAr: "",
          customerInstructions: "",
          customerInstructionsAr: "",
          internalNotes: "",
          rules: {
            min: 0,
            max: 1,
            required: false,
          },
          options: [
            {
              id: `opt-${Date.now()}`,
              name: "",
              nameAr: "",
              priceDelta: 0,
              isDefault: false,
              order: 0,
            },
          ],
        })
        setConditionalPricing({
          enabled: false,
          basedOnGroupId: "",
          priceMatrix: {},
        })
        setConditionalQuantities({
          enabled: false,
          basedOnGroupId: "",
          rulesMatrix: {},
        })
        setSecondaryGroups({
          rules: [],
        })
        setDefaultSelections({})
      }
    }
  }, [isOpen, group, form])

  const handleClose = () => {
    if (isDirty) {
      setShowUnsavedModal(true)
      return
    }
    setIsClosing(true)
    onClose()
  }

  const handleDiscardChanges = () => {
    form.reset()
    setShowUnsavedModal(false)
    setIsClosing(true)
    onClose()
  }

  const handleSaveAndClose = async () => {
    setShowUnsavedModal(false)
    await handleSave()
    setIsClosing(true)
    onClose()
  }

  const handleCancelUnsaved = () => {
    setShowUnsavedModal(false)
  }

  const handleSave = async () => {
    const isValid = await form.trigger()

    if (!isValid) {
      alert("Please fix all required fields before saving.")
      return
    }

    setIsSaving(true)
    try {
      const values = form.getValues()
      const groupI18n = normalizeCatalogI18n({
        ar: {
          name: values.nameAr,
          customerInstructions: values.customerInstructionsAr,
        },
      })
      const groupData: AdvancedCustomizationGroup = {
        id: group?.id || `${Date.now()}`,
        name: values.name,
        customerInstructions: values.customerInstructions,
        internalNotes: values.internalNotes,
        i18n: groupI18n,
        nameAr: values.nameAr,
        customerInstructionsAr: values.customerInstructionsAr,
        rules: values.rules,
        options: values.options.map((opt, idx) => ({
          id: opt.id,
          name: opt.name,
          nameAr: opt.nameAr,
          priceDelta: opt.priceDelta,
          isDefault: opt.isDefault,
          order: idx,
          i18n: normalizeCatalogI18n({ ar: { name: opt.nameAr } }),
        })),
        itemCount: group?.itemCount || 0,
        itemNames: group?.itemNames || [],
        // Include advanced features
        conditionalPricing: conditionalPricing.enabled ? conditionalPricing : undefined,
        conditionalQuantities: conditionalQuantities.enabled ? conditionalQuantities : undefined,
        // Always send secondaryGroups if it exists (even if empty array) to ensure old rules are cleared
        secondaryGroups: secondaryGroups,
        // Always send defaultSelections (even if empty object) to ensure old defaults are cleared
        defaultSelections: defaultSelections,
      }
      await onSave(groupData)
      form.reset(values)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = () => {
    if (group) {
      onDelete(group.id)
      onClose()
    }
  }

  const nameValue = form.watch("name")
  const customerInstructionsValue = form.watch("customerInstructions")
  const rulesValue = form.watch("rules")
  const optionsValue = form.watch("options")

  const addOption = () => {
    append({
      id: `opt-${Date.now()}`,
      name: "",
      nameAr: "",
      priceDelta: 0,
      isDefault: false,
      order: fields.length,
    })
  }

  const setDefaultOption = (index: number) => {
    optionsValue.forEach((_, idx) => {
      form.setValue(`options.${idx}.isDefault`, idx === index)
    })
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/html", e.currentTarget.innerHTML)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      move(draggedIndex, dropIndex)
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  // Determine if drawer should be wider (when conditional pricing is enabled)
  const needsWiderDrawer = conditionalPricing.enabled && activeTab === "advanced"

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className={cn(
          "w-full p-0",
          needsWiderDrawer 
            ? "sm:max-w-[800px] md:w-[800px]" 
            : "sm:max-w-[480px] md:w-[480px]",
          "max-md:h-[85vh] max-md:rounded-t-3xl"
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-white dark:bg-slate-950">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={handleClose} className="size-8">
                <X className="size-4" />
              </Button>
              <SheetTitle className="text-lg font-semibold">
                {group ? "Edit Customization" : "New Customization"}
              </SheetTitle>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Duplicate Group</DropdownMenuItem>
                <DropdownMenuItem>View Items Using This</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={() => setShowDeleteConfirm(true)}>
                  Delete Group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {isDirty && (
            <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-900 px-6 py-3">
              <AlertCircle className="size-4 text-amber-600 dark:text-amber-500" />
              <span className="flex-1 text-sm text-amber-900 dark:text-amber-200">You have unsaved changes</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => form.reset()}>
                  Discard
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Tabs for Basic and Advanced Features */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="border-b px-6 flex-shrink-0 bg-white dark:bg-slate-900">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic Settings</TabsTrigger>
                <TabsTrigger value="advanced">Advanced Features</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="basic" className="flex-1 mt-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Basic Information</h3>

                    <div className="space-y-2">
                      <Label htmlFor="name">Group Name *</Label>
                      <Input
                        id="name"
                        placeholder="e.g., Pizza Size, Toppings, Dressing"
                        {...form.register("name")}
                        className={cn(errors.name && "border-red-500 focus-visible:ring-red-500")}
                      />
                      <div className="flex justify-between text-xs">
                        {errors.name && <span className="text-red-500 font-medium">{errors.name.message}</span>}
                        <span className={cn("ml-auto", errors.name ? "text-red-500" : "text-gray-500")}>
                          {nameValue?.length || 0}/50
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customerInstructions">Customer Instructions *</Label>
                      <Textarea
                        id="customerInstructions"
                        placeholder="e.g., Choose your pizza size, Add extra toppings"
                        rows={2}
                        {...form.register("customerInstructions")}
                        className={cn(errors.customerInstructions && "border-red-500")}
                      />
                      <div className="flex justify-between text-xs">
                        {errors.customerInstructions && (
                          <span className="text-red-500 font-medium">{errors.customerInstructions.message}</span>
                        )}
                        <span className={cn("ml-auto", errors.customerInstructions ? "text-red-500" : "text-gray-500")}>
                          {customerInstructionsValue?.length || 0}/200
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">This text will be shown to customers</p>
                    </div>

                    <div className="space-y-3 rounded-lg border border-dashed p-4">
                      <div>
                        <h4 className="text-sm font-semibold">Arabic (guest menu)</h4>
                        <p className="text-xs text-muted-foreground">
                          Optional. Guests who choose Arabic see this; otherwise English is shown.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nameAr">Group Name (Arabic)</Label>
                        <Input
                          id="nameAr"
                          dir="rtl"
                          placeholder="مثلاً: حجم البيتزا"
                          {...form.register("nameAr")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customerInstructionsAr">Customer Instructions (Arabic)</Label>
                        <Textarea
                          id="customerInstructionsAr"
                          dir="rtl"
                          placeholder="مثلاً: اختر حجم البيتزا"
                          rows={2}
                          {...form.register("customerInstructionsAr")}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="internalNotes">Internal Notes</Label>
                      <Textarea
                        id="internalNotes"
                        placeholder="Private notes for staff (not shown to customers)"
                        rows={2}
                        {...form.register("internalNotes")}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">Optional notes for your team</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Rules Configuration */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Selection Rules</h3>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="required">Required Selection</Label>
                        <p className="text-sm text-muted-foreground">Customer must make a selection</p>
                      </div>
                      <Switch
                        id="required"
                        checked={rulesValue.required}
                        onCheckedChange={(checked) => form.setValue("rules.required", checked)}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Minimum Selections: {rulesValue.min}</Label>
                        <Slider
                          value={[rulesValue.min]}
                          onValueChange={([value]) => form.setValue("rules.min", value)}
                          max={10}
                          step={1}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Maximum Selections: {rulesValue.max}</Label>
                        <Slider
                          value={[rulesValue.max]}
                          onValueChange={([value]) => form.setValue("rules.max", Math.max(value, rulesValue.min))}
                          max={10}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900 dark:text-blue-50">
                      <p>
                        Customers can select between {rulesValue.min} and {rulesValue.max} option
                        {rulesValue.max !== 1 ? "s" : ""}
                        {rulesValue.required && " (required)"}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Options Management */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Options</h3>
                      <Button type="button" variant="outline" size="sm" onClick={addOption}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Option
                      </Button>
                    </div>

                    {errors.options && !Array.isArray(errors.options) && (
                      <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg p-3">
                        <AlertCircle className="size-4" />
                        <span>{errors.options.message}</span>
                      </div>
                    )}

                    <div className="space-y-3">
                      {fields.map((field, index) => (
                        <div
                          key={field.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "border rounded-lg p-4 space-y-3 relative transition-all",
                            errors.options?.[index] && "border-red-500 bg-red-50/50",
                            draggedIndex === index && "opacity-50 cursor-grabbing",
                            dragOverIndex === index && draggedIndex !== index && "border-orange-500 border-2",
                            draggedIndex !== index && "cursor-grab",
                          )}
                        >
                          {/* Drag Handle & Delete */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <GripVertical className="size-5 text-gray-400 cursor-grab hover:text-gray-600 transition-colors" />
                              <span className="text-sm text-gray-500 dark:text-gray-400">Option {index + 1}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => setDefaultOption(index)}
                                title="Set as default"
                              >
                                <Star
                                  className={cn(
                                    "size-4",
                                    optionsValue[index]?.isDefault ? "fill-amber-500 text-amber-500" : "text-gray-400",
                                  )}
                                />
                              </Button>
                              {fields.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  onClick={() => remove(index)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Option Name */}
                          <div className="space-y-2">
                            <Label htmlFor={`option-name-${index}`}>Name *</Label>
                            <Input
                              id={`option-name-${index}`}
                              placeholder="e.g., Small, Medium, Large"
                              {...form.register(`options.${index}.name`)}
                              className={cn(errors.options?.[index]?.name && "border-red-500")}
                            />
                            {errors.options?.[index]?.name && (
                              <p className="text-xs text-red-500 dark:text-red-400">
                                {errors.options[index]?.name?.message}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`option-name-ar-${index}`}>Name (Arabic)</Label>
                            <Input
                              id={`option-name-ar-${index}`}
                              dir="rtl"
                              placeholder="مثلاً: صغير"
                              {...form.register(`options.${index}.nameAr`)}
                            />
                          </div>

                          {/* Price Delta */}
                          <div className="space-y-2">
                            <Label htmlFor={`option-price-${index}`}>Price Adjustment</Label>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500 dark:text-gray-400">$</span>
                              <Input
                                id={`option-price-${index}`}
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...form.register(`options.${index}.priceDelta`, { valueAsNumber: true })}
                                className="flex-1"
                              />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Positive for upcharge, negative for discount, 0 for included
                            </p>
                          </div>

                          {optionsValue[index]?.isDefault && (
                            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950 rounded-md p-2">
                              <Star className="size-4 fill-current" />
                              <span>Default option</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Preview */}
                  <div className="space-y-4 bg-gray-50 dark:bg-slate-900 rounded-lg p-4">
                    <h3 className="font-semibold">Customer Preview</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="font-semibold">{nameValue || "Group Name"}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {customerInstructionsValue || "Customer instructions will appear here"}
                        </p>
                      </div>
                      <div className="space-y-2">
                        {optionsValue.map((option, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm bg-white dark:bg-slate-950 rounded-md p-2"
                          >
                            <div className="flex items-center gap-2">
                              <span>{option.name || `Option ${idx + 1}`}</span>
                              {option.isDefault && <Star className="size-3 fill-amber-500 text-amber-500" />}
                            </div>
                            <span className="text-gray-600 dark:text-gray-400">
                              {option.priceDelta > 0
                                ? `+$${option.priceDelta.toFixed(2)}`
                                : option.priceDelta < 0
                                  ? `-$${Math.abs(option.priceDelta).toFixed(2)}`
                                  : "Included"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="advanced" className="flex-1 mt-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Advanced Customization Features</h3>
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                      Configure conditional pricing, quantities, secondary groups, and default selections
                    </p>
                  </div>

                  <Separator />

                  {/* Conditional Pricing */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Conditional Pricing</h4>
                    <ConditionalPricingBuilder
                      currentGroup={
                        group || {
                          id: "",
                          name: "",
                          customerInstructions: "",
                          rules: { min: 0, max: 1, required: false },
                          options: [],
                          itemCount: 0,
                          itemNames: [],
                        }
                      }
                      availableGroups={availableGroups}
                      value={conditionalPricing}
                      onChange={setConditionalPricing}
                    />
                  </div>

                  <Separator />

                  {/* Conditional Quantities */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Conditional Quantities</h4>
                    <ConditionalQuantitiesBuilder
                      currentGroup={
                        group || {
                          id: "",
                          name: "",
                          customerInstructions: "",
                          rules: { min: 0, max: 1, required: false },
                          options: [],
                          itemCount: 0,
                          itemNames: [],
                        }
                      }
                      availableGroups={availableGroups}
                      value={conditionalQuantities}
                      onChange={setConditionalQuantities}
                    />
                  </div>

                  <Separator />

                  {/* Secondary Groups */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Secondary Groups</h4>
                    <SecondaryGroupsManager
                      currentGroup={
                        group || {
                          id: "",
                          name: "",
                          customerInstructions: "",
                          rules: { min: 0, max: 1, required: false },
                          options: [],
                          itemCount: 0,
                          itemNames: [],
                        }
                      }
                      availableGroups={availableGroups}
                      value={secondaryGroups}
                      onChange={setSecondaryGroups}
                    />
                  </div>

                  <Separator />

                  {/* Default Selections */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Default Selections</h4>
                    <DefaultSelectionsUI
                      currentGroup={
                        group || {
                          id: "",
                          name: "",
                          customerInstructions: "",
                          rules: { min: 0, max: 1, required: false },
                          options: [],
                          itemCount: 0,
                          itemNames: [],
                        }
                      }
                      value={defaultSelections}
                      onChange={setDefaultSelections}
                    />
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <SheetFooter className="sticky bottom-0 border-t bg-white dark:bg-slate-950 p-4">
          <div className="flex w-full gap-2">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button className="flex-1 bg-orange-600 hover:bg-orange-700" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : group ? "Save Changes" : "Create Group"}
            </Button>
          </div>
        </SheetFooter>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-950 rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-2">Delete Customization Group?</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete "{group?.name}"? This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Unsaved Changes Modal */}
        <UnsavedChangesModal
          open={showUnsavedModal}
          onOpenChange={setShowUnsavedModal}
          onDiscard={handleDiscardChanges}
          onSave={handleSaveAndClose}
          onCancel={handleCancelUnsaved}
          isSaving={isSaving}
        />
      </SheetContent>
    </Sheet>
  )
}
