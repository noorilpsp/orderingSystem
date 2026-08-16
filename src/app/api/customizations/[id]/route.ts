import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { customizationGroups, customizationOptions, conditionalPrices, conditionalQuantities, secondaryGroupRules } from "@/db/schema";
import { merchantLocations, merchantUsers } from "@/lib/db/schema";
import { normalizeCatalogI18n } from "@/lib/catalog-i18n";
import { revalidatePublicMenuForLocation } from "@/lib/public-menu/publicMenuCache";

export const runtime = "nodejs";

/**
 * GET /api/customizations/[id]
 * Get a customization group with options and advanced rules
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;

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

    if (!groupId || groupId.trim() === "") {
      return NextResponse.json(
        { error: "Customization group ID is required" },
        { status: 400 }
      );
    }

    const group = await db.query.customizationGroups.findFirst({
      where: eq(customizationGroups.id, groupId),
      with: {
        options: {
          orderBy: (options, { asc }) => [asc(options.displayOrder)],
        },
        location: {
          columns: {
            id: true,
            merchantId: true,
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Customization group not found" },
        { status: 404 }
      );
    }

    // Check user has access
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, group.location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden - You don't have access to this customization group" },
        { status: 403 }
      );
    }

    return NextResponse.json(group);
  } catch (error) {
    console.error("[GET /api/customizations/[id]] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to fetch customization group",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/customizations/[id]
 * Update a customization group
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;

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

    if (!groupId || groupId.trim() === "") {
      return NextResponse.json(
        { error: "Customization group ID is required" },
        { status: 400 }
      );
    }

    const existingGroup = await db.query.customizationGroups.findFirst({
      where: eq(customizationGroups.id, groupId),
      with: {
        location: {
          columns: {
            id: true,
            merchantId: true,
          },
        },
      },
    });

    if (!existingGroup) {
      return NextResponse.json(
        { error: "Customization group not found" },
        { status: 404 }
      );
    }

    // Check user has access
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, existingGroup.location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden - You don't have access to this customization group" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    
    const updateData: Partial<typeof customizationGroups.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.customerInstructions !== undefined) updateData.customerInstructions = body.customerInstructions;
    if (body.internalNotes !== undefined) updateData.internalNotes = body.internalNotes;
    if (body.i18n !== undefined) updateData.i18n = normalizeCatalogI18n(body.i18n);
    if (body.isRequired !== undefined) updateData.isRequired = body.isRequired;
    if (body.minSelections !== undefined) updateData.minSelections = body.minSelections;
    if (body.maxSelections !== undefined) updateData.maxSelections = body.maxSelections;
    if (body.useConditionalPricing !== undefined) updateData.useConditionalPricing = body.useConditionalPricing;
    if (body.conditionalPricingBaseGroupId !== undefined) updateData.conditionalPricingBaseGroupId = body.conditionalPricingBaseGroupId;
    if (body.useConditionalQuantities !== undefined) updateData.useConditionalQuantities = body.useConditionalQuantities;
    if (body.conditionalQuantitiesBaseGroupId !== undefined) updateData.conditionalQuantitiesBaseGroupId = body.conditionalQuantitiesBaseGroupId;
    if (body.defaultOptionIds !== undefined) updateData.defaultOptionIds = body.defaultOptionIds;
    if (body.displayOrder !== undefined) updateData.displayOrder = body.displayOrder;

    const [updatedGroup] = await db
      .update(customizationGroups)
      .set(updateData)
      .where(eq(customizationGroups.id, groupId))
      .returning();

    // Get old options before deletion (for mapping priceMatrix keys)
    const oldOptions = body.options !== undefined 
      ? await db.query.customizationOptions.findMany({
          where: eq(customizationOptions.groupId, groupId),
          orderBy: (options, { asc }) => [asc(options.displayOrder)],
        })
      : [];

    // Create mapping from old option IDs to indices (for priceMatrix remapping)
    const oldOptionIdToIndex = new Map<string, number>();
    oldOptions.forEach((opt, idx) => {
      oldOptionIdToIndex.set(opt.id, idx);
    });

    // Handle options update if provided
    let insertedOptions: Array<{ id: string; name: string; price: string; displayOrder: number }> = [];
    if (body.options !== undefined && Array.isArray(body.options)) {
      // Delete existing options
      await db.delete(customizationOptions).where(eq(customizationOptions.groupId, groupId));
      
      // Insert new options and track default option IDs
      const defaultOptionIds: string[] = [];
      
      if (body.options.length > 0) {
        insertedOptions = await db.insert(customizationOptions).values(
          body.options.map((option: any, index: number) => ({
            groupId,
            name: option.name,
            price: option.price?.toString() || "0",
            displayOrder: option.displayOrder ?? index,
            i18n: normalizeCatalogI18n(option.i18n),
          }))
        ).returning();
        
        // Map the isDefault flags to the newly created option IDs
        body.options.forEach((option: any, index: number) => {
          if (option.isDefault && insertedOptions[index]) {
            defaultOptionIds.push(insertedOptions[index].id);
          }
        });
      }
      
      // Update the group's defaultOptionIds
      await db.update(customizationGroups)
        .set({ defaultOptionIds, updatedAt: new Date() })
        .where(eq(customizationGroups.id, groupId));
    }

    // Get current options (either newly inserted or existing)
    const currentOptions = insertedOptions.length > 0 
      ? insertedOptions 
      : await db.query.customizationOptions.findMany({
          where: eq(customizationOptions.groupId, groupId),
        });

    // Handle conditional pricing
    if (body.conditionalPricing !== undefined) {
      const conditionalPricing = body.conditionalPricing;
      
      // Delete existing conditional prices for this group's options
      if (currentOptions.length > 0) {
        await db.delete(conditionalPrices).where(
          inArray(conditionalPrices.optionId, currentOptions.map(o => o.id))
        );
      }

      // Insert new conditional prices if enabled
      if (conditionalPricing.enabled && conditionalPricing.priceMatrix && currentOptions.length > 0) {
        // Get base group options
        const baseGroup = conditionalPricing.basedOnGroupId 
          ? await db.query.customizationGroups.findFirst({
              where: eq(customizationGroups.id, conditionalPricing.basedOnGroupId),
              with: { options: true },
            })
          : null;

        if (baseGroup && baseGroup.options.length > 0) {
          const priceEntries: Array<{
            optionId: string;
            baseOptionId: string;
            price: string;
          }> = [];

          // Remap priceMatrix from old option IDs to new option IDs
          // The priceMatrix keys are old option IDs, we need to map them to new option IDs
          currentOptions.forEach((option, optionIndex) => {
            // Try to find the price data using the old option ID (if options were recreated)
            // or the current option ID (if options weren't changed)
            let optionPrices: Record<string, number> | undefined;
            
            if (insertedOptions.length > 0 && oldOptions.length > 0) {
              // Options were recreated - try mapping by index first
              if (optionIndex < oldOptions.length) {
                const oldOption = oldOptions[optionIndex];
                if (oldOption) {
                  optionPrices = conditionalPricing.priceMatrix[oldOption.id];
                }
              }
              
              // Fallback: try to find by matching option name (in case order changed)
              if (!optionPrices) {
                const matchingOldOption = oldOptions.find((old: any) => old.name === option.name);
                if (matchingOldOption) {
                  optionPrices = conditionalPricing.priceMatrix[matchingOldOption.id];
                }
              }
            } else {
              // Options weren't changed - use current option ID directly
              optionPrices = conditionalPricing.priceMatrix[option.id];
            }

            if (optionPrices && typeof optionPrices === 'object') {
              baseGroup.options.forEach((baseOption) => {
                const price = optionPrices![baseOption.id];
                if (price !== undefined && price !== null && !isNaN(price)) {
                  priceEntries.push({
                    optionId: option.id, // Use the new option ID
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
    }

    // Handle conditional quantities
    if (body.conditionalQuantities !== undefined) {
      const conditionalQuantitiesData = body.conditionalQuantities;
      
      // Delete existing conditional quantities for this group
      await db.delete(conditionalQuantities).where(
        eq(conditionalQuantities.groupId, groupId)
      );

      // Insert new conditional quantities if enabled
      if (conditionalQuantitiesData.enabled && conditionalQuantitiesData.rulesMatrix) {
        // Get base group options
        const baseGroup = conditionalQuantitiesData.basedOnGroupId
          ? await db.query.customizationGroups.findFirst({
              where: eq(customizationGroups.id, conditionalQuantitiesData.basedOnGroupId),
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
            const rules = conditionalQuantitiesData.rulesMatrix[baseOption.id];
            if (rules) {
              quantityEntries.push({
                groupId,
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
    }

    // Handle secondary groups
    if (body.secondaryGroups !== undefined) {
      const secondaryGroups = body.secondaryGroups;
      
      // Always delete existing secondary group rules for this group's options
      // We delete by triggerOptionId to ensure we get all rules for this group's options
      if (currentOptions.length > 0) {
        await db.delete(secondaryGroupRules).where(
          inArray(secondaryGroupRules.triggerOptionId, currentOptions.map(o => o.id))
        );
      } else {
        // If no current options, we still need to delete rules
        // Get all options for this group first
        const allGroupOptions = await db.query.customizationOptions.findMany({
          where: eq(customizationOptions.groupId, groupId),
        });
        if (allGroupOptions.length > 0) {
          await db.delete(secondaryGroupRules).where(
            inArray(secondaryGroupRules.triggerOptionId, allGroupOptions.map(o => o.id))
          );
        }
      }

      // Insert new secondary group rules (even if empty array, we've already deleted old ones)
      if (secondaryGroups.rules && Array.isArray(secondaryGroups.rules) && secondaryGroups.rules.length > 0) {
        console.log('[PUT /api/customizations/[id]] Processing secondary groups:', {
          rulesCount: secondaryGroups.rules.length,
          currentOptionsCount: currentOptions.length,
          insertedOptionsCount: insertedOptions.length,
          oldOptionsCount: oldOptions.length,
        });

        const ruleEntries: Array<{
          triggerOptionId: string;
          showGroupId: string;
          isRequired: boolean;
        }> = [];

        // Create a map from old option IDs to new option IDs
        const oldToNewOptionIdMap = new Map<string, string>();
        if (insertedOptions.length > 0 && oldOptions.length > 0) {
          oldOptions.forEach((oldOpt: any, index: number) => {
            if (index < insertedOptions.length) {
              oldToNewOptionIdMap.set(oldOpt.id, insertedOptions[index].id);
            }
          });
          // Also create a name-based fallback map
          const nameToNewOptionIdMap = new Map<string, string>();
          currentOptions.forEach((opt: any) => {
            nameToNewOptionIdMap.set(opt.name, opt.id);
          });
        }

        // Get all unique show group IDs to validate them in one query
        const showGroupIds = [...new Set(secondaryGroups.rules.map((r: any) => r.showGroupId))];
        const existingShowGroups = showGroupIds.length > 0
          ? await Promise.all(
              showGroupIds.map(id => 
                db.query.customizationGroups.findFirst({
                  where: eq(customizationGroups.id, id),
                  columns: { id: true },
                })
              )
            ).then(groups => groups.filter(g => g !== undefined))
          : [];
        const validShowGroupIds = new Set(existingShowGroups.map(g => g.id));

        secondaryGroups.rules.forEach((rule: any) => {
          console.log('[PUT /api/customizations/[id]] Processing rule:', {
            triggerOptionId: rule.triggerOptionId,
            showGroupId: rule.showGroupId,
            required: rule.required,
          });

          // Validate show group exists
          if (!validShowGroupIds.has(rule.showGroupId)) {
            console.warn(`[PUT /api/customizations/[id]] Skipping secondary group rule: show group ${rule.showGroupId} not found`);
            return;
          }

          // Map trigger option ID from old to new if options were recreated
          let triggerOptionId = rule.triggerOptionId;
          
          if (insertedOptions.length > 0 && oldOptions.length > 0) {
            // Options were recreated - find the new option ID
            const newOptionId = oldToNewOptionIdMap.get(rule.triggerOptionId);
            if (newOptionId) {
              triggerOptionId = newOptionId;
              console.log(`[PUT /api/customizations/[id]] Mapped trigger option ${rule.triggerOptionId} -> ${triggerOptionId}`);
            } else {
              // Fallback: try to find by matching option name
              const oldOption = oldOptions.find((old: any) => old.id === rule.triggerOptionId);
              if (oldOption) {
                const matchingNewOption = currentOptions.find((opt: any) => opt.name === oldOption.name);
                if (matchingNewOption) {
                  triggerOptionId = matchingNewOption.id;
                  console.log(`[PUT /api/customizations/[id]] Mapped trigger option by name ${rule.triggerOptionId} -> ${triggerOptionId}`);
                } else {
                  // Can't find matching option, skip this rule
                  console.warn(`[PUT /api/customizations/[id]] Skipping secondary group rule: trigger option ${rule.triggerOptionId} (${oldOption.name}) not found after option recreation`);
                  return;
                }
              } else {
                // Old option not found, skip this rule
                console.warn(`[PUT /api/customizations/[id]] Skipping secondary group rule: trigger option ${rule.triggerOptionId} not found in old options`);
                return;
              }
            }
          } else {
            // Options weren't changed - verify the trigger option ID exists in current options
            const optionExists = currentOptions.some((opt: any) => opt.id === rule.triggerOptionId);
            if (!optionExists) {
              console.warn(`[PUT /api/customizations/[id]] Skipping secondary group rule: trigger option ${rule.triggerOptionId} not found in current options. Available options:`, currentOptions.map(o => ({ id: o.id, name: o.name })));
              return;
            }
            console.log(`[PUT /api/customizations/[id]] Using existing trigger option ${triggerOptionId} (options not changed)`);
          }

          // Verify the mapped trigger option ID exists in current options
          const finalOptionExists = currentOptions.some((opt: any) => opt.id === triggerOptionId);
          if (!finalOptionExists) {
            console.warn(`[PUT /api/customizations/[id]] Skipping secondary group rule: mapped trigger option ${triggerOptionId} not found in current options`);
            return;
          }

          ruleEntries.push({
            triggerOptionId,
            showGroupId: rule.showGroupId,
            isRequired: rule.required ?? false,
          });
        });

        console.log(`[PUT /api/customizations/[id]] Inserting ${ruleEntries.length} secondary group rules`);

        if (ruleEntries.length > 0) {
          await db.insert(secondaryGroupRules).values(ruleEntries);
        }
      }
    }

    // Handle default selections
    if (body.defaultSelections !== undefined) {
      const defaultSelections = body.defaultSelections;
      
      // Map option IDs from old to new if options were recreated
      const mappedDefaultSelections: Record<string, number> = {};
      
      // If defaultSelections is provided (even if empty), process it
      if (currentOptions.length > 0 && typeof defaultSelections === 'object' && defaultSelections !== null) {
        Object.entries(defaultSelections).forEach(([optionId, quantity]) => {
          if (typeof quantity === 'number' && quantity > 0) {
            // Map option ID if options were recreated
            let mappedOptionId = optionId;
            
            if (insertedOptions.length > 0 && oldOptions.length > 0) {
              // Options were recreated - find the new option ID
              const oldOptionIndex = oldOptions.findIndex((old: any) => old.id === optionId);
              if (oldOptionIndex >= 0 && oldOptionIndex < insertedOptions.length) {
                mappedOptionId = insertedOptions[oldOptionIndex].id;
              } else {
                // Fallback: try to find by matching option name
                const oldOption = oldOptions.find((old: any) => old.id === optionId);
                if (oldOption) {
                  const matchingNewOption = currentOptions.find((opt: any) => opt.name === oldOption.name);
                  if (matchingNewOption) {
                    mappedOptionId = matchingNewOption.id;
                  } else {
                    console.warn(`[PUT /api/customizations/[id]] Skipping default selection: option ${optionId} not found after option recreation`);
                    return;
                  }
                } else {
                  console.warn(`[PUT /api/customizations/[id]] Skipping default selection: option ${optionId} not found in old options`);
                  return;
                }
              }
            } else {
              // Options weren't changed - verify the option ID exists
              const optionExists = currentOptions.some((opt: any) => opt.id === optionId);
              if (!optionExists) {
                console.warn(`[PUT /api/customizations/[id]] Skipping default selection: option ${optionId} not found in current options`);
                return;
              }
            }

            // Verify the mapped option ID exists
            const finalOptionExists = currentOptions.some((opt: any) => opt.id === mappedOptionId);
            if (finalOptionExists) {
              mappedDefaultSelections[mappedOptionId] = quantity;
            }
          }
        });
      }

      // Store as object mapping optionId -> quantity in JSONB
      // This allows us to preserve quantities (1-10) instead of just storing IDs
      // Empty object {} clears all defaults
      const defaultOptionIds = Object.keys(mappedDefaultSelections).length > 0 
        ? mappedDefaultSelections  // Store as object: { optionId: quantity }
        : {};  // Empty object if no defaults (clears existing)

      await db.update(customizationGroups)
        .set({ defaultOptionIds, updatedAt: new Date() })
        .where(eq(customizationGroups.id, groupId));
    }

    // Fetch the updated group with options
    const groupWithOptions = await db.query.customizationGroups.findFirst({
      where: eq(customizationGroups.id, groupId),
      with: {
        options: {
          orderBy: (options, { asc }) => [asc(options.displayOrder)],
        },
      },
    });

    await revalidatePublicMenuForLocation(existingGroup.location.id);
    return NextResponse.json(groupWithOptions);
  } catch (error) {
    console.error("[PUT /api/customizations/[id]] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to update customization group",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/customizations/[id]
 * Delete a customization group
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;

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

    if (!groupId || groupId.trim() === "") {
      return NextResponse.json(
        { error: "Customization group ID is required" },
        { status: 400 }
      );
    }

    const existingGroup = await db.query.customizationGroups.findFirst({
      where: eq(customizationGroups.id, groupId),
      with: {
        location: {
          columns: {
            id: true,
            merchantId: true,
          },
        },
      },
    });

    if (!existingGroup) {
      return NextResponse.json(
        { error: "Customization group not found" },
        { status: 404 }
      );
    }

    // Check user has access
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, existingGroup.location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: {
        id: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden - You don't have access to this customization group" },
        { status: 403 }
      );
    }

    // Delete group (cascade will handle related records)
    await db.delete(customizationGroups).where(eq(customizationGroups.id, groupId));

    await revalidatePublicMenuForLocation(existingGroup.location.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/customizations/[id]] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to delete customization group",
      },
      { status: 500 }
    );
  }
}
