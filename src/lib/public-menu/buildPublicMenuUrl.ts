export type PublicMenuPath = "menu" | "checkout" | "order-confirmation";

export type BuildPublicMenuUrlInput = {
  storeSlug: string;
  tableNumber?: string | null;
  mode?: "dine-in" | "pickup" | "on_site";
  path?: PublicMenuPath;
  origin?: string;
  extraParams?: Record<string, string | undefined>;
};

export function buildGuestMenuQueryString(input: {
  tableNumber?: string | null;
  mode?: "dine-in" | "pickup" | "on_site";
  extraParams?: Record<string, string | undefined>;
}): string {
  const params = new URLSearchParams();

  const table = input.tableNumber?.trim();
  if (table) params.set("table", table);

  if (input.mode === "pickup") {
    params.set("mode", "pickup");
  }

  for (const [key, value] of Object.entries(input.extraParams ?? {})) {
    if (value != null && value !== "") params.set(key, value);
  }

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function buildPublicMenuUrl({
  storeSlug,
  tableNumber,
  mode = "dine-in",
  path = "menu",
  origin = "",
  extraParams,
}: BuildPublicMenuUrlInput): string {
  const normalizedSlug = storeSlug.trim().toLowerCase();
  const suffix =
    path === "checkout"
      ? "/checkout"
      : path === "order-confirmation"
        ? "/order-confirmation"
        : "";

  const pathname = `/menu/${encodeURIComponent(normalizedSlug)}${suffix}`;
  const query = buildGuestMenuQueryString({ tableNumber, mode, extraParams });

  if (!origin) return `${pathname}${query}`;
  return `${origin.replace(/\/$/, "")}${pathname}${query}`;
}

export function buildTableQrMenuUrl(
  storeSlug: string,
  tableNumber: string,
  origin?: string,
): string {
  return buildPublicMenuUrl({
    storeSlug,
    tableNumber,
    mode: "dine-in",
    path: "menu",
    origin,
  });
}
