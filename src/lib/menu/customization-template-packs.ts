import type {
  CreateCustomizationGroupInput,
  CreatedCustomizationGroup,
} from "@/types/customization"

export type CustomizationTemplatePackId =
  | "pizza-size-toppings"
  | "protein-upgrade"
  | "drink-size-addins"

export type CustomizationTemplatePack = {
  id: CustomizationTemplatePackId
  name: string
  icon: string
  description: string
  features: string[]
  createsGroupCount: number
}

export const CUSTOMIZATION_TEMPLATE_PACKS: CustomizationTemplatePack[] = [
  {
    id: "pizza-size-toppings",
    name: "Pizza Size + Toppings",
    icon: "🍕",
    description: "Size group plus toppings priced by size",
    features: ["Conditional pricing"],
    createsGroupCount: 2,
  },
  {
    id: "protein-upgrade",
    name: "Protein Upgrade",
    icon: "🥩",
    description: "Optional upgrade that reveals a protein choice group",
    features: ["Secondary groups"],
    createsGroupCount: 2,
  },
  {
    id: "drink-size-addins",
    name: "Drink Size + Add-ins",
    icon: "🧋",
    description: "Drink size with add-in limits that grow by size",
    features: ["Conditional quantities"],
    createsGroupCount: 2,
  },
]

type CreateGroupFn = (
  group: CreateCustomizationGroupInput,
  options?: { silent?: boolean },
) => Promise<CreatedCustomizationGroup | null>

function optionIdByName(
  created: CreatedCustomizationGroup,
  name: string,
): string {
  const match = created.options.find(
    (option) => option.name.toLowerCase() === name.toLowerCase(),
  )
  if (!match) {
    throw new Error(`Created group is missing option "${name}"`)
  }
  return match.id
}

function withOrders(
  options: Array<{
    id: string
    name: string
    priceDelta: number
    isDefault: boolean
  }>,
): CreateCustomizationGroupInput["options"] {
  return options.map((option, index) => ({
    ...option,
    order: index,
  }))
}

async function createPizzaSizeToppingsPack(
  create: CreateGroupFn,
  uniqueName: (base: string) => string,
): Promise<void> {
  const size = await create(
    {
      name: uniqueName("Pizza Size"),
      customerInstructions: "Choose your size",
      rules: { min: 1, max: 1, required: true },
      options: withOrders([
        { id: "pack-pizza-size-s", name: "Small", priceDelta: 0, isDefault: true },
        { id: "pack-pizza-size-m", name: "Medium", priceDelta: 2, isDefault: false },
        { id: "pack-pizza-size-l", name: "Large", priceDelta: 4, isDefault: false },
      ]),
    },
    { silent: true },
  )
  if (!size) throw new Error("Failed to create Pizza Size group")

  const smallId = optionIdByName(size, "Small")
  const mediumId = optionIdByName(size, "Medium")
  const largeId = optionIdByName(size, "Large")

  const toppingDefs = [
    { id: "pack-top-cheese", name: "Extra Cheese", prices: [1, 1.5, 2] },
    { id: "pack-top-pepperoni", name: "Pepperoni", prices: [1.5, 2, 2.5] },
    { id: "pack-top-mushrooms", name: "Mushrooms", prices: [1, 1.25, 1.5] },
    { id: "pack-top-olives", name: "Olives", prices: [1, 1.25, 1.5] },
    { id: "pack-top-jalapenos", name: "Jalapeños", prices: [0.75, 1, 1.25] },
  ] as const

  const priceMatrix: Record<string, Record<string, number>> = {}
  for (const topping of toppingDefs) {
    priceMatrix[topping.id] = {
      [smallId]: topping.prices[0],
      [mediumId]: topping.prices[1],
      [largeId]: topping.prices[2],
    }
  }

  const toppings = await create(
    {
      name: uniqueName("Pizza Toppings"),
      customerInstructions: "Add toppings (priced by size)",
      rules: { min: 0, max: 8, required: false },
      options: withOrders(
        toppingDefs.map((topping) => ({
          id: topping.id,
          name: topping.name,
          priceDelta: topping.prices[0],
          isDefault: false,
        })),
      ),
      conditionalPricing: {
        enabled: true,
        basedOnGroupId: size.id,
        priceMatrix,
      },
    },
    { silent: true },
  )
  if (!toppings) throw new Error("Failed to create Pizza Toppings group")
}

