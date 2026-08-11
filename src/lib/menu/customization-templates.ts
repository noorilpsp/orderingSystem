import type { CustomizationGroup } from "@/types/customization"

export type CustomizationTemplate = {
  id: string
  name: string
  icon: string
  customerInstructions: string
  rules: CustomizationGroup["rules"]
  options: Array<{
    name: string
    priceDelta: number
    isDefault: boolean
  }>
}

export const CUSTOMIZATION_TEMPLATES: CustomizationTemplate[] = [
  {
    id: "pizza-size",
    name: "Pizza Size",
    icon: "🍕",
    customerInstructions: "Choose your size",
    rules: { min: 1, max: 1, required: true },
    options: [
      { name: "Small", priceDelta: 0, isDefault: true },
      { name: "Medium", priceDelta: 2, isDefault: false },
      { name: "Large", priceDelta: 4, isDefault: false },
    ],
  },
  {
    id: "spice-level",
    name: "Spice Level",
    icon: "🌶️",
    customerInstructions: "How spicy would you like it?",
    rules: { min: 1, max: 1, required: true },
    options: [
      { name: "Mild", priceDelta: 0, isDefault: true },
      { name: "Medium", priceDelta: 0, isDefault: false },
      { name: "Hot", priceDelta: 0, isDefault: false },
    ],
  },
  {
    id: "protein-choice",
    name: "Protein Choice",
    icon: "🍖",
    customerInstructions: "Pick your protein",
    rules: { min: 1, max: 1, required: true },
    options: [
      { name: "Chicken", priceDelta: 0, isDefault: true },
      { name: "Beef", priceDelta: 1.5, isDefault: false },
      { name: "Shrimp", priceDelta: 2.5, isDefault: false },
      { name: "Tofu", priceDelta: 0, isDefault: false },
    ],
  },
  {
    id: "side-options",
    name: "Side Options",
    icon: "🍟",
    customerInstructions: "Add sides (optional)",
    rules: { min: 0, max: 3, required: false },
    options: [
      { name: "Fries", priceDelta: 2.5, isDefault: false },
      { name: "Salad", priceDelta: 3, isDefault: false },
      { name: "Coleslaw", priceDelta: 1.5, isDefault: false },
      { name: "Soup", priceDelta: 3.5, isDefault: false },
      { name: "Bread", priceDelta: 1, isDefault: false },
    ],
  },
  {
    id: "drink-size",
    name: "Drink Size",
    icon: "🥤",
    customerInstructions: "Choose your drink size",
    rules: { min: 1, max: 1, required: true },
    options: [
      { name: "Small", priceDelta: 0, isDefault: true },
      { name: "Medium", priceDelta: 0.5, isDefault: false },
      { name: "Large", priceDelta: 1, isDefault: false },
    ],
  },
  {
    id: "sauce-choice",
    name: "Sauce Choice",
    icon: "🫙",
    customerInstructions: "Pick a sauce",
    rules: { min: 1, max: 1, required: true },
    options: [
      { name: "BBQ", priceDelta: 0, isDefault: true },
      { name: "Ranch", priceDelta: 0, isDefault: false },
      { name: "Garlic", priceDelta: 0, isDefault: false },
      { name: "Hot Sauce", priceDelta: 0, isDefault: false },
      { name: "No Sauce", priceDelta: 0, isDefault: false },
    ],
  },
  {
    id: "extra-toppings",
    name: "Extra Toppings",
    icon: "🧀",
    customerInstructions: "Add extras (optional)",
    rules: { min: 0, max: 8, required: false },
    options: [
      { name: "Extra Cheese", priceDelta: 1.5, isDefault: false },
      { name: "Bacon", priceDelta: 2, isDefault: false },
      { name: "Avocado", priceDelta: 1.5, isDefault: false },
      { name: "Jalapeños", priceDelta: 0.75, isDefault: false },
      { name: "Mushrooms", priceDelta: 1, isDefault: false },
      { name: "Onions", priceDelta: 0.5, isDefault: false },
      { name: "Peppers", priceDelta: 0.75, isDefault: false },
      { name: "Olives", priceDelta: 0.75, isDefault: false },
    ],
  },
  {
    id: "cooking-preference",
    name: "Cooking Preference",
    icon: "🔥",
    customerInstructions: "How would you like it cooked?",
    rules: { min: 1, max: 1, required: true },
    options: [
      { name: "Rare", priceDelta: 0, isDefault: false },
      { name: "Medium Rare", priceDelta: 0, isDefault: true },
      { name: "Medium", priceDelta: 0, isDefault: false },
      { name: "Medium Well", priceDelta: 0, isDefault: false },
      { name: "Well Done", priceDelta: 0, isDefault: false },
    ],
  },
  {
    id: "remove-leave-off",
    name: "Remove / Leave Off",
    icon: "🚫",
    customerInstructions: "Anything to leave off?",
    rules: { min: 0, max: 6, required: false },
    options: [
      { name: "No Onion", priceDelta: 0, isDefault: false },
      { name: "No Tomato", priceDelta: 0, isDefault: false },
      { name: "No Pickles", priceDelta: 0, isDefault: false },
      { name: "No Lettuce", priceDelta: 0, isDefault: false },
      { name: "No Mayo", priceDelta: 0, isDefault: false },
      { name: "No Cheese", priceDelta: 0, isDefault: false },
    ],
  },
  {
    id: "milk-choice",
    name: "Milk Choice",
    icon: "🥛",
    customerInstructions: "Choose your milk",
    rules: { min: 1, max: 1, required: true },
    options: [
      { name: "Whole Milk", priceDelta: 0, isDefault: true },
      { name: "Skim Milk", priceDelta: 0, isDefault: false },
      { name: "Oat Milk", priceDelta: 0.75, isDefault: false },
      { name: "Almond Milk", priceDelta: 0.75, isDefault: false },
      { name: "Soy Milk", priceDelta: 0.5, isDefault: false },
    ],
  },
  {
    id: "drink-temp",
    name: "Hot or Iced",
    icon: "❄️",
    customerInstructions: "Hot or iced?",
    rules: { min: 1, max: 1, required: true },
    options: [
      { name: "Hot", priceDelta: 0, isDefault: true },
      { name: "Iced", priceDelta: 0, isDefault: false },
    ],
  },
  {
    id: "sweetness",
    name: "Sweetness",
    icon: "🍬",
    customerInstructions: "How sweet?",
    rules: { min: 1, max: 1, required: true },
    options: [
      { name: "0%", priceDelta: 0, isDefault: false },
      { name: "25%", priceDelta: 0, isDefault: false },
      { name: "50%", priceDelta: 0, isDefault: true },
      { name: "75%", priceDelta: 0, isDefault: false },
      { name: "100%", priceDelta: 0, isDefault: false },
    ],
  },
  {
    id: "ice-level",
    name: "Ice Level",
    icon: "🧊",
    customerInstructions: "How much ice?",
    rules: { min: 1, max: 1, required: true },
    options: [
      { name: "Regular Ice", priceDelta: 0, isDefault: true },
      { name: "Less Ice", priceDelta: 0, isDefault: false },
      { name: "No Ice", priceDelta: 0, isDefault: false },
      { name: "Extra Ice", priceDelta: 0, isDefault: false },
    ],
  },
  {
    id: "crust-type",
    name: "Crust Type",
    icon: "🫓",
    customerInstructions: "Choose your crust",
    rules: { min: 1, max: 1, required: true },
    options: [
      { name: "Regular", priceDelta: 0, isDefault: true },
      { name: "Thin", priceDelta: 0, isDefault: false },
      { name: "Thick", priceDelta: 1, isDefault: false },
      { name: "Gluten-Free", priceDelta: 2.5, isDefault: false },
    ],
  },
  {
    id: "dressing-choice",
    name: "Dressing / Base",
    icon: "🥗",
    customerInstructions: "Pick a dressing or base",
    rules: { min: 1, max: 1, required: true },
    options: [
      { name: "Ranch", priceDelta: 0, isDefault: true },
      { name: "Caesar", priceDelta: 0, isDefault: false },
      { name: "Balsamic", priceDelta: 0, isDefault: false },
      { name: "Italian", priceDelta: 0, isDefault: false },
      { name: "On the Side", priceDelta: 0, isDefault: false },
      { name: "No Dressing", priceDelta: 0, isDefault: false },
    ],
  },
]

export function customizationGroupFromTemplate(
  template: CustomizationTemplate,
): Omit<CustomizationGroup, "id" | "itemCount" | "itemNames"> {
  return {
    name: template.name,
    customerInstructions: template.customerInstructions,
    rules: template.rules,
    options: template.options.map((option, index) => ({
      id: `template-${template.id}-${index}`,
      name: option.name,
      priceDelta: option.priceDelta,
      isDefault: option.isDefault,
      order: index,
    })),
  }
}
