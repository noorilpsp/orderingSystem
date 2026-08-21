import { formatPhoneForDisplay, isValidGuestPhone } from "@/lib/public-menu/guest-phone";

export type GuestDeliveryAddress = {
  id: string;
  nickname: string;
  line1: string;
  building: string;
  line2: string;
  city: string;
  intercom: string;
  phone: string;
  postalCode: string;
  instructions: string;
};

export type GuestDeliveryAddressInput = {
  nickname?: string | null;
  line1?: string | null;
  building?: string | null;
  line2?: string | null;
  city?: string | null;
  intercom?: string | null;
  phone?: string | null;
  postalCode?: string | null;
  instructions?: string | null;
};

const STORAGE_KEY = "guest-delivery-addresses";
const SELECTED_KEY = "guest-delivery-address-selected";
const MAX_SAVED = 5;

function newAddressId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `addr-${Date.now()}`;
}

export const GUEST_DELIVERY_REQUIRED_FIELDS = [
  "nickname",
  "line1",
  "building",
  "line2",
  "intercom",
  "phone",
] as const;

export type GuestDeliveryRequiredField = (typeof GUEST_DELIVERY_REQUIRED_FIELDS)[number];

export function firstMissingGuestDeliveryAddressField(
  input: GuestDeliveryAddressInput | null | undefined,
): GuestDeliveryRequiredField | null {
  const nickname = input?.nickname?.trim() ?? "";
  const line1 = input?.line1?.trim() ?? "";
  const building = input?.building?.trim() ?? "";
  const line2 = input?.line2?.trim() ?? "";
  const intercom = input?.intercom?.trim() ?? "";
  const phone = input?.phone?.trim() ?? "";
  if (nickname.length < 1) return "nickname";
  if (line1.length < 3) return "line1";
  if (building.length < 1) return "building";
  if (line2.length < 1) return "line2";
  if (intercom.length < 1) return "intercom";
  if (!isValidGuestPhone(phone)) return "phone";
  return null;
}

export function normalizeGuestDeliveryAddress(
  input: GuestDeliveryAddressInput | null | undefined,
  id?: string,
): GuestDeliveryAddress | null {
  if (firstMissingGuestDeliveryAddressField(input)) return null;
  const nickname = input?.nickname?.trim() ?? "";
  const line1 = input?.line1?.trim() ?? "";
  const building = input?.building?.trim() ?? "";
  const line2 = input?.line2?.trim() ?? "";
  const intercom = input?.intercom?.trim() ?? "";
  const phone = input?.phone?.trim() ?? "";
  return {
    id: id?.trim() || newAddressId(),
    nickname: nickname.slice(0, 40),
    line1: line1.slice(0, 255),
    building: building.slice(0, 255),
    line2: line2.slice(0, 255),
    city: (input?.city?.trim() ?? "").slice(0, 100),
    intercom: intercom.slice(0, 255),
    phone: phone.slice(0, 50),
    postalCode: (input?.postalCode?.trim() ?? "").slice(0, 20),
    instructions: (input?.instructions?.trim() ?? "").slice(0, 500),
  };
}

export function parseGuestDeliveryAddressBody(
  value: unknown,
): GuestDeliveryAddressInput | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const read = (key: string): string | null =>
    typeof record[key] === "string" ? record[key] : null;
  return {
    nickname: read("nickname"),
    line1: read("line1"),
    building: read("building"),
    line2: read("line2"),
    city: read("city"),
    intercom: read("intercom"),
    phone: read("phone"),
    postalCode: read("postalCode"),
    instructions: read("instructions"),
  };
}

export function isCompleteGuestDeliveryAddress(
  address: GuestDeliveryAddress | null | undefined,
): address is GuestDeliveryAddress {
  return normalizeGuestDeliveryAddress(address, address?.id) != null;
}

export function formatGuestDeliveryAddressLines(
  address: GuestDeliveryAddress,
): string[] {
  const lines = [address.line1];
  if (address.building) lines.push(address.building);
  if (address.line2) lines.push(address.line2);
  if (address.city) lines.push(address.city);
  if (address.intercom) lines.push(address.intercom);
  return lines.filter((line) => line.length > 0);
}

