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

export function formatGuestDeliveryAddressCompact(input: {
  line1?: string | null;
  building?: string | null;
  line2?: string | null;
}): string {
  const area = input.line1?.trim() || "";
  const parsedApt = parseLabeledBuildingApt(input.line2);
  const building = input.building?.trim() || parsedApt.building || "";
  const apt = (input.building?.trim() ? input.line2?.trim() : parsedApt.line2) || "";
  return [
    area || null,
    [building ? `bld ${building}` : null, apt ? `Apt ${apt}` : null]
      .filter(Boolean)
      .join(" ") || null,
  ]
    .filter(Boolean)
    .join(", ");
}

export function formatGuestDeliveryContactLine(
  name?: string | null,
  phone?: string | null,
  storeCountry?: string | null,
): string {
  const who = name?.trim() || "";
  const number = formatPhoneForDisplay(phone, storeCountry);
  if (who && number) return `${who} . ${number}`;
  return who || number;
}

export function guestDeliveryDisplayLines(
  input: {
    line1?: string | null;
    building?: string | null;
    line2?: string | null;
    intercom?: string | null;
    phone?: string | null;
    instructions?: string | null;
  },
  formatPhone?: (phone: string) => string,
): { place: string; contact: string; instructions: string | null } {
  const phone = input.phone?.trim() || "";
  return {
    place: formatGuestDeliveryAddressCompact(input),
    contact: formatGuestDeliveryContactLine(
      input.intercom,
      phone ? (formatPhone ? formatPhone(phone) : phone) : null,
    ),
    instructions: input.instructions?.trim() || null,
  };
}

export function formatGuestDeliveryAddressLines(
  address: GuestDeliveryAddress,
): string[] {
  const compact = formatGuestDeliveryAddressCompact({
    line1: address.line1,
    building: address.building,
    line2: address.line2,
  });
  return compact ? [compact] : [];
}

export function formatGuestDeliveryAddressInline(
  address: GuestDeliveryAddress,
): string {
  return formatGuestDeliveryAddressLines(address).join(" · ");
}

export function parseLabeledBuildingApt(raw: string | null | undefined): {
  building: string | null;
  line2: string | null;
} {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return { building: null, line2: null };

  const buildingMatch = trimmed.match(/Building:\s*([^·]+)/i);
  const aptMatch = trimmed.match(/Apt:\s*(.+)$/i);
  if (buildingMatch || aptMatch) {
    return {
      building: buildingMatch?.[1]?.trim() || null,
      line2: aptMatch?.[1]?.trim() || null,
    };
  }

  const commaParts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (
    commaParts.length === 2 &&
    (commaParts[0]?.length ?? 0) <= 20 &&
    (commaParts[1]?.length ?? 0) <= 20
  ) {
    return { building: commaParts[0] ?? null, line2: commaParts[1] ?? null };
  }

  return { building: null, line2: trimmed };
}

export function parseDeliveryInstructionParts(raw: string | null | undefined): {
  intercom: string | null;
  phone: string | null;
  instructions: string | null;
} {
  const parts = (raw ?? "")
    .split(/\n| · /)
    .map((part) => part.trim())
    .filter(Boolean);
  let intercom: string | null = null;
  let phone: string | null = null;
  let instructions: string | null = null;
  const unlabeled: string[] = [];
  for (const part of parts) {
    const intercomMatch = part.match(/^(?:intercom|door):\s*(.+)$/i);
    if (intercomMatch) {
      intercom = intercomMatch[1]?.trim() || null;
      continue;
    }
    const phoneMatch = part.match(/^(?:phone|tel):\s*(.+)$/i);
    if (phoneMatch) {
      phone = phoneMatch[1]?.trim() || null;
      continue;
    }
    if (part.toLowerCase().startsWith("tel ")) {
      phone = part.slice(4).trim() || null;
      continue;
    }
    const noteMatch = part.match(/^(?:note|instructions?):\s*(.+)$/i);
    if (noteMatch) {
      instructions = noteMatch[1]?.trim() || null;
      continue;
    }
    unlabeled.push(part);
  }
  if (!intercom && unlabeled.length > 0) {
    intercom = unlabeled[0] ?? null;
    unlabeled.shift();
  }
  if (!instructions && unlabeled.length > 0) {
    instructions = unlabeled.join(" · ");
  }
  return { intercom, phone, instructions };
}

