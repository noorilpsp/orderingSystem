"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { X, AlertCircle } from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { EmojiInputField } from "@/components/emoji-input-field"
import { MenuSelector } from "@/components/menu-selector"
import { UnsavedChangesModal } from "@/components/modals/unsaved-changes-modal"
import type { Menu } from "@/types/menu"
import type { CatalogI18n } from "@/lib/catalog-i18n"
import { normalizeCatalogI18n } from "@/lib/catalog-i18n"

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
  nameAr: z.string().max(50).optional(),
  descriptionAr: z.string().max(260).optional(),
  menuIds: z.array(z.string()),
  emoji: z.string().optional(),
})

type CategoryFormData = z.infer<typeof categorySchema>

export type CreateCategorySaveData = {
  name: string
  description?: string
  menuIds: string[]
  emoji?: string
  i18n?: CatalogI18n | null
}

interface CreateCategoryDrawerProps {
  isOpen: boolean
  onClose: () => void
  menus?: Menu[]
  onSave: (data: CreateCategorySaveData) => void
}

function toSaveData(formData: CategoryFormData): CreateCategorySaveData {
  return {
    name: formData.name,
    description: formData.description,
    menuIds: formData.menuIds,
    emoji: formData.emoji,
    i18n: normalizeCatalogI18n({
      ar: { name: formData.nameAr, description: formData.descriptionAr },
    }),
  }
}

export function CreateCategoryDrawer({ isOpen, onClose, menus = [], onSave }: CreateCategoryDrawerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  // Ensure menus is always an array and updates when menus prop changes
  const safeMenus = useMemo(() => {
    return Array.isArray(menus) ? menus : []
  }, [menus])

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      description: "",
      nameAr: "",
      descriptionAr: "",
      menuIds: [],
      emoji: "",
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    watch,
    reset,
  } = form

  const selectedMenuIds = watch("menuIds") || []
  const nameArValue = watch("nameAr")
  const descriptionArValue = watch("descriptionAr")

  const onSubmit = async (data: CategoryFormData) => {
    setIsSubmitting(true)
    try {
      await onSave(toSaveData(data))
      toast.success("Category created successfully!")
      reset()
      onClose()
    } catch (error) {
      toast.error("Failed to create category")
    } finally {
      setIsSubmitting(false)
    }
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
    form.reset()
    setShowUnsavedModal(false)
    setIsClosing(true)
    onClose()
  }

  const handleSaveAndClose = async () => {
    setShowUnsavedModal(false)
    await handleSave("draft")
    setIsClosing(true)
    onClose()
  }

  const handleCancelUnsaved = () => {
    setShowUnsavedModal(false)
  }

  const handleSave = async (status: "draft" | "live") => {
    setIsSubmitting(true)
    try {
      const formData = form.getValues()
      await onSave(toSaveData(formData))
      toast.success("Category created successfully!")
      reset()
      onClose()
    } catch (error) {
      toast.error("Failed to create category")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className={cn(
          "w-full p-0 gap-0 sm:max-w-[480px] flex flex-col h-full",
          "md:w-[480px]",
          "max-md:h-screen max-md:rounded-none",
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-white dark:bg-slate-950">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={handleClose} className="size-8">
                <X className="size-4" />
              </Button>
              <SheetTitle className="text-lg font-semibold">Create New Category</SheetTitle>
            </div>
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
                <Button size="sm" onClick={() => handleSave("draft")} disabled={isSubmitting}>
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="px-6 pt-6 pb-20 space-y-6">
              {/* Icon/Emoji */}
              <div className="space-y-2">
                <Label>Icon/Emoji (optional)</Label>
                <EmojiInputField
                  value={watch("emoji") || ""}
                  onChange={(value) => setValue("emoji", value, { shouldDirty: true, shouldValidate: true })}
                  placeholder="Or type emoji here..."
                  forcePortal={true}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Choose an emoji or type initials to represent this category
                </p>
              </div>

              {/* Category Name */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Category Name <span className="text-red-500">*</span>
                </Label>
                <Input id="name" placeholder="e.g., Appetizers" autoFocus {...register("name")} />
                <p className="text-xs text-gray-500 dark:text-gray-400">Choose a clear, descriptive name</p>
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  rows={3}
                  placeholder="Internal notes about this category..."
                  {...register("description")}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">Not shown to customers</p>
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
                    placeholder="مثال: المقبلات"
                    {...register("nameAr")}
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{errors.nameAr?.message}</span>
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
                    {...register("descriptionAr")}
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{errors.descriptionAr?.message}</span>
                    <span>{descriptionArValue?.length || 0}/260</span>
                  </div>
                </div>
              </div>

              {/* Add to Menus */}
              <div className="space-y-2">
                <Label>Add to Menus (optional)</Label>
                {safeMenus.length > 0 ? (
                  <MenuSelector
                    menus={safeMenus.map((menu) => ({
                      id: menu.id,
                      label: menu.name,
                    }))}
                    selected={selectedMenuIds}
                    onChange={(selectedIds) =>
                      setValue("menuIds", selectedIds, { shouldDirty: true, shouldValidate: true })
                    }
                    placeholder="Search menus..."
                  />
                ) : (
                  <div className="text-sm text-muted-foreground p-4 border rounded-md">
                    No menus available. Please create a menu first.
                  </div>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Select which menus this category should appear in
                </p>
              </div>
            </div>
          </div>

          <SheetFooter className="sticky bottom-0 border-t bg-white dark:bg-slate-950 p-4">
            <div className="flex w-full gap-2">
              <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Category"}
              </Button>
            </div>
          </SheetFooter>
        </form>

        {/* Unsaved Changes Modal */}
        <UnsavedChangesModal
          open={showUnsavedModal}
          onOpenChange={setShowUnsavedModal}
          onDiscard={handleDiscardChanges}
          onSave={handleSaveAndClose}
          onCancel={handleCancelUnsaved}
          isSaving={isSubmitting}
        />
      </SheetContent>
    </Sheet>
  )
}
