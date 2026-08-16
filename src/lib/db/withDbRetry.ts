function isTransientDbError(error: unknown): boolean {
  const parts: string[] = [];
  if (error instanceof Error) {
    parts.push(error.message);
    if (error.cause != null) {
      parts.push(String(error.cause));
    }
  } else {
    parts.push(String(error));
  }
  const combined = parts.join(" ").toLowerCase();
  return (
    combined.includes("fetch failed") ||
    combined.includes("etimedout") ||
    combined.includes("econnreset") ||
    combined.includes("econnrefused") ||
    combined.includes("connection terminated") ||
    combined.includes("connection closed") ||
    combined.includes("socket hang up") ||
    combined.includes("network") ||
    combined.includes("timeout") ||
    combined.includes("too many connections") ||
    combined.includes("failed query") ||
    combined.includes("server closed the connection") ||
    combined.includes("cannot acquire")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry transient Neon/HTTP database errors (timeouts, connection blips). */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  attempts = 4,
  baseDelayMs = 400
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === attempts - 1) {
        throw error;
      }
      await sleep(baseDelayMs * (attempt + 1));
    }
  }
  throw lastError;
}

export function toUserFacingDbError(error: unknown, fallback: string): string {
  if (isTransientDbError(error)) {
    return "Connection is slow or unstable. Please try again.";
  }
  if (error instanceof Error && error.message.trim()) {
    const message = error.message.trim();
    // Never surface raw SQL / driver dump to guests or staff UI.
    if (looksLikeRawDbDump(message)) {
      return fallback;
    }
    return message;
  }
  return fallback;
}

/** True when a string looks like a drizzle/neon SQL dump (unsafe for UI). */
export function looksLikeRawDbDump(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith("Failed query:") ||
    trimmed.includes(' from "') ||
    trimmed.includes(" select ") ||
    /params:\s/i.test(trimmed) ||
    /\$\d+/.test(trimmed)
  );
}

/**
 * Sanitize any API/client error string before showing it in toasts or inline UI.
 * Safe to import from client components.
 */
export function toUserFacingErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (error == null) return fallback;
  if (typeof error === "string") {
    const trimmed = error.trim();
    if (!trimmed) return fallback;
    if (looksLikeRawDbDump(trimmed) || isTransientDbError(trimmed)) {
      return fallback === "Something went wrong. Please try again."
        ? "Connection is slow or unstable. Please try again."
        : fallback;
    }
    return trimmed;
  }
  return toUserFacingDbError(error, fallback);
}
