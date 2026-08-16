import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { tags } from "@/db/schema";
import { merchantLocations, merchantUsers } from "@/lib/db/schema";
import { normalizeCatalogI18n } from "@/lib/catalog-i18n";
import { revalidatePublicMenuForLocation } from "@/lib/public-menu/publicMenuCache";

export const runtime = "nodejs";

async function authorizeTagAccess(tagId: string, userId: string) {
  const existingTag = await db.query.tags.findFirst({
    where: eq(tags.id, tagId),
    with: {
      location: {
        columns: {
          id: true,
          merchantId: true,
        },
      },
    },
  });

  if (!existingTag) {
    return { error: NextResponse.json({ error: "Tag not found" }, { status: 404 }) };
  }

  const membership = await db.query.merchantUsers.findFirst({
    where: and(
      eq(merchantUsers.merchantId, existingTag.location.merchantId),
      eq(merchantUsers.userId, userId),
      eq(merchantUsers.isActive, true)
    ),
    columns: {
      id: true,
    },
  });

  if (!membership) {
    return {
      error: NextResponse.json(
        { error: "Forbidden - You don't have access to this tag" },
        { status: 403 }
      ),
    };
  }

  return { existingTag };
}

/**
 * PATCH /api/tags/[id]
 * Update a tag name and/or i18n
 * Body: { name?, i18n? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tagId } = await params;

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

    if (!tagId || tagId.trim() === "") {
      return NextResponse.json(
        { error: "Tag ID is required" },
        { status: 400 }
      );
    }

    const access = await authorizeTagAccess(tagId, user.id);
    if (access.error) return access.error;

    const body = await request.json().catch(() => ({}));
    const updateData: Partial<typeof tags.$inferInsert> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json(
          { error: "Name must be a non-empty string" },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }

    if (body.i18n !== undefined) {
      updateData.i18n = normalizeCatalogI18n(body.i18n);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const [updatedTag] = await db
      .update(tags)
      .set(updateData)
      .where(eq(tags.id, tagId))
      .returning();

    await revalidatePublicMenuForLocation(access.existingTag.location.id);
    return NextResponse.json(updatedTag);
  } catch (error) {
    console.error("[PATCH /api/tags/[id]] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to update tag",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tags/[id]
 * Delete a tag
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tagId } = await params;

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

    if (!tagId || tagId.trim() === "") {
      return NextResponse.json(
        { error: "Tag ID is required" },
        { status: 400 }
      );
    }

    const access = await authorizeTagAccess(tagId, user.id);
    if (access.error) return access.error;

    // Delete tag (cascade will handle related records)
    await db.delete(tags).where(eq(tags.id, tagId));

    await revalidatePublicMenuForLocation(access.existingTag.location.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/tags/[id]] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error - Failed to delete tag",
      },
      { status: 500 }
    );
  }
}
