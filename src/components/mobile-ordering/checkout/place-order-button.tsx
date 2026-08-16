"use client";

import { useGuestT } from "@/lib/guest-i18n";
import { useGuestLocalization } from "@/lib/hooks/useGuestLocalization";

interface PlaceOrderButtonProps {
  total: number;
  isEnabled: boolean;
  onClick: () => void;
}

export function PlaceOrderButton({
  total,
  isEnabled,
  onClick,
}: PlaceOrderButtonProps) {
  const t = useGuestT();
  const { formatMoney } = useGuestLocalization();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
      <div className="max-w-md mx-auto">
        <button
          type="button"
          className={`w-full rounded-lg py-3 font-semibold transition-colors ${
            isEnabled
              ? "bg-black text-white hover:bg-gray-900"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
          disabled={!isEnabled}
          onClick={onClick}
        >
          {t("checkout.placeOrder")} • {formatMoney(total)}
        </button>
      </div>
    </div>
  );
}