async function createProteinUpgradePack(
  create: CreateGroupFn,
  uniqueName: (base: string) => string,
): Promise<void> {
  const protein = await create(
    {
      name: uniqueName("Protein Choice"),
      customerInstructions: "Pick your protein",
      rules: { min: 1, max: 1, required: true },
      options: withOrders([
        { id: "pack-protein-chicken", name: "Chicken", priceDelta: 0, isDefault: true },
        { id: "pack-protein-beef", name: "Beef", priceDelta: 1.5, isDefault: false },
        { id: "pack-protein-shrimp", name: "Shrimp", priceDelta: 2.5, isDefault: false },
        { id: "pack-protein-tofu", name: "Tofu", priceDelta: 0, isDefault: false },
      ]),
    },
    { silent: true },
  )
  if (!protein) throw new Error("Failed to create Protein Choice group")

  const upgrade = await create(
    {
      name: uniqueName("Add Protein Upgrade"),
      customerInstructions: "Want a protein upgrade?",
      rules: { min: 1, max: 1, required: true },
      options: withOrders([
        {
          id: "pack-protein-no-upgrade",
          name: "No upgrade",
          priceDelta: 0,
          isDefault: true,
        },
        {
          id: "pack-protein-yes-upgrade",
          name: "Add protein upgrade",
          priceDelta: 2,
          isDefault: false,
        },
      ]),
      secondaryGroups: {
        rules: [
          {
            id: "pack-protein-upgrade-rule",
            triggerOptionId: "pack-protein-yes-upgrade",
            showGroupId: protein.id,
            required: true,
          },
        ],
      },
    },
    { silent: true },
  )
  if (!upgrade) throw new Error("Failed to create Add Protein Upgrade group")
}

async function createDrinkSizeAddinsPack(
  create: CreateGroupFn,
  uniqueName: (base: string) => string,
): Promise<void> {
  const size = await create(
    {
      name: uniqueName("Drink Size"),
      customerInstructions: "Choose your drink size",
      rules: { min: 1, max: 1, required: true },
      options: withOrders([
        { id: "pack-drink-size-s", name: "Small", priceDelta: 0, isDefault: true },
        { id: "pack-drink-size-m", name: "Medium", priceDelta: 0.5, isDefault: false },
        { id: "pack-drink-size-l", name: "Large", priceDelta: 1, isDefault: false },
      ]),
    },
    { silent: true },
  )
  if (!size) throw new Error("Failed to create Drink Size group")

  const smallId = optionIdByName(size, "Small")
  const mediumId = optionIdByName(size, "Medium")
  const largeId = optionIdByName(size, "Large")

  const addins = await create(
    {
      name: uniqueName("Drink Add-ins"),
      customerInstructions: "Add extras (limits grow with size)",
      rules: { min: 0, max: 3, required: false },
      options: withOrders([
        { id: "pack-addin-pearls", name: "Tapioca Pearls", priceDelta: 0.75, isDefault: false },
        { id: "pack-addin-jelly", name: "Coconut Jelly", priceDelta: 0.75, isDefault: false },
        { id: "pack-addin-pudding", name: "Pudding", priceDelta: 0.75, isDefault: false },
        { id: "pack-addin-aloe", name: "Aloe", priceDelta: 0.5, isDefault: false },
        { id: "pack-addin-cream", name: "Cheese Foam", priceDelta: 1, isDefault: false },
      ]),
      conditionalQuantities: {
        enabled: true,
        basedOnGroupId: size.id,
        rulesMatrix: {
          [smallId]: { min: 0, max: 1, required: false, maxPerOption: 1 },
          [mediumId]: { min: 0, max: 2, required: false, maxPerOption: 1 },
          [largeId]: { min: 0, max: 3, required: false, maxPerOption: 2 },
        },
      },
    },
    { silent: true },
  )
  if (!addins) throw new Error("Failed to create Drink Add-ins group")
}

export async function applyCustomizationTemplatePack(
  packId: string,
  create: CreateGroupFn,
  uniqueName: (base: string) => string,
): Promise<CustomizationTemplatePack> {
  const pack = CUSTOMIZATION_TEMPLATE_PACKS.find((entry) => entry.id === packId)
  if (!pack) {
    throw new Error("Advanced template pack not found")
  }

  switch (pack.id) {
    case "pizza-size-toppings":
      await createPizzaSizeToppingsPack(create, uniqueName)
      break
    case "protein-upgrade":
      await createProteinUpgradePack(create, uniqueName)
      break
    case "drink-size-addins":
      await createDrinkSizeAddinsPack(create, uniqueName)
      break
    default: {
      const _exhaustive: never = pack.id
      throw new Error(`Unhandled pack: ${String(_exhaustive)}`)
    }
  }

  return pack
}
