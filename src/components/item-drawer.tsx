"use client"

import * as React from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { X, MoreVertical, AlertCircle, Settings2, GripVertical, Plus, Check, Clock } from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { MenuItem } from "@/types/menu-item"
import { CategorySelector } from "@/components/category-selector"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CustomizationDrawer } from "@/components/customization-drawer"
import { UnsavedChangesModal } from "@/components/modals/unsaved-changes-modal"
import { DeleteConfirmationDialog } from "@/components/modals/delete-confirmation-dialog"
import { PhotoUpload } from "@/components/photo-upload"
import type { Photo } from "@/types/photo"
import { useMenu } from "@/app/dashboard/(dashboard)/menu/menu-context"
import { useStationSettingsView } from "@/lib/hooks/useStationSettingsView"
import { useMerchantKdsEnabled } from "@/lib/hooks/useMerchantKdsEnabled"
import { normalizeCatalogI18n } from "@/lib/catalog-i18n"
import { EmojiPickerButton } from "@/components/ui/emoji-input-field"

const menuItemSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1, "Name is required").max(50),
    description: z.string().max(260).optional().nullable(),
    nameAr: z.string().max(50).optional(),
    descriptionAr: z.string().max(260).optional().nullable(),
    price: z.number().min(0),
    currency: z.string(),
    image: z.string().optional().nullable(),
    status: z.enum(["live", "draft", "hidden", "soldout"]),
    featured: z.boolean().optional().default(false),
    categories: z.array(z.string()).min(1, "At least one category is required"),
    tags: z.array(z.string()).optional().default([]),
    dietaryTags: z.array(z.string()).optional().default([]),
    customizationGroups: z.array(z.string()).optional().default([]),
    availabilityMode: z.enum(["menu-hours", "custom"]),
    customSchedule: z
      .array(
        z.object({
          days: z.array(z.number()),
          startTime: z.string(),
          endTime: z.string(),
        }),
      )
      .optional()
      .nullable(),
    soldOutUntil: z.date().nullable().optional(),
    nutrition: z
      .object({
        calories: z.number().optional().nullable(),
        allergens: z.array(z.string()).optional().default([]),
      })
      .optional()
      .nullable(),
    defaultStation: z.string().max(50).optional().nullable(),
    defaultSubstation: z.string().max(50).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.availabilityMode !== "custom") return
    const hasDays = (data.customSchedule ?? []).some((block) => (block.days ?? []).length > 0)
    if (!hasDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customSchedule"],
        message: "Select at least one day for custom hours",
      })
    }
  })

type MenuItemFormValues = z.infer<typeof menuItemSchema>

