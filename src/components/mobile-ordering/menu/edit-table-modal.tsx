"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PublicMenuTable } from "@/lib/public-menu/types";

interface EditTableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableNumber: string;
  onConfirm: (tableNumber: string) => void;
  /**
   * When provided (including empty), guests pick from store-configured tables.
   * When omitted, falls back to a 1–50 picker (demo / legacy).
   */
  tables?: PublicMenuTable[];
}

export function EditTableModal({
  open,
  onOpenChange,
  tableNumber,
  onConfirm,
  tables,
}: EditTableModalProps) {
  const useConfiguredList = tables !== undefined;
  const configuredTables = (tables ?? [])
    .map((row) => ({
      id: row.id,
      tableNumber: row.tableNumber.trim(),
    }))
    .filter((row) => row.tableNumber.length > 0);

  const [selectedNumber, setSelectedNumber] = useState(tableNumber);

  useEffect(() => {
    if (!open) return;
    setSelectedNumber(tableNumber);
  }, [open, tableNumber]);

  const handleConfirm = () => {
    const next = selectedNumber.trim();
    if (!next) return;
    if (useConfiguredList && !configuredTables.some((t) => t.tableNumber === next)) {
      return;
    }
    onConfirm(next);
    onOpenChange(false);
  };

  const fallbackNumbers = Array.from({ length: 50 }, (_, i) => String(i + 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Select table</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {useConfiguredList ? (
            configuredTables.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                No tables are set up for this store yet. Ask staff for help.
              </p>
            ) : (
              <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {configuredTables.map((table) => {
                  const selected = selectedNumber === table.tableNumber;
                  return (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => setSelectedNumber(table.tableNumber)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                        selected
                          ? "border-primary bg-primary/10 font-semibold text-primary"
                          : "border-border bg-background text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <span>Table {table.tableNumber}</span>
                      {selected ? (
                        <span className="text-xs font-medium text-primary">Selected</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <div className="relative h-48">
              <div className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-10 -translate-y-1/2 border-y border-blue-200 bg-blue-50" />
              <div className="relative z-10 h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
                <div className="py-20">
                  {fallbackNumbers.map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSelectedNumber(num)}
                      className={`flex h-10 w-full snap-center items-center justify-center text-lg font-medium transition-colors ${
                        selectedNumber === num
                          ? "font-semibold text-blue-600"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1 bg-transparent"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleConfirm}
            disabled={
              useConfiguredList
                ? !configuredTables.some((t) => t.tableNumber === selectedNumber.trim())
                : !selectedNumber.trim()
            }
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
