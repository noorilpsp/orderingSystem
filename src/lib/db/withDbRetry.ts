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
    combined.includes("connection terminated") ||
    combined.includes("failed query")
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
    return "Database connection timed out. Please try again.";
  }
  if (error instanceof Error && error.message.trim()) {
    if (error.message.startsWith("Failed query:")) {
      return fallback;
    }
    return error.message;
  }
  return fallback;
}
