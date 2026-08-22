export const STORE_SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * First-party URL segments that must not be used as a public store slug.
 * Keep in sync with `src/app` route groups and next.config rewrites.
 */
export const RESERVED_STORE_SLUGS = [
  "account",
  "admin",
  "analytics",
  "api",
  "book",
  "builder",
  "collections",
  "communications",
  "counter",
  "dashboard",
  "dashboard-admin",
  "floor-map",
  "forgot-password",
  "guests",
  "hfi",
  "insights",
  "invite",
  "kds",
  "login",
  "logout",
  "menu",
  "merchants",
  "merge-split",
  "mobile",
  "order",
  "order-history",
  "orders",
  "products",
  "reservations",
  "reset-password",
  "scan",
  "signup",
  "staff",
  "table",
  "tables",
  "track",
] as const;

const RESERVED_STORE_SLUG_SET = new Set<string>(RESERVED_STORE_SLUGS);

export function normalizeStoreSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export function isReservedStoreSlug(slug: string): boolean {
  return RESERVED_STORE_SLUG_SET.has(normalizeStoreSlug(slug));
}

export function isValidStoreSlug(slug: string): boolean {
  const normalized = normalizeStoreSlug(slug);
  return STORE_SLUG_PATTERN.test(normalized) && !isReservedStoreSlug(normalized);
}

export function parseOptionalStoreSlug(
  raw: unknown,
): { ok: true; slug: string | null } | { ok: false; message: string } {
  if (raw == null || raw === "") return { ok: true, slug: null };
  if (typeof raw !== "string") {
    return { ok: false, message: "Store URL is invalid" };
  }
  const slug = normalizeStoreSlug(raw);
  if (!slug) return { ok: true, slug: null };
  if (!STORE_SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      message: "Only lowercase letters, numbers, and hyphens",
    };
  }
  if (isReservedStoreSlug(slug)) {
    return { ok: false, message: "This URL is reserved" };
  }
  return { ok: true, slug };
}

export function guestStorePath(storeSlug: string, suffix = ""): string {
  const base = `/${encodeURIComponent(normalizeStoreSlug(storeSlug))}`;
  if (!suffix) return base;
  return `${base}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
}

function pathnameOnly(path: string): string {
  return path.trim().split("?")[0]?.split("#")[0] ?? "";
}

function firstPathSegment(pathname: string): string | null {
  const segment = pathname.split("/").filter(Boolean)[0];
  if (!segment) return null;
  try {
    return decodeURIComponent(segment).trim().toLowerCase() || null;
  } catch {
    return segment.trim().toLowerCase() || null;
  }
}

function isSafeRelativePath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\");
}

/** True for `/{slug}` and legacy `/menu/{slug}` (and nested guest pages). */
export function isGuestStorePathname(pathname: string): boolean {
  const path = pathnameOnly(pathname);
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return false;

  const first = firstPathSegment(`/${segments[0]}`);
  if (!first) return false;

  if (first === "menu") {
    const slug = segments[1];
    if (!slug) return false;
    try {
      const decoded = decodeURIComponent(slug).trim().toLowerCase();
      return STORE_SLUG_PATTERN.test(decoded);
    } catch {
      return STORE_SLUG_PATTERN.test(slug.trim().toLowerCase());
    }
  }

  return isValidStoreSlug(first);
}

export function isGuestMenuPathForStore(pathname: string, storeSlug: string): boolean {
  const path = pathnameOnly(pathname);
  const slug = normalizeStoreSlug(storeSlug);
  if (!slug) return false;
  const encoded = encodeURIComponent(slug);
  const prefixes = [`/${encoded}`, `/${slug}`, `/menu/${encoded}`, `/menu/${slug}`];
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** True for `/{slug}` (and legacy `/menu/{slug}`) with no nested guest page. */
export function isGuestMenuRootPath(pathname: string, storeSlug: string): boolean {
  const path = pathnameOnly(pathname);
  const slug = normalizeStoreSlug(storeSlug);
  if (!slug) return false;
  const encoded = encodeURIComponent(slug);
  return (
    path === `/${encoded}` ||
    path === `/${slug}` ||
    path === `/menu/${encoded}` ||
    path === `/menu/${slug}`
  );
}

export function isGuestOrderingPathname(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathnameOnly(pathname);
  if (path === "/mobile" || path.startsWith("/mobile/")) return true;
  return isGuestStorePathname(path);
}

export function storeSlugFromGuestPathname(path: string | null | undefined): string | null {
  const raw = path?.trim() ?? "";
  if (!raw.startsWith("/")) return null;
  const pathname = pathnameOnly(raw);
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const readSlug = (value: string): string | null => {
    try {
      return decodeURIComponent(value).trim().toLowerCase() || null;
    } catch {
      return value.trim().toLowerCase() || null;
    }
  };

  if (segments[0]?.toLowerCase() === "menu") {
    const slug = segments[1] ? readSlug(segments[1]) : null;
    return slug && STORE_SLUG_PATTERN.test(slug) ? slug : null;
  }

  const slug = readSlug(segments[0]);
  if (slug && isValidStoreSlug(slug)) return slug;
  return null;
}

export function isSafeDinerReturnTo(returnTo: string): boolean {
  const trimmed = returnTo.trim();
  if (!isSafeRelativePath(trimmed)) return false;
  const pathname = pathnameOnly(trimmed);
  if (pathname === "/account" || pathname.startsWith("/account/")) return true;
  return isGuestStorePathname(pathname);
}

export function isSafeDinerLogoutReturnTo(returnTo: string): boolean {
  const trimmed = returnTo.trim();
  if (!isSafeRelativePath(trimmed)) return false;
  const pathname = pathnameOnly(trimmed);
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  return isSafeDinerReturnTo(trimmed);
}
