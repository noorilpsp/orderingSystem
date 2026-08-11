const DEVICE_ID_KEY = "guest-device-id";

export type StoredGuestSeat = {
  sessionId: string;
  seatId: string;
  seatNumber: number;
  guestName: string | null;
};

function seatStorageKey(storeSlug: string, tableNumber: string): string {
  return `guest-seat:${storeSlug.trim().toLowerCase()}:${tableNumber.trim()}`;
}

export function getOrCreateGuestDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) {
      return existing;
    }
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function readGuestSeat(storeSlug: string, tableNumber: string): StoredGuestSeat | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(seatStorageKey(storeSlug, tableNumber));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGuestSeat;
    if (
      typeof parsed.seatId === "string" &&
      typeof parsed.seatNumber === "number" &&
      typeof parsed.sessionId === "string"
    ) {
      return {
        sessionId: parsed.sessionId,
        seatId: parsed.seatId,
        seatNumber: parsed.seatNumber,
        guestName: parsed.guestName ?? null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeGuestSeat(
  storeSlug: string,
  tableNumber: string,
  seat: StoredGuestSeat,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(seatStorageKey(storeSlug, tableNumber), JSON.stringify(seat));
  } catch {
    // ignore quota errors
  }
}

export function clearGuestSeat(storeSlug: string, tableNumber: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(seatStorageKey(storeSlug, tableNumber));
  } catch {
    // ignore
  }
}
