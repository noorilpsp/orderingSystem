import { useGuestT } from "@/lib/guest-i18n";

export function guestDealKind(input: {
  promoKind?: "sale_price" | "bogo" | null;
  isLoyaltyReward?: boolean;
}): "bogo" | "reward" | null {
  if (input.promoKind === "bogo") return "bogo";
  if (input.isLoyaltyReward) return "reward";
  return null;
}

export function GuestDealBadge({
  kind,
}: {
  kind: "bogo" | "reward" | null;
}) {
  const t = useGuestT();
  if (!kind) return null;
  switch (kind) {
    case "bogo":
      return (
        <span className="ml-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          {t("menu.bogoShort")}
        </span>
      );
    case "reward":
      return (
        <span className="ml-2 text-xs font-semibold text-orange-600">
          {t("cart.reward")}
        </span>
      );
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