export function formatGuestDeliveryAddressInline(
  address: GuestDeliveryAddress,
): string {
  return formatGuestDeliveryAddressLines(address).join(", ");
}

export function formatGuestDeliveryAddressNote(
  address: GuestDeliveryAddress,
  guestName?: string | null,
  storeCountry?: string | null,
): string {
  const where = [address.line1, address.building, address.line2, address.city, address.intercom]
    .filter(Boolean)
    .join(", ");
  const to = guestName?.trim() ? ` ${guestName.trim()}` : "";
  const label = address.nickname ? `${address.nickname} · ` : "";
  const displayPhone = formatPhoneForDisplay(address.phone, storeCountry);
  const extras = [displayPhone ? `Tel ${displayPhone}` : null, address.instructions].filter(Boolean);
  const note = `Deliver to${to}: ${label}${where}`;
  return extras.length > 0 ? `${note} · ${extras.join(" · ")}` : note;
}

function sameAddress(a: GuestDeliveryAddress, b: GuestDeliveryAddress): boolean {
  return (
    a.line1.toLowerCase() === b.line1.toLowerCase() &&
    a.building.toLowerCase() === b.building.toLowerCase() &&
    a.line2.toLowerCase() === b.line2.toLowerCase() &&
    a.city.toLowerCase() === b.city.toLowerCase() &&
    a.postalCode.toLowerCase() === b.postalCode.toLowerCase()
  );
}

export function readSavedGuestDeliveryAddresses(): GuestDeliveryAddress[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const addresses: GuestDeliveryAddress[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const record = row as Record<string, unknown>;
      const normalized = normalizeGuestDeliveryAddress(
        {
          nickname: typeof record.nickname === "string" ? record.nickname : null,
          line1: typeof record.line1 === "string" ? record.line1 : null,
          building: typeof record.building === "string" ? record.building : null,
          line2: typeof record.line2 === "string" ? record.line2 : null,
          city: typeof record.city === "string" ? record.city : null,
          intercom: typeof record.intercom === "string" ? record.intercom : null,
          phone: typeof record.phone === "string" ? record.phone : null,
          postalCode: typeof record.postalCode === "string" ? record.postalCode : null,
          instructions: typeof record.instructions === "string" ? record.instructions : null,
        },
        typeof record.id === "string" ? record.id : undefined,
      );
      if (normalized) addresses.push(normalized);
    }
    return addresses.slice(0, MAX_SAVED);
  } catch {
    return [];
  }
}

export function readSelectedGuestDeliveryAddressId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SELECTED_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

function writeSaved(addresses: GuestDeliveryAddress[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses.slice(0, MAX_SAVED)));
  } catch {
    /* ignore quota / private mode */
  }
}

export function writeSelectedGuestDeliveryAddressId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(SELECTED_KEY, id);
    else window.localStorage.removeItem(SELECTED_KEY);
  } catch {
    /* ignore */
  }
}

export function upsertSavedGuestDeliveryAddress(
  address: GuestDeliveryAddress,
): GuestDeliveryAddress[] {
  const current = readSavedGuestDeliveryAddresses();
  const existing = current.find((row) => row.id === address.id || sameAddress(row, address));
  const next = existing
    ? [{ ...address, id: existing.id }, ...current.filter((row) => row.id !== existing.id)]
    : [address, ...current];
  const capped = next.slice(0, MAX_SAVED);
  writeSaved(capped);
  writeSelectedGuestDeliveryAddressId(capped[0]?.id ?? null);
  return capped;
}

export function deleteSavedGuestDeliveryAddress(id: string): GuestDeliveryAddress[] {
  const next = readSavedGuestDeliveryAddresses().filter((row) => row.id !== id);
  writeSaved(next);
  const selected = readSelectedGuestDeliveryAddressId();
  if (selected === id) {
    writeSelectedGuestDeliveryAddressId(next[0]?.id ?? null);
  }
  return next;
}

export function readLastGuestDeliveryAddress(): GuestDeliveryAddress | null {
  const saved = readSavedGuestDeliveryAddresses();
  if (saved.length === 0) return null;
  const selectedId = readSelectedGuestDeliveryAddressId();
  return saved.find((row) => row.id === selectedId) ?? saved[0] ?? null;
}
