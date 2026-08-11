import type { CatalogI18n } from "@/lib/catalog-i18n"

export interface CustomizationOption {
  id: string
  name: string
  priceDelta: number
  isDefault: boolean
  order: number
  /** Optional locale overrides; primary `name` stays English. */
  i18n?: CatalogI18n | null
  /** Form field for Arabic option name (dashboard drawer). */
  nameAr?: string
}

export interface CustomizationGroup {
  id: string
  name: string
  customerInstructions: string
  internalNotes?: string
  /** Optional locale overrides; primary copy stays English. */
  i18n?: CatalogI18n | null
  /** Form field for Arabic group name (dashboard drawer). */
  nameAr?: string
  /** Form field for Arabic customer instructions (dashboard drawer). */
  customerInstructionsAr?: string
  rules: {
    min: number
    max: number
    required: boolean
  }
  options: CustomizationOption[]
  itemCount: number
  itemNames: string[]
}

export interface CustomizationsContentProps {
  groups: CustomizationGroup[]
  onCreateGroup: () => void
  onEditGroup: (id: string) => void
  onDeleteGroup: (id: string) => void
  onDuplicateGroup: (id: string) => void
  onUseTemplate?: (templateId: string) => void | Promise<void>
  onUseTemplatePack?: (packId: string) => void | Promise<void>
}

export interface ConditionalPricing {
  enabled: boolean
  basedOnGroupId: string
  priceMatrix: {
    [optionId: string]: {
      [baseOptionId: string]: number
    }
  }
}

export interface ConditionalQuantities {
  enabled: boolean
  basedOnGroupId: string
  rulesMatrix: {
    [baseOptionId: string]: {
      min: number
      max: number
      required: boolean
      maxPerOption: number
    }
  }
}

export interface SecondaryGroupRule {
  id: string
  triggerOptionId: string
  showGroupId: string
  required: boolean
}

export interface SecondaryGroups {
  rules: SecondaryGroupRule[]
}

export interface DefaultSelections {
  [optionId: string]: number
}

export interface AdvancedCustomizationGroup extends CustomizationGroup {
  conditionalPricing?: ConditionalPricing
  conditionalQuantities?: ConditionalQuantities
  secondaryGroups?: SecondaryGroups
  defaultSelections?: DefaultSelections
}

/** Payload accepted when creating a group (basic + advanced). */
export type CreateCustomizationGroupInput = Omit<
  CustomizationGroup,
  "id" | "itemCount" | "itemNames"
> & {
  conditionalPricing?: ConditionalPricing
  conditionalQuantities?: ConditionalQuantities
  secondaryGroups?: SecondaryGroups
  defaultSelections?: DefaultSelections
}

export type CreatedCustomizationGroup = {
  id: string
  options: Array<{ id: string; name: string }>
}
