import { NextResponse } from "next/server";
import { toUserFacingDbError } from "@/lib/db/withDbRetry";

type SuccessOptions = {
  status?: number;
  correlationId?: string;
  meta?: Record<string, unknown>;
};

type FailureOptions = {
  status?: number;
  correlationId?: string;
  meta?: Record<string, unknown>;
};

export function posSuccess<T>(data: T, options: SuccessOptions = {}) {
  const { status = 200, correlationId, meta } = options;
  return NextResponse.json(
    {
      ok: true as const,
      data,
      ...(correlationId ? { correlationId } : {}),
      ...(meta ? { meta } : {}),
    },
    { status }
  );
}

export function posFailure(
  code: string,
  message: string,
  options: FailureOptions = {}
) {
  const { status = 400, correlationId, meta } = options;
  return NextResponse.json(
    {
      ok: false as const,
      error: {
        code,
        message,
        ...(meta ? { meta } : {}),
      },
      ...(correlationId ? { correlationId } : {}),
    },
    { status }
  );
}

/** Never return raw SQL/driver dumps to API clients. */
export function toErrorMessage(error: unknown, fallback: string) {
  return toUserFacingDbError(error, fallback);
}

export function requireIdempotencyKey(req: Request):
  | { ok: true; key: string }
  | { ok: false; failure: NextResponse } {
  const key = req.headers.get("Idempotency-Key")?.trim();
  if (!key) {
    return { ok: false, failure: posFailure("BAD_REQUEST", "Missing Idempotency-Key", { status: 400 }) };
  }
  return { ok: true, key };
}
