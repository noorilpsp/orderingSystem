import type { GuestSessionMode } from "@/lib/guest-menu/types";

type OrderModesLike = {
  dine_in?: { guest_session_mode?: GuestSessionMode };
} | null | undefined;

export function resolveGuestSessionMode(orderModes: OrderModesLike): GuestSessionMode {
  return orderModes?.dine_in?.guest_session_mode === "self_service"
    ? "self_service"
    : "staff_seated";
}
