"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { customizationGroups } from "@/lib/menu-item-modal-data";
import { getGuestCartItemLineTotal } from "@/lib/public-menu/guest-cart-pricing";
import type { GuestCustomizationGroup } from "@/lib/guest-menu/types";
import { GuestCustomizationDisplayLines } from "@/components/shared/customization-display-lines";
import { useGuestLocalization } from "@/lib/hooks/useGuestLocalization";

interface OrderItem {
  quantity: number;
  name: string;
  variant: string | null;
  price: number;
  selectedOptions?: Record<string, string[]>;
  sauceQuantities?: Record<string, number>;
  specialInstructions?: string;
}

const pricingGroups = customizationGroups as unknown as GuestCustomizationGroup[];

interface OrderSummarySectionProps {
  items: OrderItem[];
  itemCount: number;
  subtotal: number;
  expanded: boolean;
  onToggle: () => void;
}

export function OrderSummarySection({
  items,
  itemCount,
  subtotal,
  expanded,
  onToggle,
}: OrderSummarySectionProps) {
  const { formatMoney } = useGuestLocalization();
  return (
    <div className="mb-5 -mt-1.5">
      <h2 className="text-lg font-bold text-foreground mb-0">Order Summary</h2>
      <div className="border-t border-b border-border -mt-2">
        <Button
          variant="ghost"
          className="w-full justify-between px-0 py-4 h-auto text-foreground hover:bg-transparent"
          onClick={onToggle}
        >
          <div className="flex items-center gap-3 flex-1 -ml-4">
            {/* Circular Image */}
            <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
              <img 
                src="/placeholder.jpg" 
                alt="Restaurant" 
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Text Content */}
            <div className="flex-1 text-left">
              <div className="text-base font-bold text-foreground">
                Order Summary
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          
          <ChevronDown
            className={`w-4 h-4 transition-transform flex-shrink-0 ${
              expanded ? "rotate-180" : ""
            }`}
          />
      </Button>

      {expanded && (
        <div className="py-4 space-y-3 border-t border-border">
          {items.map((item, index) => (
            <div key={index} className="flex justify-between">
              <div className="flex-1 min-w-0 flex flex-col">
                <p className="font-semibold text-base text-foreground">
                  {item.quantity}× {item.name}
                  {item.variant && ` (${item.variant})`}
                </p>
                
                {/* Customizations */}
                {(item.selectedOptions || item.sauceQuantities || item.specialInstructions) && (
                  <div className="mt-1 space-y-1">
                    <GuestCustomizationDisplayLines
                      groups={pricingGroups}
                      selectedOptions={item.selectedOptions}
                      textSizeClassName="text-sm"
                    />
                    {item.sauceQuantities &&
                      Object.entries(item.sauceQuantities).map(([sauceId, qty]) =>
                        qty > 0 ? (
                          <p key={sauceId} className="text-sm text-teal-700">
                            <span className="text-foreground/70">Extra Sauce:</span>{" "}
                            {sauceId} x{qty}
                          </p>
                        ) : null,
                      )}
                    {item.specialInstructions ? (
                      <p className="text-sm">
                        <span className="text-foreground/70">Instructions:</span>{" "}
                        <span className="italic text-amber-700/90">
                          {item.specialInstructions}
                        </span>
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
              <span className="text-foreground font-medium ml-4 flex-shrink-0">
                {formatMoney(getGuestCartItemLineTotal(item, pricingGroups))}
              </span>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Thick Separator - Full width */}
      <div className="h-0.5 bg-gray-200 mt-4 mb-0 -mx-4" />
    </div>
  );
}
