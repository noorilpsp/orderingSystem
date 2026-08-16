export const restaurant = {
  name: "Pizza Palace",
  description: "Authentic, fresh Italian pizza since 1985.",
  bannerUrl: null as string | null,
  logoUrl: null as string | null,
  address: "123 Main Street, Brussels",
  phone: "+32 2 123 4567",
  website: "www.pizzapalace.be",
  currency: "EUR",
  defaultLanguage: "en-US",
  availableLanguages: ["en", "ar"] as Array<"en" | "ar">,
  dateFormat: "DD/MM/YYYY" as string | null,
  numberFormat: "1.234,56" as string | null,
  hours: [
    { day: "Monday", time: "11:00 - 22:00" },
    { day: "Tuesday", time: "11:00 - 22:00" },
    { day: "Wednesday", time: "11:00 - 22:00" },
    { day: "Thursday", time: "11:00 - 22:00" },
    { day: "Friday", time: "11:00 - 23:00" },
    { day: "Saturday", time: "10:00 - 23:00" },
    { day: "Sunday", time: "10:00 - 21:00" },
  ],
};

export const categories = [
  { id: "1", emoji: "🍕", name: "Pizza" },
  { id: "2", emoji: "🥗", name: "Salads" },
  { id: "3", emoji: "🍝", name: "Pasta" },
  { id: "4", emoji: "🍰", name: "Desserts" },
  { id: "5", emoji: "🍺", name: "Drinks" },
];

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  tags: Array<{ name: string }>;
  status: "live" | "soldout";
  featured?: boolean;
};

export const menuItems: MenuItem[] = [
  {
    id: "1",
    categoryId: "1",
    name: "Margherita",
    description: "Tomato, mozzarella, fresh basil",
    price: 12.0,
    image: "/pizza-margherita.jpg",
    tags: [{ name: "Vegetarian" }],
    status: "live",
    featured: true,
  },
  {
    id: "2",
    categoryId: "1",
    name: "Pepperoni",
    description: "Spicy salami, mozzarella, tomato sauce",
    price: 14.0,
    image: "/pizza-pepperoni.jpg",
    tags: [{ name: "Spicy" }],
    status: "live",
    featured: true,
  },
  {
    id: "3",
    categoryId: "1",
    name: "Hawaiian",
    description: "Ham, pineapple, mozzarella",
    price: 14.0,
    image: "/pizza-hawaiian.jpg",
    tags: [],
    status: "soldout",
  },
  {
    id: "4",
    categoryId: "1",
    name: "Quattro Formaggi",
    description: "Mozzarella, gorgonzola, parmesan, goat cheese",
    price: 16.0,
    image: "/pizza-quattro.jpg",
    tags: [{ name: "Vegetarian" }],
    status: "live",
    featured: true,
  },
  {
    id: "5",
    categoryId: "2",
    name: "Caesar Salad",
    description: "Romaine lettuce, parmesan, croutons, caesar dressing",
    price: 9.0,
    image: "/salad-caesar.jpg",
    tags: [],
    status: "live",
  },
  {
    id: "6",
    categoryId: "2",
    name: "Greek Salad",
    description: "Tomatoes, cucumber, olives, feta cheese",
    price: 10.0,
    image: "/salad-greek.jpg",
    tags: [{ name: "Vegetarian" }, { name: "Gluten-Free" }],
    status: "live",
  },
  {
    id: "7",
    categoryId: "3",
    name: "Carbonara",
    description: "Spaghetti with cream, guanciale, pecorino cheese",
    price: 13.0,
    image: "/pasta-carbonara.jpg",
    tags: [],
    status: "live",
  },
  {
    id: "8",
    categoryId: "3",
    name: "Bolognese",
    description: "Spaghetti with rich meat sauce and parmesan",
    price: 12.0,
    image: "/pasta-bolognese.jpg",
    tags: [],
    status: "live",
  },
  {
    id: "9",
    categoryId: "4",
    name: "Tiramisu",
    description: "Layers of ladyfinger, mascarpone, cocoa",
    price: 6.5,
    image: "/tiramisu.jpg",
    tags: [{ name: "Vegetarian" }],
    status: "live",
  },
  {
    id: "10",
    categoryId: "4",
    name: "Panna Cotta",
    description: "Creamy Italian dessert with fresh berries",
    price: 7.0,
    image: "/panna-cotta.jpg",
    tags: [{ name: "Vegetarian" }],
    status: "live",
  },
  {
    id: "11",
    categoryId: "5",
    name: "Coca Cola",
    description: "Cold refreshing cola, 330ml",
    price: 2.5,
    image: "/coca-cola.jpg",
    tags: [],
    status: "live",
  },
  {
    id: "12",
    categoryId: "5",
    name: "House Wine",
    description: "House red wine by the glass, 150ml",
    price: 4.0,
    image: "/house-wine.jpg",
    tags: [],
    status: "live",
  },
];

export type CartItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  selectedOptions?: Record<string, string[]>;
  sauceQuantities?: Record<string, number>;
  specialInstructions?: string;
};