function parseLegacyInlineDelivery(raw: string): {
  place: string | null;
  contact: string | null;
} | null {
  const text = raw.replace(/^[:\s]+/, "").trim();
  if (!text) return null;
  const looksLegacy = /\s·\s/.test(text) || /\bTel\b/i.test(text);
  if (!looksLegacy) return null;
  if (/\bbld\b/i.test(text) || /\bApt\b/.test(text)) return null;

  const telMatch = text.match(/^(.*?)(?:\s*·\s*)?Tel\s+(.+)$/i);
  const phone = telMatch?.[2]?.trim() || null;
  const beforeTel = (telMatch?.[1] ?? text).trim();
  const segments = beforeTel
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  const addressBlob =
    segments.length >= 2 ? segments.slice(1).join(", ") : beforeTel;
  const commaParts = addressBlob
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  let line1: string | null = null;
  let building: string | null = null;
  let line2: string | null = null;
  let intercom: string | null = null;
  if (commaParts.length >= 4) {
    intercom = commaParts[commaParts.length - 1] ?? null;
    line2 = commaParts[commaParts.length - 2] ?? null;
    building = commaParts[commaParts.length - 3] ?? null;
    line1 = commaParts.slice(0, -3).join(", ") || null;
  } else if (commaParts.length === 3) {
    line1 = commaParts[0] ?? null;
    building = commaParts[1] ?? null;
    line2 = commaParts[2] ?? null;
  } else if (commaParts.length === 2) {
    line1 = commaParts[0] ?? null;
    building = commaParts[1] ?? null;
  } else {
    line1 = addressBlob || null;
  }

  return {
    place: formatGuestDeliveryAddressCompact({ line1, building, line2 }) || null,
    contact: formatGuestDeliveryContactLine(intercom, phone) || null,
  };
}

export function splitGuestDeliveryOrderNote(notes: string | null | undefined): {
  place: string | null;
  contact: string | null;
  instructions: string | null;
} {
  if (!notes?.trim()) {
    return { place: null, contact: null, instructions: null };
  }

  const lines = notes
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let place: string | null = null;
  let contact: string | null = null;
  const rest: string[] = [];
  let seenDeliverTo = false;
  let consumedContact = false;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith("deliver to")) {
      const after = line
        .replace(/^deliver to:?\s*/i, "")
        .replace(/^[:\s]+/, "")
        .trim();
      const legacy = parseLegacyInlineDelivery(after);
      if (legacy) {
        place = legacy.place || place;
        if (legacy.contact) {
          contact = legacy.contact;
          consumedContact = true;
        }
      } else {
        place = after || place;
      }
      seenDeliverTo = true;
      continue;
    }
    if (lower.startsWith("street:")) {
      const after = line.slice("street:".length).trim();
      place = [place, after].filter(Boolean).join(", ");
      seenDeliverTo = true;
      continue;
    }
    if (
      lower.startsWith("building:") ||
      lower.startsWith("apt:") ||
      lower.startsWith("city:")
    ) {
      continue;
    }
    if (lower.startsWith("intercom:") || lower.startsWith("phone:") || lower.startsWith("tel ")) {
      const value = line.replace(/^(?:intercom:|phone:|tel)\s*/i, "").trim();
      contact = [contact, value].filter(Boolean).join(" . ");
      consumedContact = true;
      continue;
    }
    if (lower.startsWith("note:") || lower.startsWith("instructions:")) {
      const value = line.replace(/^(?:note|instructions?):\s*/i, "").trim();
      if (value) rest.push(value);
      continue;
    }
    if (seenDeliverTo && !consumedContact) {
      contact = line;
      consumedContact = true;
      continue;
    }
    rest.push(line);
  }

  return {
    place,
    contact,
    instructions: rest.join("\n") || null,
  };
}

export function formatGuestDeliveryAddressNote(
  address: GuestDeliveryAddress,
  storeCountry?: string | null,
): string {
  const compact = formatGuestDeliveryAddressCompact({
    line1: address.line1,
    building: address.building,
    line2: address.line2,
  });
  const { contact } = guestDeliveryDisplayLines(address, (phone) =>
    formatPhoneForDisplay(phone, storeCountry),
  );
  const lines = [
    compact ? `Deliver to ${compact}` : "Deliver to",
    contact || null,
    address.instructions.trim() ? address.instructions.trim() : null,
  ];
  return lines.filter(Boolean).join("\n");
}

export function formatStoredDeliveryAddressLine2(
  building: string | null | undefined,
  apt: string | null | undefined,
): string | null {
  const labeled = [
    building?.trim() ? `Building: ${building.trim()}` : null,
    apt?.trim() ? `Apt: ${apt.trim()}` : null,
  ].filter(Boolean);
  return labeled.length > 0 ? labeled.join(" · ") : null;
}

export function formatStoredDeliveryInstructions(
  address: Pick<GuestDeliveryAddress, "intercom" | "phone" | "instructions">,
  storeCountry?: string | null,
): string | null {
  const displayPhone = formatPhoneForDisplay(address.phone, storeCountry);
  const lines = [
    address.intercom.trim() ? `Intercom: ${address.intercom.trim()}` : null,
    displayPhone ? `Phone: ${displayPhone}` : null,
    address.instructions.trim() ? `Note: ${address.instructions.trim()}` : null,
  ].filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : null;
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