interface ItemDrawerProps {
  item: MenuItem | null
  isOpen: boolean
  onClose: () => void
  onSave: (item: MenuItem) => void
  onDelete: (id: string) => void
  categories?: Array<{ id: string; name: string; emoji?: string }>
}

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const timeSlots = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2)
  const minute = i % 2 === 0 ? "00" : "30"
  const period = hour < 12 ? "AM" : "PM"
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:${minute} ${period}`
})

const getOrderedTimeSlots = (selectedTime: string) => {
  if (!selectedTime || !timeSlots.includes(selectedTime)) {
    return timeSlots
  }

  const selectedIndex = timeSlots.indexOf(selectedTime)
  const timesAfterSelected = timeSlots.slice(selectedIndex)
  const timesBeforeSelected = timeSlots.slice(0, selectedIndex)

  return [...timesAfterSelected, ...timesBeforeSelected]
}

function formatMenuSchedulePreview(
  schedule: Array<{ days: number[]; startTime: string; endTime: string }> | undefined,
): string {
  if (!schedule || schedule.length === 0) return "All day"
  return schedule
    .map((block) => {
      const days = [...(block.days ?? [])]
        .sort((a, b) => a - b)
        .map((day) => dayNames[day])
        .filter(Boolean)
        .join(", ")
      const hours = `${block.startTime} – ${block.endTime}`
      return days ? `${days}: ${hours}` : hours
    })
    .join(" · ")
}

export function ItemDrawer({ item, isOpen, onClose, onSave, onDelete, categories }: ItemDrawerProps) {
  const { locationId, tags: locationTags, allergens, customizationGroups, menus, categories: locationCategories, createCustomizationGroup, updateCustomizationGroup, deleteCustomizationGroup, addTag, addAllergen } = useMenu()
  const { kdsEnabled } = useMerchantKdsEnabled()
  const { view: stationView } = useStationSettingsView(kdsEnabled ? locationId : null)
  const activeStations = stationView?.stations?.filter((s) => s.isActive) ?? []
  const [activeTab, setActiveTab] = React.useState("basic")
  const [isSaving, setIsSaving] = React.useState(false)

  // Custom tag creation state — one mini-form per tag section
  const [newAttributeTag, setNewAttributeTag] = React.useState({ emoji: "", text: "" })
  const [newDietaryTag, setNewDietaryTag] = React.useState({ emoji: "", text: "" })
  const [newAllergenTag, setNewAllergenTag] = React.useState({ emoji: "", text: "" })
  const [isCreatingTag, setIsCreatingTag] = React.useState<"attribute" | "dietary" | "allergen" | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
  const [showUnsavedModal, setShowUnsavedModal] = React.useState(false)
  const [isClosing, setIsClosing] = React.useState(false)
  const [originalItem, setOriginalItem] = React.useState<MenuItem | null>(null)
  const [currentPhoto, setCurrentPhoto] = React.useState<Photo | undefined>(undefined)
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null)
  const [editingCustomizationGroup, setEditingCustomizationGroup] = React.useState<string | null>(null)
  const [showCustomizationDrawer, setShowCustomizationDrawer] = React.useState(false)
  const [attachGroupDialogOpen, setAttachGroupDialogOpen] = React.useState(false)
  const [creatingGroupFromAttach, setCreatingGroupFromAttach] = React.useState(false)

  const form = useForm<MenuItemFormValues>({
    resolver: zodResolver(menuItemSchema) as any,
    defaultValues: {
      id: "",
      name: "",
      description: "",
      nameAr: "",
      descriptionAr: "",
      price: 0,
      currency: "USD",
      status: "draft" as const,
      featured: false,
      categories: [],
      tags: [],
      dietaryTags: [],
      customizationGroups: [],
      availabilityMode: "menu-hours" as const,
      customSchedule: [{ days: [], startTime: "7:00 AM", endTime: "11:00 AM" }],
      nutrition: {},
      defaultStation: null,
      defaultSubstation: null,
    },
  })

  const {
    formState: { isDirty },
  } = form

  const {
    fields: scheduleFields,
    append: appendSchedule,
    remove: removeSchedule,
  } = useFieldArray({
    control: form.control,
    name: "customSchedule" as any,
  })

  // Auto-save every 30 seconds
  React.useEffect(() => {
    if (!isDirty || !item) return

    const interval = setInterval(() => {
      console.log("[v0] Auto-saving draft...")
      // Auto-save logic would go here
    }, 30000)

    return () => clearInterval(interval)
  }, [isDirty, item])

  // Reset form when drawer opens
  React.useEffect(() => {
    if (!isOpen) return // Only reset when drawer is open

    console.log("=== ITEM DRAWER OPENED ===")
    console.log("Item:", item)
    
    if (item) {
      console.log("Resetting form with item data")
      form.reset({
        ...item,
        nameAr: item.i18n?.ar?.name ?? "",
        descriptionAr: item.i18n?.ar?.description ?? "",
      })

      // Initialize photo state if item has an image
      if (item.image) {
        setCurrentPhoto({
          id: item.id,
          url: item.image,
          thumbnailUrl: item.image,
          status: "approved",
          uploadedAt: new Date(),
          approvedAt: new Date(),
          metadata: {
            size: 0,
            width: 800,
            height: 800,
            format: "jpg",
          },
        })
      } else {
        setCurrentPhoto(undefined)
      }
    } else {
      console.log("Resetting form for NEW item")
      // Reset to default values for new item
      form.reset({
        id: "",
        name: "",
        description: "",
        nameAr: "",
        descriptionAr: "",
        price: 0,
        currency: "USD",
        image: "",
        status: "draft",
        featured: false,
        categories: [],
        tags: [],
        dietaryTags: [],
        customizationGroups: [],
        availabilityMode: "menu-hours",
        customSchedule: [{ days: [], startTime: "7:00 AM", endTime: "11:00 PM" }],
        soldOutUntil: null,
        nutrition: {
          calories: undefined,
          allergens: [],
        },
        defaultStation: null,
        defaultSubstation: null,
      })
      setCurrentPhoto(undefined)
    }
    setIsClosing(false)
  }, [isOpen, item?.id])

  // Reset closing state and store original item when drawer opens
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab("basic") // Reset activeTab to "basic" when drawer opens
      setIsClosing(false)
      setOriginalItem(item)
      setDraggedIndex(null)
      setDragOverIndex(null)
      setEditingCustomizationGroup(null)
      setShowCustomizationDrawer(false)
      setAttachGroupDialogOpen(false)
      setCreatingGroupFromAttach(false)
    }
  }, [isOpen, item])

  React.useEffect(() => {
    if (editingCustomizationGroup) {
      setShowCustomizationDrawer(true)
    }
  }, [editingCustomizationGroup])

  const attachedGroupIds = form.watch("customizationGroups") ?? []
  const availableGroupsToAttach = customizationGroups.filter(
    (group) => !attachedGroupIds.includes(group.id),
  )

  const resolveCustomizationGroup = (groupId: string) =>
    customizationGroups.find((group) => group.id === groupId)

  const openAttachGroupDialog = () => {
    setAttachGroupDialogOpen(true)
  }

  const attachCustomizationGroup = (groupId: string) => {
    const current = form.getValues("customizationGroups") ?? []
    if (current.includes(groupId)) return
    form.setValue("customizationGroups", [...current, groupId], {
      shouldDirty: true,
      shouldValidate: true,
    })
    setAttachGroupDialogOpen(false)
    toast.success("Customization group attached")
  }

  const openCreateCustomizationGroup = () => {
    setAttachGroupDialogOpen(false)
    setCreatingGroupFromAttach(true)
    setEditingCustomizationGroup(null)
    setShowCustomizationDrawer(true)
  }

  const handleClose = () => {
    if (isDirty) {
      setShowUnsavedModal(true)
      return
    }
    setIsClosing(true)
    onClose()
  }

  const handleDiscardChanges = () => {
    setShowUnsavedModal(false)
    setIsClosing(true)
    onClose()
  }

  const handleSaveAndClose = async () => {
    setShowUnsavedModal(false)
    await handleSave(false)
    setIsClosing(true)
    onClose()
  }

  const handleCancelUnsaved = () => {
    setShowUnsavedModal(false)
  }

  const handleSave = async (publishNow: boolean = false) => {
    try {
      setIsSaving(true)
      
      // Get current form values
      const formData = form.getValues()
      
      // Trigger validation
      const isValid = await form.trigger()
      
      if (!isValid) {
        const errors = form.formState.errors
        
        // Show ALL errors
        const allErrors = Object.entries(errors).map(([key, value]) => {
          return `${key}: ${(value as any)?.message || 'invalid'}`
        }).join("\n")
        
        toast.error("Please fix form errors: " + allErrors)
        setIsSaving(false)
        return
      }

      // Determine final status based on which button was clicked
      let finalStatus: typeof formData.status
      if (publishNow) {
        // "Save & Publish" - use form status, but if draft, change to live
        finalStatus = formData.status === "draft" ? "live" : formData.status
      } else {
        // "Save Draft" - always save as draft
        finalStatus = "draft"
      }

      const { nameAr, descriptionAr, ...restFormData } = formData
      const itemData: MenuItem = {
        ...restFormData,
        description: restFormData.description ?? undefined,
        image: restFormData.image ?? undefined,
        status: finalStatus,
        featured: formData.featured ?? false,
        tags: formData.tags ?? [],
        dietaryTags: formData.dietaryTags ?? [],
        customizationGroups: formData.customizationGroups ?? [],
        customSchedule: formData.customSchedule ?? undefined,
        nutrition: formData.nutrition
          ? {
              calories: formData.nutrition.calories ?? undefined,
              allergens: formData.nutrition.allergens ?? [],
            }
          : undefined,
        i18n: normalizeCatalogI18n({
          ar: { name: nameAr, description: descriptionAr },
        }),
        id: item?.id || `new-${Date.now()}`,
        ...(kdsEnabled
          ? {}
          : { defaultStation: undefined, defaultSubstation: undefined }),
      }
      
      await onSave(itemData)
      
      toast.success(item ? "Item updated!" : "Item created!")
      form.reset()
    } catch (error: any) {
      console.error("Error saving item:", error)
      toast.error("Failed to save item")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = () => {
    if (item) {
      onDelete(item.id)
      onClose()
    }
  }

  // Photo upload handlers
  const handlePhotoUpload = async (file: File) => {
    if (!locationId) {
      toast.error("No location selected")
      return
    }

    setIsUploading(true)
    try {
      // Upload to Vercel Blob via API
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch(`/api/items/upload?locationId=${locationId}`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to upload image")
      }

      const { url } = await response.json()

      // Set the URL in the form
      form.setValue("image", url, { shouldDirty: true, shouldValidate: true })

      // Update photo state for PhotoUpload component
      setCurrentPhoto({
        id: Date.now().toString(),
        url: url,
        thumbnailUrl: url,
        status: "approved",
        uploadedAt: new Date(),
        approvedAt: new Date(),
        metadata: {
          size: file.size,
          width: 800,
          height: 800,
          format: file.type.split("/")[1] as "jpg" | "png" | "webp",
        },
      })

      toast.success("Photo uploaded successfully")
    } catch (error) {
      console.error("Photo upload error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to upload photo")
    } finally {
      setIsUploading(false)
    }
  }

  const handlePhotoReplace = async (file: File) => {
    await handlePhotoUpload(file)
  }

  const handlePhotoRemove = async () => {
    form.setValue("image", "", { shouldDirty: true, shouldValidate: true })
    setCurrentPhoto(undefined)
    toast.success("Photo removed")
  }

  const handlePhotoWithdraw = async () => {
    // For now, just remove the photo
    await handlePhotoRemove()
  }

  const nameValue = form.watch("name")
  const descriptionValue = form.watch("description")
  const nameArValue = form.watch("nameAr")
  const descriptionArValue = form.watch("descriptionAr")
  const statusValue = form.watch("status")
  const featuredValue = form.watch("featured") ?? false

  const handleFeaturedChange = (checked: boolean) => {
    form.setValue("featured", checked, { shouldDirty: true, shouldValidate: true })
  }
  const availabilityModeValue = form.watch("availabilityMode")
  const dietaryTagsValue = form.watch("dietaryTags")
  const tagsValue = form.watch("tags")
  const allergensValue = form.watch("nutrition.allergens")
  const customScheduleValue = form.watch("customSchedule")
  const selectedCategoryIds = form.watch("categories") ?? []

  const linkedMenus = React.useMemo(() => {
    const selected = new Set(selectedCategoryIds)
    const menuIds = new Set<string>()
    for (const category of locationCategories) {
      if (!selected.has(category.id)) continue
      for (const menuId of category.menuIds ?? []) {
        menuIds.add(menuId)
      }
    }
    return menus.filter((menu) => menuIds.has(menu.id))
  }, [selectedCategoryIds, locationCategories, menus])

  const toggleDay = (scheduleIndex: number, day: number) => {
    const currentDays = customScheduleValue?.[scheduleIndex]?.days || []
    const newDays = currentDays.includes(day) ? currentDays.filter((d: number) => d !== day) : [...currentDays, day]
    form.setValue(`customSchedule.${scheduleIndex}.days` as any, newDays, { shouldValidate: true, shouldDirty: true })
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
    return emojiMap[tag] || "🥗"
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

  const formatTagLabel = React.useCallback((value: string) => {
    return value
      .split("-")
      .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
      .join(" ")
  }, [])

  const splitLeadingEmoji = React.useCallback((value: string): { emoji: string | null; label: string } => {
    const match = value.match(/^(\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*)\s*/u)
    if (!match) return { emoji: null, label: value }
    const label = value.slice(match[0].length).trim() || value
    return { emoji: match[1] ?? match[0].trim(), label }
  }, [])

  // Build a display name that embeds the emoji so it travels with the tag string everywhere
  const buildTagName = (emoji: string, text: string) =>
    emoji ? `${emoji} ${text}` : text

  const handleAddCustomAttributeTag = React.useCallback(async () => {
    const text = newAttributeTag.text.trim()
    if (!text || !locationId) return
    setIsCreatingTag("attribute")
    const fullName = buildTagName(newAttributeTag.emoji, text)
    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, name: fullName, emoji: newAttributeTag.emoji || null }),
      })
      if (response.ok) {
        const newTag = await response.json()
        addTag({ id: newTag.id, name: newTag.name, emoji: newTag.emoji ?? null })
        const current = form.getValues("tags") || []
        if (!current.includes(fullName)) {
          form.setValue("tags", [...current, fullName], { shouldDirty: true, shouldValidate: true })
        }
        setNewAttributeTag({ emoji: "", text: "" })
      } else {
        toast.error("Failed to create tag")
      }
    } catch {
      toast.error("Failed to create tag")
    } finally {
      setIsCreatingTag(null)
    }
  }, [locationId, newAttributeTag, form, addTag])

  const handleAddCustomDietaryTag = React.useCallback(async () => {
    const text = newDietaryTag.text.trim()
    if (!text || !locationId) return
    setIsCreatingTag("dietary")
    const fullName = buildTagName(newDietaryTag.emoji, text)
    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, name: fullName, emoji: newDietaryTag.emoji || null }),
      })
      if (response.ok) {
        const newTag = await response.json()
        addTag({ id: newTag.id, name: newTag.name, emoji: newTag.emoji ?? null })
        const current = form.getValues("dietaryTags") || []
        if (!current.includes(fullName)) {
          form.setValue("dietaryTags", [...current, fullName], { shouldDirty: true, shouldValidate: true })
        }
        setNewDietaryTag({ emoji: "", text: "" })
      } else {
        toast.error("Failed to create dietary tag")
      }
    } catch {
      toast.error("Failed to create dietary tag")
    } finally {
      setIsCreatingTag(null)
    }
  }, [locationId, newDietaryTag, form, addTag])

  const handleAddCustomAllergen = React.useCallback(async () => {
    const text = newAllergenTag.text.trim()
    if (!text || !locationId) return
    setIsCreatingTag("allergen")
    const fullName = buildTagName(newAllergenTag.emoji, text)
    try {
      const response = await fetch("/api/allergens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, name: fullName, emoji: newAllergenTag.emoji || null }),
      })
      if (response.ok) {
        const newAllergenRecord = await response.json()
        addAllergen({ id: newAllergenRecord.id, name: newAllergenRecord.name, emoji: newAllergenRecord.emoji ?? null })
        const current = form.getValues("nutrition.allergens") || []
        if (!current.includes(fullName)) {
          form.setValue("nutrition.allergens", [...current, fullName], { shouldDirty: true, shouldValidate: true })
        }
        setNewAllergenTag({ emoji: "", text: "" })
      } else {
        toast.error("Failed to create allergen")
      }
    } catch {
      toast.error("Failed to create allergen")
    } finally {
      setIsCreatingTag(null)
    }
  }, [locationId, newAllergenTag, form, addAllergen])

  const dietaryTagOptions = React.useMemo(() => {
    const defaultValues = [
      "vegetarian",
      "vegan",
      "gluten-free",
      "dairy-free",
      "nut-free",
      "sugar-free",
      "keto",
      "paleo",
      "low-carb",
      "high-protein",
      "organic",
      "raw",
      "halal",
      "kosher",
    ]

    const options = new Map(
      defaultValues.map((value) => [
        value,
        { value, label: formatTagLabel(value), emoji: getDietaryEmoji(value) },
      ]),
    )

    const selectedDietaryTags = form.getValues("dietaryTags") || []
    for (const tag of selectedDietaryTags) {
      const value = tag.trim().toLowerCase()
      if (!value) continue
      if (!options.has(value)) {
        const parsed = splitLeadingEmoji(tag)
        options.set(value, {
          value,
          label: parsed.emoji ? parsed.label : formatTagLabel(value),
          emoji: parsed.emoji || getDietaryEmoji(value),
        })
      }
    }

    return Array.from(options.values())
  }, [form, formatTagLabel, getDietaryEmoji, splitLeadingEmoji, dietaryTagsValue])

  const allergenOptions = React.useMemo(() => {
    const defaultValues = ["nuts", "dairy", "shellfish", "gluten", "soy", "eggs"]
    const options = new Map(
      defaultValues.map((value) => [
        value,
        { value, label: formatTagLabel(value), emoji: getAllergenEmoji(value) },
      ]),
    )

    for (const allergen of allergens) {
      const value = allergen.name.trim().toLowerCase()
      if (!value) continue
      if (!options.has(value)) {
        const parsed = splitLeadingEmoji(allergen.name.trim())
        options.set(value, {
          value,
          label: parsed.label,
          emoji: allergen.emoji || parsed.emoji || getAllergenEmoji(value),
        })
      }
    }

    const selectedAllergens = form.getValues("nutrition.allergens") || []
    for (const allergen of selectedAllergens) {
      const value = allergen.trim().toLowerCase()
      if (!value) continue
      if (!options.has(value)) {
        const parsed = splitLeadingEmoji(allergen)
        options.set(value, {
          value,
          label: parsed.emoji ? parsed.label : formatTagLabel(value),
          emoji: parsed.emoji || getAllergenEmoji(value),
        })
      }
    }

    return Array.from(options.values())
  }, [allergens, allergensValue, form, formatTagLabel, splitLeadingEmoji])

  const attributeTagOptions = React.useMemo(() => {
    const defaultOptions = [
      { value: "spicy", label: "Spicy", emoji: "🌶️" },
      { value: "popular", label: "Popular", emoji: "🔥" },
      { value: "new", label: "New", emoji: "✨" },
      { value: "chef-pick", label: "Chef's Pick", emoji: "👨‍🍳" },
    ]

    const options = new Map(defaultOptions.map((tag) => [tag.value, tag]))
    const selectedTags = form.getValues("tags") || []

    for (const tag of locationTags) {
      const value = tag.name.trim().toLowerCase()
      if (!value) continue
      if (!options.has(value)) {
        const parsed = splitLeadingEmoji(tag.name.trim())
        options.set(value, {
          value,
          label: parsed.label,
          emoji: tag.emoji || parsed.emoji || "🏷️",
        })
      }
    }

    for (const tag of selectedTags) {
      const value = tag.trim().toLowerCase()
      if (!value) continue
      if (!options.has(value)) {
        const parsed = splitLeadingEmoji(tag)
        options.set(value, {
          value,
          label: parsed.emoji ? parsed.label : tag ? formatTagLabel(tag) : tag,
          emoji: parsed.emoji || "🏷️",
        })
      }
    }

    return Array.from(options.values())
  }, [form, formatTagLabel, locationTags, splitLeadingEmoji, tagsValue])

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className={cn(
          "w-full p-0 flex flex-col h-full",
          "sm:max-w-[480px] md:w-[480px]",
          "max-md:h-screen max-md:rounded-none max-md:border-none",
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-white dark:bg-slate-950">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={handleClose} className="size-8">
                <X className="size-4" />
              </Button>
              <SheetTitle className="text-lg font-semibold">{originalItem ? "Edit Item" : "New Item"}</SheetTitle>
            </div>

            {item && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Duplicate Item</DropdownMenuItem>
                  <DropdownMenuItem>View History</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600" onClick={() => setShowDeleteConfirm(true)}>
                    Delete Item
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Unsaved Changes Banner */}
          {isDirty && (
            <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-900 px-6 py-3">
              <AlertCircle className="size-4 text-amber-600 dark:text-amber-500" />
              <span className="flex-1 text-sm text-amber-900 dark:text-amber-200">You have unsaved changes</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => form.reset()}>
                  Discard
                </Button>
                <Button size="sm" onClick={() => handleSave(false)} disabled={isSaving}>
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
          <div className="sticky top-[55px] z-10 border-b bg-white dark:bg-slate-950">
            <TabsList className="w-full justify-start rounded-none border-0 bg-transparent p-0">
              <TabsTrigger
                value="basic"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600"
              >
                Basic
              </TabsTrigger>
              <TabsTrigger
                value="customizations"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600"
              >
                Customizations
              </TabsTrigger>
              <TabsTrigger
                value="availability"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600"
              >
                Availability
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* TAB 1: BASIC */}
              <TabsContent value="basic" className="mt-0 space-y-6">
                {/* Photo Upload */}
                <div className="space-y-2">
                  <Label>Photo</Label>
                  <PhotoUpload
                    currentPhoto={currentPhoto}
                    onUpload={handlePhotoUpload}
                    onReplace={handlePhotoReplace}
                    onRemove={handlePhotoRemove}
                    onWithdraw={handlePhotoWithdraw}
                    guidelines={true}
                  />
                </div>

                <Separator />

                {/* Item Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Item Information</h3>

                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input id="name" placeholder="e.g., Caesar Salad" {...form.register("name")} />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{form.formState.errors.name?.message}</span>
                      <span>{nameValue?.length || 0}/50</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      rows={4}
                      placeholder="Describe ingredients, portion size..."
                      {...form.register("description")}
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>Best descriptions are 140-260 characters</span>
                      <span>{descriptionValue?.length || 0}/260</span>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-border/70 bg-muted/30 p-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold">Arabic (guest menu)</h4>
                      <p className="text-xs text-muted-foreground">
                        Optional. Guests who choose Arabic see this; otherwise English is shown.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="nameAr">Name (Arabic)</Label>
                      <Input
                        id="nameAr"
                        dir="rtl"
                        placeholder="مثال: سلطة سيزر"
                        {...form.register("nameAr")}
                      />
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{form.formState.errors.nameAr?.message}</span>
                        <span>{nameArValue?.length || 0}/50</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="descriptionAr">Description (Arabic)</Label>
                      <Textarea
                        id="descriptionAr"
                        dir="rtl"
                        rows={3}
                        placeholder="وصف اختياري بالعربية..."
                        {...form.register("descriptionAr")}
                      />
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{form.formState.errors.descriptionAr?.message}</span>
                        <span>{descriptionArValue?.length || 0}/260</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Pricing */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Pricing</h3>

                  <div className="space-y-2">
                    <Label htmlFor="price">Price *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        className="pl-7"
                        {...form.register("price", { valueAsNumber: true })}
                      />
                    </div>
                    <p className="text-xs text-gray-500">Base price for this item</p>
                  </div>
                </div>

                {/* Prep Station (KDS) — only when merchant has KDS enabled */}
                {kdsEnabled ? (
                <>
                <Separator />

                <div className="space-y-4">
                  <h3 className="font-semibold">Prep Station (KDS)</h3>
                  <p className="text-sm text-muted-foreground">
                    Assign this item to a kitchen display station. Orders will route here by default.
                  </p>
                  {activeStations.length === 0 ? (
                    <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                      No active stations for this location. Add stations in KDS settings to assign items.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="defaultStation">KDS Station</Label>
                      {form.watch("defaultStation") &&
                        !activeStations.some((s) => s.key === form.watch("defaultStation")) && (
                          <div className="rounded-md bg-amber-50 dark:bg-amber-950/50 p-2 text-sm text-amber-800 dark:text-amber-200">
                            Current: <strong>{form.watch("defaultStation")}</strong> (inactive) — choose an active
                            station or None to update.
                          </div>
                        )}
                      <Select
                        value={form.watch("defaultStation") ?? "none"}
                        onValueChange={(v) =>
                          form.setValue("defaultStation", v === "none" ? null : v, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                      >
                        <SelectTrigger id="defaultStation">
                          <SelectValue placeholder="Select station (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None (use default routing)</SelectItem>
                          {activeStations.map((s) => (
                            <SelectItem key={s.id} value={s.key}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Lane (substation) - shown when selected station has configured lanes */}
                {(() => {
                  const selectedStationKey = form.watch("defaultStation");
                  const selectedStation = activeStations.find(
                    (s) => s.key === selectedStationKey
                  );
                  const substations = selectedStation?.substations ?? [];
                  if (substations.length === 0) return null;
                  return (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <h3 className="font-semibold">
                          {selectedStation?.name ?? "Station"} Lane
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Assign to a lane within this station.
                        </p>
                        <div className="space-y-2">
                          <Label htmlFor="defaultSubstation">Lane</Label>
                          <Select
                            value={form.watch("defaultSubstation") ?? "none"}
                            onValueChange={(v) =>
                              form.setValue("defaultSubstation", v === "none" ? null : v, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                          >
                            <SelectTrigger id="defaultSubstation">
                              <SelectValue placeholder="Select lane (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None (unassigned)</SelectItem>
                              {substations.map((ss) => (
                                <SelectItem key={ss.id} value={ss.key}>
                                  {ss.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </>
                  );
                })()}
                </>
                ) : null}

                <Separator />

                {/* Categories */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Categories *</h3>
                  <p className="text-sm text-gray-600">Select at least one category</p>
                  {form.watch("categories")?.length === 0 && (
                    <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950 p-3 text-sm text-amber-900 dark:text-amber-200">
                      <AlertCircle className="size-4" />
                      Item won't be visible to customers without a category
                    </div>
                  )}
                  <CategorySelector
                    categories={(categories || []).map((cat) => ({
                      id: cat.id,
                      label: cat.name,
                      icon: cat.emoji ? () => <span className="text-lg">{cat.emoji}</span> : undefined,
                    }))}
                    selected={form.watch("categories") || []}
                    onChange={(selectedIds) => {
                      form.setValue("categories", selectedIds, { shouldDirty: true, shouldValidate: true })
                    }}
                    placeholder="Search categories..."
                  />
                  {form.formState.errors.categories && (
                    <div className="text-xs text-red-500 mt-1">{form.formState.errors.categories.message}</div>
                  )}
                </div>

                <Separator />

                {/* Tags */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Tags</h3>

                  <div className="space-y-3">
                    <Label>Dietary Tags</Label>
                    <div className="flex flex-wrap gap-2">
                      {dietaryTagOptions.map((tag) => (
                        <Button
                          key={tag.value}
                          type="button"
                          variant="outline"
                          size="sm"
                          className={cn(
                            dietaryTagsValue?.includes(tag.value) && "border-green-500 bg-green-100 text-green-700",
                          )}
                          onClick={() => {
                            const current = form.getValues("dietaryTags") || []
                            if (current.includes(tag.value)) {
                              form.setValue(
                                "dietaryTags",
                                current.filter((t) => t !== tag.value),
                                { shouldDirty: true, shouldValidate: true },
                              )
                            } else {
                              form.setValue("dietaryTags", [...current, tag.value], {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                          }}
                        >
                          {dietaryTagsValue?.includes(tag.value) && <Check className="mr-0.5 size-3" />}
                          <span className="mr-0.5">{tag.emoji}</span>
                          {tag.label}
                        </Button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <EmojiPickerButton
                        value={newDietaryTag.emoji}
                        onChange={(v) => setNewDietaryTag((prev) => ({ ...prev, emoji: v }))}
                        forcePortal
                      />
                      <Input
                        placeholder="Custom dietary tag…"
                        value={newDietaryTag.text}
                        onChange={(e) => setNewDietaryTag((prev) => ({ ...prev, text: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAddCustomDietaryTag() } }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!newDietaryTag.text.trim() || isCreatingTag === "dietary"}
                        onClick={() => void handleAddCustomDietaryTag()}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Attributes</Label>
                    <div className="flex flex-wrap gap-2">
                      {attributeTagOptions.map((tag) => (
                        <Button
                          key={tag.value}
                          type="button"
                          variant="outline"
                          size="sm"
                          className={cn(
                            tagsValue?.includes(tag.value) && "border-orange-500 bg-orange-100 text-orange-700",
                          )}
                          onClick={() => {
                            // Get fresh value from form to avoid stale closure
                            const current = form.getValues("tags") || []
                            if (current.includes(tag.value)) {
                              form.setValue(
                                "tags",
                                current.filter((t) => t !== tag.value),
                                { shouldDirty: true, shouldValidate: true },
                              )
                            } else {
                              form.setValue("tags", [...current, tag.value], {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                          }}
                        >
                          {tagsValue?.includes(tag.value) && <Check className="mr-0.5 size-3" />}
                          <span className="mr-0.5">{tag.emoji}</span>
                          {tag.label}
                        </Button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <EmojiPickerButton
                        value={newAttributeTag.emoji}
                        onChange={(v) => setNewAttributeTag((prev) => ({ ...prev, emoji: v }))}
                        forcePortal
                      />
                      <Input
                        placeholder="Custom attribute tag…"
                        value={newAttributeTag.text}
                        onChange={(e) => setNewAttributeTag((prev) => ({ ...prev, text: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAddCustomAttributeTag() } }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!newAttributeTag.text.trim() || isCreatingTag === "attribute"}
                        onClick={() => void handleAddCustomAttributeTag()}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Nutrition */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Nutrition (Optional)</h3>

                  <div className="space-y-2">
                    <Label htmlFor="calories">Calories</Label>
                    <Input
                      id="calories"
                      type="number"
                      placeholder="e.g., 350"
                      value={form.watch("nutrition.calories") || ""}
                      onChange={(e) =>
                        form.setValue("nutrition.calories", Number.parseInt(e.target.value) || undefined, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Allergens</Label>
                    <div className="flex flex-wrap gap-2">
                      {allergenOptions.map((allergen) => {
                        const isSelected = (allergensValue || []).includes(allergen.value)

                        return (
                          <Button
                            key={allergen.value}
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(isSelected && "border-red-500 bg-red-50 text-red-700")}
                            onClick={() => {
                              const currentAllergens = form.getValues("nutrition.allergens") || []
                              if (currentAllergens.includes(allergen.value)) {
                                form.setValue(
                                  "nutrition.allergens",
                                  currentAllergens.filter((a) => a !== allergen.value),
                                  { shouldDirty: true, shouldValidate: true },
                                )
                              } else {
                                form.setValue("nutrition.allergens", [...currentAllergens, allergen.value], {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                })
                              }
                            }}
                          >
                            {isSelected && <Check className="mr-0.5 size-3" />}
                            <span className="mr-0.5">{allergen.emoji}</span>
                            {allergen.label}
                          </Button>
                        )
                      })}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <EmojiPickerButton
                        value={newAllergenTag.emoji}
                        onChange={(v) => setNewAllergenTag((prev) => ({ ...prev, emoji: v }))}
                        forcePortal
                      />
                      <Input
                        placeholder="Custom allergen…"
                        value={newAllergenTag.text}
                        onChange={(e) => setNewAllergenTag((prev) => ({ ...prev, text: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAddCustomAllergen() } }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!newAllergenTag.text.trim() || isCreatingTag === "allergen"}
                        onClick={() => void handleAddCustomAllergen()}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: CUSTOMIZATIONS */}
              <TabsContent value="customizations" className="mt-0 space-y-6">
                {attachedGroupIds.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Settings2 className="mb-4 size-12 text-gray-400" />
                    <h3 className="mb-2 text-lg font-semibold">No customizations attached</h3>
                    <p className="mb-6 text-sm text-gray-600">
                      Add customization groups to let customers personalize this item
                    </p>
                    <Button type="button" onClick={openAttachGroupDialog}>
                      <Plus className="mr-2 size-4" />
                      Attach First Group
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {attachedGroupIds.map((groupId, index) => {
                      const group = resolveCustomizationGroup(groupId)
                      return (
                      <div
                        key={groupId}
                        draggable
                        onDragStart={() => {
                          setDraggedIndex(index)
                        }}
                        onDragEnd={() => {
                          setDraggedIndex(null)
                          setDragOverIndex(null)
                        }}
                        onDragOver={(e) => {
                          e.preventDefault()
                          if (draggedIndex !== null && draggedIndex !== index) {
                            setDragOverIndex(index)
                          }
                        }}
                        onDragLeave={() => {
                          setDragOverIndex(null)
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (draggedIndex === null || draggedIndex === index) return

                          const groups = form.getValues("customizationGroups") ?? []
                          const newGroups = [...groups]
                          const draggedItem = newGroups[draggedIndex]
                          newGroups.splice(draggedIndex, 1)
                          newGroups.splice(index, 0, draggedItem)
                          form.setValue("customizationGroups", newGroups, { shouldDirty: true, shouldValidate: true })

                          setDraggedIndex(null)
                          setDragOverIndex(null)
                        }}
                        className={cn(
                          "rounded-lg border p-4 transition-all cursor-move",
                          draggedIndex === index && "opacity-50 scale-95",
                          dragOverIndex === index && draggedIndex !== index && "border-orange-500 bg-orange-50",
                          draggedIndex === null && "hover:border-gray-300 hover:bg-gray-50",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <GripVertical
                            className={cn(
                              "mt-1 size-5 transition-colors cursor-grab active:cursor-grabbing",
                              draggedIndex === index ? "text-orange-500" : "text-gray-400 hover:text-gray-600",
                            )}
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 text-left">
                                <h4 className="font-semibold truncate">
                                  {group?.name ?? "Unknown group"}
                                </h4>
                                {group?.customerInstructions ? (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                    {group.customerInstructions}
                                  </p>
                                ) : null}
                                {group ? (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {group.options.length} option{group.options.length === 1 ? "" : "s"}
                                    {group.rules.required ? " · Required" : ""}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 hover:bg-orange-100 hover:text-orange-600"
                                  onClick={() => setEditingCustomizationGroup(groupId)}
                                  title="Configure customization group"
                                  disabled={!group}
                                >
                                  <Settings2 className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 hover:bg-red-100 hover:text-red-600"
                                  onClick={() => {
                                    const groups = form.getValues("customizationGroups") ?? []
                                    form.setValue(
                                      "customizationGroups",
                                      groups.filter((_, i) => i !== index),
                                      { shouldDirty: true, shouldValidate: true },
                                    )
                                  }}
                                  title="Remove customization group"
                                >
                                  <X className="size-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      )
                    })}
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full bg-transparent"
                      onClick={openAttachGroupDialog}
                    >
                      <Plus className="mr-2 size-4" />
                      Attach Customization Group
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* TAB 3: AVAILABILITY */}
              <TabsContent value="availability" className="mt-0 space-y-6">
                {/* Schedule Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                      <svg
                        className="size-4 text-blue-600 dark:text-blue-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-lg">Schedule</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Control when this item is available to customers
                  </p>

                  <RadioGroup
                    value={availabilityModeValue}
                    onValueChange={(value: "menu-hours" | "custom") => {
                      form.setValue("availabilityMode", value, { shouldDirty: true, shouldValidate: true })
                      // When switching to custom mode, ensure there's at least one schedule block
                      if (value === "custom") {
                        const currentSchedule = form.getValues("customSchedule")
                        if (!currentSchedule || currentSchedule.length === 0) {
                          form.setValue("customSchedule", [{ days: [], startTime: "7:00 AM", endTime: "11:00 PM" }], {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                      }
                    }}
                    className="space-y-3"
                  >
                    {/* Menu Hours Option */}
                    <label
                      htmlFor="menu-hours"
                      className={cn(
                        "flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all",
                        availabilityModeValue === "menu-hours"
                          ? "border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 shadow-sm"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-slate-900/50",
                      )}
                    >
                      <RadioGroupItem value="menu-hours" id="menu-hours" className="mt-1" />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Follow menu hours</span>
                          {availabilityModeValue === "menu-hours" && (
                            <span className="rounded-full bg-orange-100 dark:bg-orange-900 px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-300">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Automatically available during assigned menu schedules
                        </p>
                        <div className="mt-3 space-y-2 rounded-lg bg-white dark:bg-slate-950 p-3 border dark:border-slate-800">
                          {selectedCategoryIds.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              Assign a category to see which menu hours this item follows.
                            </p>
                          ) : linkedMenus.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              This item&apos;s categories are not linked to a menu yet.
                            </p>
                          ) : (
                            linkedMenus.map((menu) => (
                              <div key={menu.id} className="flex items-start justify-between gap-3 text-sm">
                                <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                  <span
                                    className={cn(
                                      "size-2 rounded-full",
                                      menu.isActive ? "bg-green-500" : "bg-gray-400",
                                    )}
                                  />
                                  {menu.name}
                                  {!menu.isActive ? (
                                    <span className="text-xs text-muted-foreground">(inactive)</span>
                                  ) : null}
                                </span>
                                <span className="text-right font-medium text-gray-900 dark:text-gray-100">
                                  {formatMenuSchedulePreview(menu.schedule)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </label>

                    {/* Custom Hours Option */}
                    <label
                      htmlFor="custom"
                      className={cn(
                        "flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all",
                        availabilityModeValue === "custom"
                          ? "border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 shadow-sm"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-slate-900/50",
                      )}
                    >
                      <RadioGroupItem value="custom" id="custom" className="mt-1" />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Set custom hours</span>
                          {availabilityModeValue === "custom" && (
                            <span className="rounded-full bg-orange-100 dark:bg-orange-900 px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-300">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Define specific days and times for this item
                        </p>
                      </div>
                    </label>
                  </RadioGroup>

                  {availabilityModeValue === "custom" && (
                    <div className="space-y-4">
                      {form.formState.errors.customSchedule && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.customSchedule.message ??
                            "Select at least one day for custom hours"}
                        </p>
                      )}
                      <div className="rounded-lg border-2 border-orange-200 dark:border-orange-900 bg-orange-50/30 dark:bg-orange-950/20 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-sm">Custom Time Blocks</h4>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => appendSchedule({ days: [], startTime: "7:00 AM", endTime: "11:00 AM" })}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Block
                          </Button>
                        </div>

                        {scheduleFields.map((field, index) => (
                          <div
                            key={field.id}
                            className="border rounded-lg p-4 space-y-4 relative bg-white dark:bg-slate-950 dark:border-slate-800"
                          >
                            {scheduleFields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 size-8"
                                onClick={() => removeSchedule(index)}
                              >
                                <X className="size-4" />
                              </Button>
                            )}

                            {/* Day Selector */}
                            <div className="space-y-2">
                              <Label className="text-sm">Days *</Label>
                              <div className="flex gap-2">
                                {dayNames.map((day, dayIndex) => (
                                  <Button
                                    key={dayIndex}
                                    type="button"
                                    variant={
                                      (customScheduleValue?.[index]?.days || []).includes(dayIndex)
                                        ? "default"
                                        : "outline"
                                    }
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => toggleDay(index, dayIndex)}
                                  >
                                    {day}
                                  </Button>
                                ))}
                              </div>
                            </div>

                            {/* Time Picker */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-sm">From *</Label>
                                <Select
                                  value={customScheduleValue?.[index]?.startTime}
                                  onValueChange={(value) =>
                                    form.setValue(`customSchedule.${index}.startTime` as any, value, {
                                      shouldValidate: true,
                                      shouldDirty: true,
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getOrderedTimeSlots(customScheduleValue?.[index]?.startTime || "").map((time) => (
                                      <SelectItem key={time} value={time}>
                                        {time}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label className="text-sm">To *</Label>
                                <Select
                                  value={customScheduleValue?.[index]?.endTime}
                                  onValueChange={(value) =>
                                    form.setValue(`customSchedule.${index}.endTime` as any, value, {
                                      shouldValidate: true,
                                      shouldDirty: true,
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getOrderedTimeSlots(customScheduleValue?.[index]?.endTime || "").map((time) => (
                                      <SelectItem key={time} value={time}>
                                        {time}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Schedule Preview */}
                        <div className="bg-white dark:bg-slate-950 rounded-lg p-3 border dark:border-slate-800">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="size-4 text-gray-600 dark:text-gray-400" />
                            <span className="text-sm font-medium">Preview</span>
                          </div>
                          <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                            {customScheduleValue?.map((block, index) => {
                              if (!block) return null
                              const dayRanges = (block.days || [])
                                .sort((a: number, b: number) => a - b)
                                .map((d: number) => dayNames[d])
                                .join(", ")
                              return (
                                <p key={index}>
                                  {dayRanges || "No days selected"}: {block.startTime} - {block.endTime}
                                </p>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Status & Visibility Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
                      <svg
                        className="size-4 text-purple-600 dark:text-purple-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.543 7-1.274 4.057-5.064 7-9.543 7-4.477 0-8.268-2.943-9.543-7z"
                        />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-lg">Status & Visibility</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Control how customers see and order this item
                  </p>

                  <RadioGroup
                    value={statusValue}
                    onValueChange={(value: MenuItem["status"]) => {
                      form.setValue("status", value, { shouldDirty: true, shouldValidate: true })
                    }}
                    className="space-y-3"
                  >
                    {/* Live Status */}
                    <label
                      htmlFor="live"
                      className={cn(
                        "flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all",
                        statusValue === "live"
                          ? "border-green-500 bg-green-50/50 dark:bg-green-950/20 shadow-sm"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-slate-900/50",
                      )}
                    >
                      <RadioGroupItem value="live" id="live" className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex size-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                            <Check className="size-3.5 text-green-600 dark:text-green-300" />
                          </div>
                          <span className="font-medium">Live</span>
                          {statusValue === "live" && (
                            <span className="rounded-full bg-green-100 dark:bg-green-900 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Visible and available for customers to order now
                        </p>
                      </div>
                    </label>

                    {/* Sold Out Status */}
                    <label
                      htmlFor="soldout"
                      className={cn(
                        "flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all",
                        statusValue === "soldout"
                          ? "border-red-500 bg-red-50/50 dark:bg-red-950/20 shadow-sm"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-slate-900/50",
                      )}
                    >
                      <RadioGroupItem value="soldout" id="soldout" className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex size-6 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                            <X className="size-3.5 text-red-600 dark:text-red-300" />
                          </div>
                          <span className="font-medium">Sold Out</span>
                          {statusValue === "soldout" && (
                            <span className="rounded-full bg-red-100 dark:bg-red-900 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Visible but marked as unavailable for ordering
                        </p>
                        {statusValue === "soldout" && (
                          <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-950 p-3 border dark:border-amber-900">
                            <p className="text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
                              <AlertCircle className="size-4" />
                              Remember to mark back in stock when available
                            </p>
                          </div>
                        )}
                      </div>
                    </label>

                    {/* Hidden Status */}
                    <label
                      htmlFor="hidden"
                      className={cn(
                        "flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all",
                        statusValue === "hidden"
                          ? "border-gray-500 bg-gray-50/50 dark:bg-gray-900/20 shadow-sm"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-slate-900/50",
                      )}
                    >
                      <RadioGroupItem value="hidden" id="hidden" className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex size-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                            <svg
                              className="size-3.5 text-gray-600 dark:text-gray-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29M7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                              />
                            </svg>
                          </div>
                          <span className="font-medium">Hidden</span>
                          {statusValue === "hidden" && (
                            <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Not visible to customers, only visible to staff
                        </p>
                      </div>
                    </label>

                    {/* Draft Status */}
                    <label
                      htmlFor="draft"
                      className={cn(
                        "flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all",
                        statusValue === "draft"
                          ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-slate-900/50",
                      )}
                    >
                      <RadioGroupItem value="draft" id="draft" className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex size-6 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                            <svg
                              className="size-3.5 text-blue-600 dark:text-blue-300"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </div>
                          <span className="font-medium">Draft</span>
                          {statusValue === "draft" && (
                            <span className="rounded-full bg-blue-100 dark:bg-blue-900 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Work in progress, not published to customers yet
                        </p>
                      </div>
                    </label>
                  </RadioGroup>

                  <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                    <div className="min-w-0 space-y-1">
                      <Label htmlFor="featured-toggle" className="text-base font-medium">
                        Featured
                      </Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Show this item in the guest menu Featured strip
                        {statusValue !== "live"
                          ? " (appears once status is Live)"
                          : ""}
                        .
                      </p>
                    </div>
                    <Switch
                      id="featured-toggle"
                      checked={featuredValue}
                      onCheckedChange={handleFeaturedChange}
                    />
                  </div>
                </div>
              </TabsContent>
            </div>
          </div>
        </Tabs>

        {/* Footer */}
        <SheetFooter className="sticky bottom-0 border-t bg-white dark:bg-slate-950 p-4 z-50">
          <div className="flex w-full gap-2">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="button"
              variant="outline" 
              onClick={() => handleSave(false)} 
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              type="button"
              className="bg-orange-600 hover:bg-orange-700 relative z-50 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handleSave(true)}
              disabled={isSaving || statusValue === "draft"}
              title={statusValue === "draft" ? "Cannot publish a draft item. Change status to Live first, or use Save Draft." : undefined}
            >
              {isSaving ? "Saving..." : "Save & Publish"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>

      {/* Unsaved Changes Modal */}
      <UnsavedChangesModal
        open={showUnsavedModal}
        onOpenChange={setShowUnsavedModal}
        onDiscard={handleDiscardChanges}
        onSave={handleSaveAndClose}
        onCancel={handleCancelUnsaved}
        isSaving={isSaving}
      />

      <Dialog open={attachGroupDialogOpen} onOpenChange={setAttachGroupDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Attach customization group</DialogTitle>
            <DialogDescription>
              Choose an existing group to attach to this item, or create a new one.
            </DialogDescription>
          </DialogHeader>

          {availableGroupsToAttach.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {customizationGroups.length === 0
                ? "No customization groups exist yet for this location."
                : "All customization groups are already attached to this item."}
            </div>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {availableGroupsToAttach.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className="flex w-full flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors hover:border-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-950/20"
                  onClick={() => attachCustomizationGroup(group.id)}
                >
                  <span className="font-medium">{group.name}</span>
                  {group.customerInstructions ? (
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {group.customerInstructions}
                    </span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {group.options.length} option{group.options.length === 1 ? "" : "s"}
                    {group.rules.required ? " · Required" : ""}
                  </span>
                </button>
              ))}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAttachGroupDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={openCreateCustomizationGroup}>
              <Plus className="mr-2 size-4" />
              Create New Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomizationDrawer
        group={
          editingCustomizationGroup
            ? customizationGroups.find(g => g.id === editingCustomizationGroup) || {
                id: editingCustomizationGroup,
                name: "",
                customerInstructions: "",
                internalNotes: "",
                rules: { min: 0, max: 1, required: false },
                options: [],
                itemCount: 0,
                itemNames: [],
              }
            : null
        }
        isOpen={showCustomizationDrawer}
        onClose={() => {
          setShowCustomizationDrawer(false)
          setEditingCustomizationGroup(null)
          setCreatingGroupFromAttach(false)
        }}
        onSave={async (customization) => {
          try {
            if (editingCustomizationGroup) {
              await updateCustomizationGroup(customization.id, customization)
            } else {
              const created = await createCustomizationGroup(customization)
              if (creatingGroupFromAttach && created?.id) {
                attachCustomizationGroup(created.id)
              }
            }
            setShowCustomizationDrawer(false)
            setEditingCustomizationGroup(null)
            setCreatingGroupFromAttach(false)
          } catch (error) {
            console.error("Failed to save customization:", error)
          }
        }}
        onDelete={async (id) => {
          try {
            await deleteCustomizationGroup(id)
            const groups = form.getValues("customizationGroups") ?? []
            form.setValue(
              "customizationGroups",
              groups.filter((groupId) => groupId !== id),
              { shouldDirty: true, shouldValidate: true },
            )
            setShowCustomizationDrawer(false)
            setEditingCustomizationGroup(null)
            setCreatingGroupFromAttach(false)
          } catch (error) {
            console.error("Failed to delete customization:", error)
          }
        }}
        availableGroups={customizationGroups}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDelete}
        entityType="item"
        entityName={item?.name || "this item"}
      />
    </Sheet>
  )
}
