import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { merchantUsers } from "@/lib/db/schema";
import { sessions } from "@/lib/db/schema/orders";
import { createNextWaveForSession } from "@/domain";
import { devTimer, devSqlLog, devTimeStart, devTimeEnd, runExplain, DEV } from "@/lib/pos/devTimer";
import { posFailure, posSuccess, requireIdempotencyKey, toErrorMessage } from "@/app/api/_lib/pos-envelope";

export const runtime = "nodejs";

/**
 * POST /api/sessions/[sessionId]/waves/next
 * Create the next wave for a session.
 * Body: { eventSource? } (optional, accepted for consistency)
 * Does NOT write to DB in the route - delegates to domain.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const totalStart = DEV ? performance.now() : 0;
  const explainMode = DEV && new URL(request.url).searchParams.get("explain") === "1";
  let idemKey: string | undefined;
  try {
    const idem = requireIdempotencyKey(request);
    if (!idem.ok) return idem.failure;
    idemKey = idem.key;

    const { sessionId } = await params;

    const t0 = DEV ? performance.now() : 0;
    devTimeStart("POST waves/next auth");
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    devTimeEnd("POST waves/next auth");
    if (DEV) devTimer("POST waves/next auth", t0);

    if (userError || !user) {
      return posFailure("UNAUTHORIZED", "Unauthorized - Please log in", { status: 401, correlationId: idemKey });
    }

    const t1 = DEV ? performance.now() : 0;
    devTimeStart("POST waves/next sessions.findFirst");
    const existingSession = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
      with: {
        location: {
          columns: {
            id: true,
            merchantId: true,
          },
        },
      },
      columns: {
        id: true,
      },
    });
    devTimeEnd("POST waves/next sessions.findFirst", existingSession ? 1 : 0);
    if (DEV) devTimer("POST waves/next sessions.findFirst", t1, existingSession ? 1 : 0);

    const sessionsSelectSql = db.select().from(sessions).where(eq(sessions.id, sessionId));
    const { sql: sessionsSql, params: sessionsParams } = sessionsSelectSql.toSQL();
    if (DEV) devSqlLog("POST waves/next", "sessions.findFirst", sessionsSql, sessionsParams);

    if (!existingSession?.location) {
      return posFailure("NOT_FOUND", "Session not found", { status: 404, correlationId: idemKey });
    }

    const t2 = DEV ? performance.now() : 0;
    devTimeStart("POST waves/next merchantUsers.findFirst");
    const membership = await db.query.merchantUsers.findFirst({
      where: and(
        eq(merchantUsers.merchantId, existingSession.location.merchantId),
        eq(merchantUsers.userId, user.id),
        eq(merchantUsers.isActive, true)
      ),
      columns: { id: true },
    });
    devTimeEnd("POST waves/next merchantUsers.findFirst", membership ? 1 : 0);
    if (DEV) devTimer("POST waves/next merchantUsers.findFirst", t2, membership ? 1 : 0);

    if (!membership) {
      return posFailure("FORBIDDEN", "You don't have access to this location", { status: 403, correlationId: idemKey });
    }

    const t3 = DEV ? performance.now() : 0;
    devTimeStart("POST waves/next createNextWaveForSession");
    const result = await createNextWaveForSession(sessionId);
    devTimeEnd("POST waves/next createNextWaveForSession");
    if (DEV) devTimer("POST waves/next createNextWaveForSession", t3);

    if (!result.ok) {
      return posFailure(
        "INTERNAL_ERROR",
        result.reason ?? "Failed to create next wave",
        { status: 500, correlationId: idemKey }
      );
    }

    if (DEV) devTimer("POST waves/next total", totalStart);

    let meta: { explain?: string } | undefined;
    if (explainMode) {
      meta = { explain: await runExplain(sessionsSql, sessionsParams) };
    }
    return posSuccess(
      { waveNumber: result.wave },
      { correlationId: idemKey, meta }
    );
  } catch (error) {
    console.error("[POST /api/sessions/[sessionId]/waves/next] Error:", error);
    return posFailure(
      "INTERNAL_ERROR",
      toErrorMessage(error, "Internal server error - Failed to create next wave"),
      { status: 500, correlationId: idemKey }
    );
  }
}
