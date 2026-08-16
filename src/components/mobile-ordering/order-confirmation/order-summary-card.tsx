"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { useGuestLocalization } from "@/lib/hooks/useGuestLocalization";

interface OrderItem {
  quantity: number;
  name: string;
  price: number;
}

interface OrderSummaryCardProps {
  items: OrderItem[];
  total: number;
  expanded: boolean;
  onToggle: () => void;
}

export function OrderSummaryCard({
  items,
  total,
  expanded,
  onToggle,
}: OrderSummaryCardProps) {
  const { formatMoney } = useGuestLocalization();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Card>
      <CardContent className="pt-6">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between text-left"
        >
          <div>
            <p className="font-semibold text-foreground">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </p>
            <p className="text-sm text-muted-foreground">{formatMoney(total)}</p>
          </div>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          </motion.div>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t space-y-3">
                {items.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex justify-between items-start"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {item.quantity}x {item.name}
                      </p>
                    </div>
                    <p className="text-foreground font-medium ml-4">
                      {formatMoney(item.price * item.quantity)}
                    </p>
                  </motion.div>
                ))}
                <div className="pt-2 border-t mt-3">
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-lg">Total</p>
                    <p className="font-bold text-lg">{formatMoney(total)}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
