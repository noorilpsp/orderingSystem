import {
    pgTable,
    pgEnum,
    uuid,
    varchar,
    text,
    timestamp,
    boolean,
    decimal,
    integer,
    jsonb,
    index,
    unique,
    primaryKey,
  } from "drizzle-orm/pg-core";
  import { relations } from "drizzle-orm";
  import { merchantLocations } from "./merchant-locations";
  import type { CatalogI18n } from "@/lib/catalog-i18n";
  
  // =============================================================================
  // ENUMS
  // =============================================================================
  
  export const menuStatusEnum = pgEnum("menu_status", ["active", "inactive"]);
  
  export const itemStatusEnum = pgEnum("item_status", [
    "live",
    "soldout",
    "hidden",
    "draft",
  ]);
  
  // =============================================================================
  // TABLE 1: MENUS
  // =============================================================================
  
  export const menus = pgTable(
    "menus",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      locationId: uuid("location_id")
        .notNull()
        .references(() => merchantLocations.id, { onDelete: "cascade" }),
      name: varchar("name", { length: 255 }).notNull(),
      description: text("description"),
      schedule: jsonb("schedule").notNull().default({}),
      availabilityDelivery: boolean("availability_delivery").notNull().default(false),
      availabilityPickup: boolean("availability_pickup").notNull().default(false),
      availabilityDineIn: boolean("availability_dine_in").notNull().default(false),
      status: menuStatusEnum("status").notNull().default("active"),
      displayOrder: integer("display_order").notNull().default(0),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
      index("idx_menus_location").on(table.locationId),
      index("idx_menus_status").on(table.status),
    ]
  );
  
  // =============================================================================
  // TABLE 2: CATEGORIES
  // =============================================================================
  
  export const categories = pgTable(
    "categories",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      locationId: uuid("location_id")
        .notNull()
        .references(() => merchantLocations.id, { onDelete: "cascade" }),
      emoji: varchar("emoji", { length: 10 }),
      name: varchar("name", { length: 255 }).notNull(),
      description: text("description"),
      /** Optional locale overrides (e.g. Arabic). Primary name/description stay English. */
      i18n: jsonb("i18n").$type<CatalogI18n>(),
      displayOrder: integer("display_order").notNull().default(0),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
      index("idx_categories_location").on(table.locationId),
    ]
  );
  
  // =============================================================================
  // TABLE 3: MENU_CATEGORIES (Junction)
  // =============================================================================
  
  export const menuCategories = pgTable(
    "menu_categories",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      menuId: uuid("menu_id")
        .notNull()
        .references(() => menus.id, { onDelete: "cascade" }),
      categoryId: uuid("category_id")
        .notNull()
        .references(() => categories.id, { onDelete: "cascade" }),
      displayOrder: integer("display_order").notNull().default(0),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
      unique("uq_menu_categories").on(table.menuId, table.categoryId),
      index("idx_menu_categories_menu").on(table.menuId),
      index("idx_menu_categories_category").on(table.categoryId),
    ]
  );
  
  // =============================================================================
  // TABLE 4: TAGS
  // =============================================================================
  
  export const tags = pgTable(
    "tags",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      locationId: uuid("location_id")
        .notNull()
        .references(() => merchantLocations.id, { onDelete: "cascade" }),
      name: varchar("name", { length: 100 }).notNull(),
      color: varchar("color", { length: 7 }), // Hex color like #FF5733
      /** Optional locale overrides (e.g. Arabic). Primary name stays English. */
      i18n: jsonb("i18n").$type<CatalogI18n>(),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
      unique("uq_tags_location_name").on(table.locationId, table.name),
      index("idx_tags_location").on(table.locationId),
    ]
  );
  
  // =============================================================================
  // TABLE 5: ALLERGENS
  // =============================================================================
  
  export const allergens = pgTable(
    "allergens",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      locationId: uuid("location_id")
        .notNull()
        .references(() => merchantLocations.id, { onDelete: "cascade" }),
      name: varchar("name", { length: 100 }).notNull(),
      icon: varchar("icon", { length: 50 }), // Icon identifier
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
      unique("uq_allergens_location_name").on(table.locationId, table.name),
      index("idx_allergens_location").on(table.locationId),
    ]
  );
  
  // =============================================================================
  // TABLE 6: ITEMS
  // =============================================================================
  
  export const items = pgTable(
    "items",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      locationId: uuid("location_id")
        .notNull()
        .references(() => merchantLocations.id, { onDelete: "cascade" }),
      name: varchar("name", { length: 255 }).notNull(),
      description: text("description"),
      /** Optional locale overrides (e.g. Arabic). Primary name/description stay English. */
      i18n: jsonb("i18n").$type<CatalogI18n>(),
      price: decimal("price", { precision: 10, scale: 2 }).notNull(),
      photoUrl: varchar("photo_url", { length: 500 }),
      calories: integer("calories"),
      status: itemStatusEnum("status").notNull().default("draft"),
      featured: boolean("featured").notNull().default(false),
      useCustomHours: boolean("use_custom_hours").notNull().default(false),
      customSchedule: jsonb("custom_schedule"),
      displayOrder: integer("display_order").notNull().default(0),
      defaultStation: varchar("default_station", { length: 50 }),
      defaultSubstation: varchar("default_substation", { length: 50 }),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
      index("idx_items_location").on(table.locationId),
      index("idx_items_status").on(table.status),
    ]
  );
  
  // =============================================================================
  // TABLE 7: CATEGORY_ITEMS (Junction)
  // =============================================================================
  
  export const categoryItems = pgTable(
    "category_items",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      categoryId: uuid("category_id")
        .notNull()
        .references(() => categories.id, { onDelete: "cascade" }),
      itemId: uuid("item_id")
        .notNull()
        .references(() => items.id, { onDelete: "cascade" }),
      displayOrder: integer("display_order").notNull().default(0),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
      unique("uq_category_items").on(table.categoryId, table.itemId),
      index("idx_category_items_category").on(table.categoryId),
      index("idx_category_items_item").on(table.itemId),
    ]
  );
  
  // =============================================================================
  // TABLE 8: ITEM_TAGS (Junction)
  // =============================================================================
  
  export const itemTags = pgTable(
    "item_tags",
    {
      itemId: uuid("item_id")
        .notNull()
        .references(() => items.id, { onDelete: "cascade" }),
      tagId: uuid("tag_id")
        .notNull()
        .references(() => tags.id, { onDelete: "cascade" }),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
      primaryKey({ columns: [table.itemId, table.tagId] }),
    ]
  );
  
  // =============================================================================
  // TABLE 9: ITEM_ALLERGENS (Junction)
  // =============================================================================
  
  export const itemAllergens = pgTable(
    "item_allergens",
    {
      itemId: uuid("item_id")
        .notNull()
        .references(() => items.id, { onDelete: "cascade" }),
      allergenId: uuid("allergen_id")
        .notNull()
        .references(() => allergens.id, { onDelete: "cascade" }),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
      primaryKey({ columns: [table.itemId, table.allergenId] }),
    ]
  );
  
  // =============================================================================
  // TABLE 10: CUSTOMIZATION_GROUPS
  // =============================================================================
  
  export const customizationGroups = pgTable(
    "customization_groups",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      locationId: uuid("location_id")
        .notNull()
        .references(() => merchantLocations.id, { onDelete: "cascade" }),
      name: varchar("name", { length: 255 }).notNull(),
      customerInstructions: text("customer_instructions"),
      internalNotes: text("internal_notes"),
      /** Optional locale overrides (e.g. Arabic). Primary copy stays English. */
      i18n: jsonb("i18n").$type<CatalogI18n>(),
      isRequired: boolean("is_required").notNull().default(false),
      minSelections: integer("min_selections").notNull().default(0),
      maxSelections: integer("max_selections"), // null = unlimited
      useConditionalPricing: boolean("use_conditional_pricing").notNull().default(false),
      conditionalPricingBaseGroupId: uuid("conditional_pricing_base_group_id"),
      // Self-reference handled in relations - FK constraint can be added in migration
      useConditionalQuantities: boolean("use_conditional_quantities").notNull().default(false),
      conditionalQuantitiesBaseGroupId: uuid("conditional_quantities_base_group_id"),
      // Self-reference handled in relations - FK constraint can be added in migration
      defaultOptionIds: jsonb("default_option_ids").default([]),
      displayOrder: integer("display_order").notNull().default(0),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
      index("idx_customization_groups_location").on(table.locationId),
    ]
  );
  
  // =============================================================================
  // TABLE 11: CUSTOMIZATION_OPTIONS
  // =============================================================================
  
  export const customizationOptions = pgTable(
    "customization_options",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      groupId: uuid("group_id")
        .notNull()
        .references(() => customizationGroups.id, { onDelete: "cascade" }),
      name: varchar("name", { length: 255 }).notNull(),
      /** Optional locale overrides (e.g. Arabic). Primary name stays English. */
      i18n: jsonb("i18n").$type<CatalogI18n>(),
      price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0.00"),
      displayOrder: integer("display_order").notNull().default(0),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
      index("idx_customization_options_group").on(table.groupId),
    ]
  );
  
  // =============================================================================
  // TABLE 12: ITEM_CUSTOMIZATIONS (Junction)
  // =============================================================================
  
  export const itemCustomizations = pgTable(
    "item_customizations",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      itemId: uuid("item_id")
        .notNull()
        .references(() => items.id, { onDelete: "cascade" }),
      groupId: uuid("group_id")
        .notNull()
        .references(() => customizationGroups.id, { onDelete: "cascade" }),
      displayOrder: integer("display_order").notNull().default(0),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
      unique("uq_item_customizations").on(table.itemId, table.groupId),
      index("idx_item_customizations_item").on(table.itemId),
      index("idx_item_customizations_group").on(table.groupId),
    ]
  );
  
  // =============================================================================
  // TABLE 13: CONDITIONAL_PRICES
  // When option price varies based on another selection
  // Example: Mushrooms cost $1 on Small, $2 on Medium, $10 on Large
  // =============================================================================
  
  export const conditionalPrices = pgTable(
    "conditional_prices",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      optionId: uuid("option_id")
        .notNull()
        .references(() => customizationOptions.id, { onDelete: "cascade" }),
      baseOptionId: uuid("base_option_id")
        .notNull()
        .references(() => customizationOptions.id, { onDelete: "cascade" }),
      price: decimal("price", { precision: 10, scale: 2 }).notNull(),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
      unique("uq_conditional_prices").on(table.optionId, table.baseOptionId),
      index("idx_conditional_prices_option").on(table.optionId),
      index("idx_conditional_prices_base").on(table.baseOptionId),
    ]
  );
  
  // =============================================================================
  // TABLE 14: CONDITIONAL_QUANTITIES
  // When min/max/required varies based on another selection
  // Example: Small pizza max 3 toppings, Large allows 6
  // =============================================================================
  
  export const conditionalQuantities = pgTable(
    "conditional_quantities",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      groupId: uuid("group_id")
        .notNull()
        .references(() => customizationGroups.id, { onDelete: "cascade" }),
      baseOptionId: uuid("base_option_id")
        .notNull()
        .references(() => customizationOptions.id, { onDelete: "cascade" }),
      minSelections: integer("min_selections").notNull().default(0),
      maxSelections: integer("max_selections"), // null = unlimited
      isRequired: boolean("is_required").notNull().default(false),
      maxPerOption: integer("max_per_option"), // max quantity per single option
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
      unique("uq_conditional_quantities").on(table.groupId, table.baseOptionId),
      index("idx_conditional_quantities_group").on(table.groupId),
      index("idx_conditional_quantities_base").on(table.baseOptionId),
    ]
  );
  
  // =============================================================================
  // TABLE 15: SECONDARY_GROUP_RULES
  // When selecting an option triggers another customization group to appear
  // Example: Selecting "Large" triggers "Free Drink Selection" group
  // =============================================================================
  
  export const secondaryGroupRules = pgTable(
    "secondary_group_rules",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      triggerOptionId: uuid("trigger_option_id")
        .notNull()
        .references(() => customizationOptions.id, { onDelete: "cascade" }),
      showGroupId: uuid("show_group_id")
        .notNull()
        .references(() => customizationGroups.id, { onDelete: "cascade" }),
      isRequired: boolean("is_required").notNull().default(false),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
      unique("uq_secondary_group_rules").on(table.triggerOptionId, table.showGroupId),
      index("idx_secondary_rules_trigger").on(table.triggerOptionId),
      index("idx_secondary_rules_group").on(table.showGroupId),
    ]
  );
  
  // =============================================================================
  // RELATIONS
  // =============================================================================
  
  export const menusRelations = relations(menus, ({ one, many }) => ({
    location: one(merchantLocations, {
      fields: [menus.locationId],
      references: [merchantLocations.id],
    }),
    menuCategories: many(menuCategories),
  }));
  
  export const categoriesRelations = relations(categories, ({ one, many }) => ({
    location: one(merchantLocations, {
      fields: [categories.locationId],
      references: [merchantLocations.id],
    }),
    menuCategories: many(menuCategories),
    categoryItems: many(categoryItems),
  }));
  
  export const menuCategoriesRelations = relations(menuCategories, ({ one }) => ({
    menu: one(menus, {
      fields: [menuCategories.menuId],
      references: [menus.id],
    }),
    category: one(categories, {
      fields: [menuCategories.categoryId],
      references: [categories.id],
    }),
  }));
  
  export const tagsRelations = relations(tags, ({ one, many }) => ({
    location: one(merchantLocations, {
      fields: [tags.locationId],
      references: [merchantLocations.id],
    }),
    itemTags: many(itemTags),
  }));
  
  export const allergensRelations = relations(allergens, ({ one, many }) => ({
    location: one(merchantLocations, {
      fields: [allergens.locationId],
      references: [merchantLocations.id],
    }),
    itemAllergens: many(itemAllergens),
  }));
  
  export const itemsRelations = relations(items, ({ one, many }) => ({
    location: one(merchantLocations, {
      fields: [items.locationId],
      references: [merchantLocations.id],
    }),
    categoryItems: many(categoryItems),
    itemTags: many(itemTags),
    itemAllergens: many(itemAllergens),
    itemCustomizations: many(itemCustomizations),
  }));
  
  export const categoryItemsRelations = relations(categoryItems, ({ one }) => ({
    category: one(categories, {
      fields: [categoryItems.categoryId],
      references: [categories.id],
    }),
    item: one(items, {
      fields: [categoryItems.itemId],
      references: [items.id],
    }),
  }));
  
  export const itemTagsRelations = relations(itemTags, ({ one }) => ({
    item: one(items, {
      fields: [itemTags.itemId],
      references: [items.id],
    }),
    tag: one(tags, {
      fields: [itemTags.tagId],
      references: [tags.id],
    }),
  }));
  
  export const itemAllergensRelations = relations(itemAllergens, ({ one }) => ({
    item: one(items, {
      fields: [itemAllergens.itemId],
      references: [items.id],
    }),
    allergen: one(allergens, {
      fields: [itemAllergens.allergenId],
      references: [allergens.id],
    }),
  }));
  
  export const customizationGroupsRelations = relations(
    customizationGroups,
    ({ one, many }) => ({
      location: one(merchantLocations, {
        fields: [customizationGroups.locationId],
        references: [merchantLocations.id],
      }),
      conditionalPricingBaseGroup: one(customizationGroups, {
        fields: [customizationGroups.conditionalPricingBaseGroupId],
        references: [customizationGroups.id],
        relationName: "conditionalPricingBase",
      }),
      conditionalQuantitiesBaseGroup: one(customizationGroups, {
        fields: [customizationGroups.conditionalQuantitiesBaseGroupId],
        references: [customizationGroups.id],
        relationName: "conditionalQuantitiesBase",
      }),
      options: many(customizationOptions),
      itemCustomizations: many(itemCustomizations),
      conditionalQuantities: many(conditionalQuantities),
      secondaryGroupRules: many(secondaryGroupRules),
    })
  );
  
  export const customizationOptionsRelations = relations(
    customizationOptions,
    ({ one, many }) => ({
      group: one(customizationGroups, {
        fields: [customizationOptions.groupId],
        references: [customizationGroups.id],
      }),
      conditionalPricesAsOption: many(conditionalPrices, {
        relationName: "optionPrices",
      }),
      conditionalPricesAsBase: many(conditionalPrices, {
        relationName: "basePrices",
      }),
      conditionalQuantitiesAsBase: many(conditionalQuantities),
      triggerRules: many(secondaryGroupRules),
    })
  );
  
  export const itemCustomizationsRelations = relations(
    itemCustomizations,
    ({ one }) => ({
      item: one(items, {
        fields: [itemCustomizations.itemId],
        references: [items.id],
      }),
      group: one(customizationGroups, {
        fields: [itemCustomizations.groupId],
        references: [customizationGroups.id],
      }),
    })
  );
  
  export const conditionalPricesRelations = relations(
    conditionalPrices,
    ({ one }) => ({
      option: one(customizationOptions, {
        fields: [conditionalPrices.optionId],
        references: [customizationOptions.id],
        relationName: "optionPrices",
      }),
      baseOption: one(customizationOptions, {
        fields: [conditionalPrices.baseOptionId],
        references: [customizationOptions.id],
        relationName: "basePrices",
      }),
    })
  );
  
  export const conditionalQuantitiesRelations = relations(
    conditionalQuantities,
    ({ one }) => ({
      group: one(customizationGroups, {
        fields: [conditionalQuantities.groupId],
        references: [customizationGroups.id],
      }),
      baseOption: one(customizationOptions, {
        fields: [conditionalQuantities.baseOptionId],
        references: [customizationOptions.id],
      }),
    })
  );
  
  export const secondaryGroupRulesRelations = relations(
    secondaryGroupRules,
    ({ one }) => ({
      triggerOption: one(customizationOptions, {
        fields: [secondaryGroupRules.triggerOptionId],
        references: [customizationOptions.id],
      }),
      showGroup: one(customizationGroups, {
        fields: [secondaryGroupRules.showGroupId],
        references: [customizationGroups.id],
      }),
    })
  );
  
  // =============================================================================
  // TYPE EXPORTS
  // =============================================================================
  
  export type Menu = typeof menus.$inferSelect;
  export type NewMenu = typeof menus.$inferInsert;
  
  export type Category = typeof categories.$inferSelect;
  export type NewCategory = typeof categories.$inferInsert;
  
  export type Tag = typeof tags.$inferSelect;
  export type NewTag = typeof tags.$inferInsert;
  
  export type Allergen = typeof allergens.$inferSelect;
  export type NewAllergen = typeof allergens.$inferInsert;
  
  export type Item = typeof items.$inferSelect;
  export type NewItem = typeof items.$inferInsert;
  
  export type CustomizationGroup = typeof customizationGroups.$inferSelect;
  export type NewCustomizationGroup = typeof customizationGroups.$inferInsert;
  
  export type CustomizationOption = typeof customizationOptions.$inferSelect;
  export type NewCustomizationOption = typeof customizationOptions.$inferInsert;
  
  export type ConditionalPrice = typeof conditionalPrices.$inferSelect;
  export type NewConditionalPrice = typeof conditionalPrices.$inferInsert;
  
  export type ConditionalQuantity = typeof conditionalQuantities.$inferSelect;
  export type NewConditionalQuantity = typeof conditionalQuantities.$inferInsert;
  
  export type SecondaryGroupRule = typeof secondaryGroupRules.$inferSelect;
  export type NewSecondaryGroupRule = typeof secondaryGroupRules.$inferInsert;
  
  // =============================================================================
  // JSONB TYPE DEFINITIONS
  // =============================================================================
  
  export type ScheduleBlock = {
    open: string; // "09:00"
    close: string; // "22:00"
  };
  
  export type Schedule = {
    sunday?: ScheduleBlock[];
    monday?: ScheduleBlock[];
    tuesday?: ScheduleBlock[];
    wednesday?: ScheduleBlock[];
    thursday?: ScheduleBlock[];
    friday?: ScheduleBlock[];
    saturday?: ScheduleBlock[];
  };