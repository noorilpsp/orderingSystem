"use client";

import { Button } from "@/components/ui/button";
import { MapPin, Phone, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { CallWaiterButton } from "@/components/ui/call-waiter-button";
import { useGuestT } from "@/lib/guest-i18n";

interface Restaurant {
  name: string;
  address: string;
  phone: string;
}

interface ActionButtonsProps {
  orderType: "dine_in" | "pickup";
  restaurant: Restaurant;
}

export function ActionButtons({ orderType, restaurant }: ActionButtonsProps) {
  const t = useGuestT();

  const handleGetDirections = () => {
    const address = encodeURIComponent(restaurant.address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, "_blank");
  };

  const handleCallRestaurant = () => {
    window.location.href = `tel:${restaurant.phone}`;
  };

  if (orderType === "dine_in") {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-50">
        <div className="max-w-md mx-auto">
          <div className="flex gap-3">
            <CallWaiterButton
              className="flex-1 h-12 text-base"
              onCall={async () => {
                await new Promise((resolve) => setTimeout(resolve, 800));
              }}
            />
            <Button
              className="flex-1 h-12 rounded-lg bg-white text-foreground hover:bg-gray-50 text-base font-semibold border-2 border-gray-300 shadow-sm hover:shadow-md transition-all"
              asChild
            >
              <Link href="/mobile">
                <ShoppingCart className="w-5 h-5 mr-2" />
                {t("confirm.orderMore")}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-50">
      <div className="max-w-md mx-auto">
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <Button
              onClick={handleGetDirections}
              className="flex-1 h-12 rounded-lg bg-black text-white hover:bg-gray-900 text-base font-semibold"
            >
              <MapPin className="w-5 h-5 mr-2" />
              {t("confirm.getDirections")}
            </Button>
            <Button
              onClick={handleCallRestaurant}
              variant="outline"
              className="flex-1 h-12 rounded-lg text-base font-semibold"
            >
              <Phone className="w-5 h-5 mr-2" />
              {t("confirm.callRestaurant")}
            </Button>
          </div>
          <Button
            className="w-full h-12 rounded-lg bg-white text-foreground hover:bg-gray-50 text-base font-semibold border-2 border-gray-300 shadow-sm hover:shadow-md transition-all"
            asChild
          >
            <Link href="/mobile">
              <ShoppingCart className="w-5 h-5 mr-2" />
              {t("confirm.orderMore")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
