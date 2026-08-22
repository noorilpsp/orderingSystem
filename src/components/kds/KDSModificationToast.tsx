'use client';

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/kds/ui/button";
import { cn } from "@/lib/utils";

export type OrderChange = {
  type: 'added' | 'removed' | 'modified';
  item: {
    name: string;
    quantity?: number;
    variant?: string | null;
  };
  details?: string;
};

export interface ModificationToastData {
  id: string;
  orderId: string;
  orderNumber: string;
  tableNumber: string | null;
  customerName: string | null;
  changes: OrderChange[];
}

interface KDSModificationToastProps {
  toast: ModificationToastData;
  onDismiss: () => void;
  onView: () => void;
}

export function KDSModificationToast({ toast, onDismiss, onView }: KDSModificationToastProps) {
  const locationText = toast.tableNumber
    ? `Table ${toast.tableNumber}`
    : toast.customerName ?? "-";

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="rounded-lg shadow-lg border-l-4 border-amber-500 border border-amber-300 dark:border-amber-700 min-w-[320px] max-w-[420px] w-full"
    >
      <div
        className="p-4 rounded-lg min-h-full"
        style={{
          backgroundColor: 'hsl(48 96% 96%)',
        }}
      >
        <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden />
          ORDER MODIFIED
        </div>
        <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">
          #{toast.orderNumber} · {locationText}
        </div>
        <div className="mt-3 space-y-1">
          <div className="font-medium text-sm text-amber-800 dark:text-amber-200">Changes:</div>
          {toast.changes.map((change, i) => (
            <div key={i} className="text-sm flex items-baseline gap-2">
              <span className="text-amber-600 dark:text-amber-400 shrink-0">•</span>
              <span
                className={cn(
                  change.type === "added" && "text-green-700 dark:text-green-400",
                  change.type === "removed" && "text-red-700 dark:text-red-400",
                  change.type === "modified" && "text-amber-800 dark:text-amber-200"
                )}
              >
                {change.type === "added" &&
                  `Added: ${change.item.quantity ?? 1}× ${change.item.name}${change.item.variant ? ` (${change.item.variant})` : ""}`}
                {change.type === "removed" &&
                  `Removed: ${change.item.quantity ?? 1}× ${change.item.name}${change.item.variant ? ` (${change.item.variant})` : ""}`}
                {change.type === "modified" &&
                  `Changed: ${change.item.name}${change.details ? ` ${change.details}` : ""}`}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full font-medium border-2 rounded-md text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50"
            onClick={onDismiss}
          >
            Reject
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full font-medium border-2 rounded-md text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
            onClick={onView}
          >
            Accept
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

interface KDSModificationToastContainerProps {
  toasts: ModificationToastData[];
  onDismiss: (toastId: string) => void;
  onView: (orderId: string) => void;
}

export function KDSModificationToastContainer({
  toasts,
  onDismiss,
  onView,
}: KDSModificationToastContainerProps) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-2rem)]">
      <div className="flex flex-col gap-2 items-center pointer-events-auto">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <KDSModificationToast
              key={toast.id}
              toast={toast}
              onDismiss={() => onDismiss(toast.id)}
              onView={() => onView(toast.orderId)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
