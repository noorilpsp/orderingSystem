import type { CatalogI18n } from "@/lib/catalog-i18n";

export type CustomizationOption = {
  id: string;
  name: string;
  price: number;
  i18n?: CatalogI18n | null;
  conditionalPrices?: {
    baseGroupId: string;
    prices: Array<{ baseOptionId: string; price: number }>;
  };
};

export type CustomizationGroup = {
  id: string;
  name: string;
  customerInstructions?: string;
  i18n?: CatalogI18n | null;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  isSecondary?: boolean;
  triggerRule?: {
    triggerGroupId: string;
    triggerOptionId: string;
  };
  conditionalQuantities?: {
    baseGroupId: string;
    rules: Array<{ baseOptionId: string; maxSelections: number }>;
  };
  options: CustomizationOption[];
};

export type MenuItemDetail = {
  id: string;
  name: string;
  description: string;
  image: string;
  basePrice: number;
  calories?: number;
  tags: Array<{ name: string }>;
  status: "live" | "soldout";
};

export const menuItemModalData: MenuItemDetail = {
  id: "1",
  name: "Margherita",
  description:
    "Hand-stretched dough topped with San Marzano tomato sauce, fresh mozzarella di bufala, fragrant basil leaves, and a drizzle of extra virgin olive oil. Baked to perfection in our wood-fired oven.",
  image: "/pizza-margherita.jpg",
  basePrice: 12.0,
  calories: 850,
  tags: [{ name: "Vegetarian" }],
  status: "live",
};

export const customizationGroups: CustomizationGroup[] = [
  {
    id: "size",
    name: "Choose Size",
    isRequired: true,
    minSelections: 1,
    maxSelections: 1,
    options: [
      { id: "small", name: "Small (10\")", price: 12.0 },
      { id: "medium", name: "Medium (12\")", price: 14.0 },
      { id: "large", name: "Large (14\")", price: 18.0 },
    ],
  },
  {
    id: "toppings",
    name: "Extra Toppings",
    isRequired: false,
    minSelections: 0,
    maxSelections: 5,
    conditionalQuantities: {
      baseGroupId: "size",
      rules: [
        { baseOptionId: "small", maxSelections: 3 },
        { baseOptionId: "medium", maxSelections: 5 },
        { baseOptionId: "large", maxSelections: 6 },
      ],
    },
    options: [
      {
        id: "mushrooms",
        name: "Mushrooms",
        price: 1.5,
        conditionalPrices: {
          baseGroupId: "size",
          prices: [
            { baseOptionId: "small", price: 1.0 },
            { baseOptionId: "medium", price: 1.5 },
            { baseOptionId: "large", price: 2.5 },
          ],
        },
      },
      {
        id: "olives",
        name: "Olives",
        price: 1.0,
        conditionalPrices: {
          baseGroupId: "size",
          prices: [
            { baseOptionId: "small", price: 1.0 },
            { baseOptionId: "medium", price: 1.5 },
            { baseOptionId: "large", price: 2.0 },
          ],
        },
      },
      {
        id: "extra-cheese",
        name: "Extra Cheese",
        price: 2.0,
        conditionalPrices: {
          baseGroupId: "size",
          prices: [
            { baseOptionId: "small", price: 1.5 },
            { baseOptionId: "medium", price: 2.0 },
            { baseOptionId: "large", price: 3.0 },
          ],
        },
      },
      { id: "peppers", name: "Peppers", price: 1.0 },
      { id: "onions", name: "Onions", price: 1.0 },
      { id: "jalapenos", name: "Jalapeños", price: 1.5 },
    ],
  },
  {
    id: "free-drink",
    name: "🎁 Free Drink",
    customerInstructions: "Included with Large pizza",
    isRequired: true,
    minSelections: 1,
    maxSelections: 1,
    isSecondary: true,
    triggerRule: {
      triggerGroupId: "size",
      triggerOptionId: "large",
    },
    options: [
      { id: "cola", name: "Coca-Cola", price: 0 },
      { id: "sprite", name: "Sprite", price: 0 },
      { id: "fanta", name: "Fanta", price: 0 },
      { id: "water", name: "Sparkling Water", price: 0 },
    ],
  },
  {
    id: "sauces",
    name: "Sauces",
    isRequired: false,
    minSelections: 0,
    maxSelections: 99,
    options: [
      { id: "marinara", name: "Marinara", price: 0.5 },
      { id: "garlic-aioli", name: "Garlic Aioli", price: 0.75 },
      { id: "pesto", name: "Pesto", price: 1.0 },
      { id: "bbq", name: "BBQ", price: 0.5 },
      { id: "hot-chili", name: "Hot Chili", price: 0.75 },
      { id: "ranch", name: "Ranch", price: 0.75 },
    ],
  },
];
