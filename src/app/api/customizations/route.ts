import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, inArray } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { customizationGroups, customizationOptions, conditionalPrices, conditionalQuantities, secondaryGroupRules, itemCustomizations } from "@/db/schema";
import { merchantLocations, merchantUsers } from "@/lib/db/schema";
import { posFailure, posSuccess, toErrorMessage } from "@/app/api/_lib/pos-envelope";
import { normalizeCatalogI18n } from "@/lib/catalog-i18n";

export const runtime = "nodejs";

/**
 * GET /api/customizations
 * List all customization groups for a location
 * Query params: locationId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return posFailure("UNAUTHORIZED", "Unauthorized - Please log in", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("locationId");

    if (!locationId) {
      return posFailure("BAD_REQUEST", "Location ID is required", { status: 400 });
    }

    // Verify location exists and user has access
    const location = await db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.id, locationId),
      columns: {
        id: true,
        merchantId: true,
      },
    });

    if (!location) {
      return posFailure("NOT_FOUND", "Location not found", { status: 404 });
    }

    // Check user has access to this merchant
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
      },
    });

    if (!membership) {
      return posFailure("FORBIDDEN", "You don't have access to this location", { status: 403 });
    }

    // Fetch customization groups with options and advanced rules (no cache to ensure fresh data)
    const groups = await db.query.customizationGroups.findMany({
      where: eq(customizationGroups.locationId, locationId),
      orderBy: [desc(customizationGroups.displayOrder), desc(customizationGroups.createdAt)],
      with: {
        options: {
          orderBy: (options, { asc }) => [asc(options.displayOrder)],
        },
        conditionalQuantities: {
          with: {
            baseOption: true,
          },
        },
        itemCustomizations: {
          with: {
            item: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

        // Fetch conditional prices for each option
        const groupsWithConditionalPrices = await Promise.all(
          groups.map(async (group) => {
            const optionsWithPrices = await Promise.all(
              group.options.map(async (option) => {
                const conditionalPricesList = await db.query.conditionalPrices.findMany({
                  where: eq(conditionalPrices.optionId, option.id),
                  with: {
                    baseOption: true,
                  },
                });
                return {
                  ...option,
                  conditionalPrices: conditionalPricesList,
                };
              })
            );

            // Fetch secondary group rules
            const secondaryRules = await db.query.secondaryGroupRules.findMany({
              where: (rules, { inArray }) =>
                inArray(
                  rules.triggerOptionId,
                  group.options.map((o) => o.id)
                ),
              with: {
                showGroup: {
                  columns: {
                    id: true,
                    name: true,
                  },
                },
              },
            });

            return {
              ...group,
              options: optionsWithPrices,
              secondaryRules,
              itemCount: group.itemCustomizations?.length || 0,
            };
          })
        );

    const res = posSuccess(groupsWithConditionalPrices);
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  } catch (error) {
    console.error("[GET /api/customizations] Error:", error);
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to fetch customizations"),
      { status: 500 }
    );
  }
}

/**
 * POST /api/customizations
 * Create a new customization group
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      locationId,
      name,
      customerInstructions,
      internalNotes,
      i18n,
      isRequired,
      minSelections,
      maxSelections,
      useConditionalPricing,
      conditionalPricingBaseGroupId,
      conditionalPricing,
      useConditionalQuantities,
      conditionalQuantitiesBaseGroupId,
      conditionalQuantities,
      secondaryGroups,
      defaultSelections,
      defaultOptionIds,
      displayOrder,
      options, // Array of { name, price, displayOrder, i18n? }
    } = body;

    if (!locationId || !name) {
      return NextResponse.json(
        { error: "Location ID and name are required" },
        { status: 400 }
      );
    }

    // Verify location exists and user has access
    const location = await db.query.merchantLocations.findFirst({
      where: eq(merchantLocations.id, locationId),
      columns: {
        id: true,
        merchantId: true,
      },
    });

    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    // Check user has access to this merchant
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden - You don't have access to this location" },
        { status: 403 }
      );
    }

    // Create customization group
    const [newGroup] = await db
      .insert(customizationGroups)
      .values({
        locationId,
        name,
        customerInstructions: customerInstructions || null,
        internalNotes: internalNotes || null,
        i18n: normalizeCatalogI18n(i18n),
        isRequired: isRequired ?? false,
        minSelections: minSelections ?? 0,
        maxSelections: maxSelections || null,
        useConditionalPricing: useConditionalPricing ?? false,
        conditionalPricingBaseGroupId: conditionalPricingBaseGroupId || null,
        useConditionalQuantities: useConditionalQuantities ?? false,
        conditionalQuantitiesBaseGroupId: conditionalQuantitiesBaseGroupId || null,
        defaultOptionIds: defaultOptionIds || [],
        displayOrder: displayOrder ?? 0,
      })
      .returning();

    // Create options if provided
    let insertedOptions: Array<{ id: string; name: string; price: string; displayOrder: number }> = [];
    let finalDefaultOptionIds: string[] = [];
    // Map from temporary form option IDs to new database option IDs
    const tempToDbOptionIdMap = new Map<string, string>();
    
    if (options && Array.isArray(options) && options.length > 0) {
      insertedOptions = await db.insert(customizationOptions).values(
        options.map((opt: { id?: string; name: string; price: number; displayOrder?: number; isDefault?: boolean; i18n?: unknown }, index: number) => ({
          groupId: newGroup.id,
          name: opt.name,
          price: opt.price.toString(),
          displayOrder: opt.displayOrder ?? index,
          i18n: normalizeCatalogI18n(opt.i18n),
        }))
      ).returning();
      
      // Create mapping from temporary form IDs to new database IDs
      options.forEach((option: any, index: number) => {
        if (option.id && insertedOptions[index]) {
          tempToDbOptionIdMap.set(option.id, insertedOptions[index].id);
        }
        if (option.isDefault && insertedOptions[index]) {
          finalDefaultOptionIds.push(insertedOptions[index].id);
        }
      });
    }

    // Update default option IDs
    if (finalDefaultOptionIds.length > 0 || defaultOptionIds) {
      await db.update(customizationGroups)
        .set({ defaultOptionIds: finalDefaultOptionIds.length > 0 ? finalDefaultOptionIds : defaultOptionIds || [] })
        .where(eq(customizationGroups.id, newGroup.id));
    }

    // Handle advanced features if provided
    if (insertedOptions.length > 0) {
      // Handle conditional pricing
      if (conditionalPricing?.enabled && conditionalPricing.priceMatrix) {
        const baseGroup = conditionalPricing.basedOnGroupId 
          ? await db.query.customizationGroups.findFirst({
              where: eq(customizationGroups.id, conditionalPricing.basedOnGroupId),
              with: { options: true },
            })
          : null;

        if (baseGroup) {
          const priceEntries: Array<{
            optionId: string;
            baseOptionId: string;
            price: string;
          }> = [];

          // Map priceMatrix from temporary form option IDs to new database option IDs
          insertedOptions.forEach((option, index) => {
            // Find the temporary form option ID that corresponds to this database option
            const formOption = options[index];
            const tempOptionId = formOption?.id;
            
            // Try to get prices using the temporary form ID
            let optionPrices: Record<string, number> | undefined;
            if (tempOptionId) {
              optionPrices = conditionalPricing.priceMatrix[tempOptionId];
            }
            
            // Fallback: try using the database ID directly (in case it was already mapped)
            if (!optionPrices) {
              optionPrices = conditionalPricing.priceMatrix[option.id];
            }

            if (optionPrices) {
              baseGroup.options.forEach((baseOption) => {
                const price = optionPrices![baseOption.id];
                if (price !== undefined && price !== null) {
                  priceEntries.push({
                    optionId: option.id, // Use the new database option ID
                    baseOptionId: baseOption.id,
                    price: price.toString(),
                  });
                }
              });
            }
          });

          if (priceEntries.length > 0) {
            await db.insert(conditionalPrices).values(priceEntries);
          }
        }
      }

      // Handle conditional quantities
      if (conditionalQuantities?.enabled && conditionalQuantities.rulesMatrix) {
        const baseGroup = conditionalQuantities.basedOnGroupId
          ? await db.query.customizationGroups.findFirst({
              where: eq(customizationGroups.id, conditionalQuantities.basedOnGroupId),
              with: { options: true },
            })
          : null;

        if (baseGroup) {
          const quantityEntries: Array<{
            groupId: string;
            baseOptionId: string;
            minSelections: number;
            maxSelections: number | null;
            isRequired: boolean;
            maxPerOption: number | null;
          }> = [];

          baseGroup.options.forEach((baseOption) => {
            const rules = conditionalQuantities.rulesMatrix[baseOption.id];
            if (rules) {
              quantityEntries.push({
                groupId: newGroup.id,
                baseOptionId: baseOption.id,
                minSelections: rules.min ?? 0,
                maxSelections: rules.max ?? null,
                isRequired: rules.required ?? false,
                maxPerOption: rules.maxPerOption ?? null,
              });
            }
          });

          if (quantityEntries.length > 0) {
            await db.insert(conditionalQuantities).values(quantityEntries);
          }
        }
      }

      // Handle secondary groups
      if (secondaryGroups?.rules && Array.isArray(secondaryGroups.rules) && secondaryGroups.rules.length > 0) {
        // Get all unique show group IDs to validate them
        const showGroupIds: string[] = Array.from(new Set(
          secondaryGroups.rules
            .map((r: any) => r.showGroupId)
            .filter((id: any): id is string => typeof id === 'string')
        ));
        const existingShowGroups = showGroupIds.length > 0
          ? await Promise.all(
              showGroupIds.map((id: string) => 
                db.query.customizationGroups.findFirst({
                  where: eq(customizationGroups.id, id),
                  columns: { id: true },
                })
              )
            ).then(groups => groups.filter((g): g is { id: string } => g !== undefined))
          : [];
        const validShowGroupIds = new Set(existingShowGroups.map((g: { id: string }) => g.id));

        const ruleEntries: Array<{
          triggerOptionId: string;
          showGroupId: string;
          isRequired: boolean;
        }> = [];

        secondaryGroups.rules.forEach((rule: any) => {
          // Validate show group exists
          if (!validShowGroupIds.has(rule.showGroupId)) {
            console.warn(`Skipping secondary group rule: show group ${rule.showGroupId} not found`);
            return;
          }

          // Map trigger option ID from temporary form ID to new database ID
          let triggerOptionId = rule.triggerOptionId;
          const mappedId = tempToDbOptionIdMap.get(rule.triggerOptionId);
          if (mappedId) {
            triggerOptionId = mappedId;
          } else {
            // If mapping not found, try to find by matching option name (fallback)
            const matchingOption = insertedOptions.find((opt, idx) => {
              const formOption = options[idx];
              return formOption && formOption.id === rule.triggerOptionId;
            });
            if (matchingOption) {
              triggerOptionId = matchingOption.id;
            } else {
              console.warn(`Skipping secondary group rule: trigger option ${rule.triggerOptionId} not found in created options`);
              return;
            }
          }

          // Verify the mapped trigger option ID exists
          const optionExists = insertedOptions.some((opt: any) => opt.id === triggerOptionId);
          if (!optionExists) {
            console.warn(`Skipping secondary group rule: mapped trigger option ${triggerOptionId} not found`);
            return;
          }

          ruleEntries.push({
            triggerOptionId,
            showGroupId: rule.showGroupId,
            isRequired: rule.required ?? false,
          });
        });

        if (ruleEntries.length > 0) {
          await db.insert(secondaryGroupRules).values(ruleEntries);
        }
      }

      // Handle default selections
      if (defaultSelections && Object.keys(defaultSelections).length > 0 && insertedOptions.length > 0) {
        // Map from temporary form option IDs to new database option IDs
        const mappedDefaultSelections: Record<string, number> = {};
        
        Object.entries(defaultSelections).forEach(([optionId, quantity]) => {
          if (typeof quantity === 'number' && quantity > 0) {
            // Map from temporary form ID to new database ID
            const mappedId = tempToDbOptionIdMap.get(optionId);
            if (mappedId) {
              mappedDefaultSelections[mappedId] = quantity;
            } else {
              // Fallback: try to find by matching option name
              const formOptionIndex = options.findIndex((opt: any) => opt.id === optionId);
              if (formOptionIndex >= 0 && formOptionIndex < insertedOptions.length) {
                mappedDefaultSelections[insertedOptions[formOptionIndex].id] = quantity;
              } else {
                console.warn(`[POST /api/customizations] Skipping default selection: option ${optionId} not found in created options`);
              }
            }
          }
        });

        // Store as object mapping optionId -> quantity in JSONB
        if (Object.keys(mappedDefaultSelections).length > 0) {
          await db.update(customizationGroups)
            .set({ defaultOptionIds: mappedDefaultSelections, updatedAt: new Date() })
            .where(eq(customizationGroups.id, newGroup.id));
        }
      }
    }

    // Fetch complete group with options
    const completeGroup = await db.query.customizationGroups.findFirst({
      where: eq(customizationGroups.id, newGroup.id),
      with: {
        options: true,
      },
    });

    return NextResponse.json(completeGroup, { status: 201 });
  } catch (error) {
    console.error("[POST /api/customizations] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to create customization group",
      },
      { status: 500 }
    );
  }
}
