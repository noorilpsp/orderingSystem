import type { CatalogI18n } from "@/lib/catalog-i18n"

export interface Category {
  id: string
  name: string
  emoji?: string
  description?: string
  /** Optional Arabic (etc.) overrides for guest menu. */
  i18n?: CatalogI18n | null
  displayOrder: number
  itemCount: number
  menuIds: string[]
  menuNames: string[]
  isExpanded?: boolean
}

export interface CategoriesContentProps {
  categories: Category[]
  items?: any[] // Menu items to count associations
  onCreateCategory: () => void
  onEditCategory: (id: string) => void
  onDeleteCategory: (id: string) => void
  onReorder: (categories: Category[]) => void
  uncategorizedCount?: number
  isLoading?: boolean
}
