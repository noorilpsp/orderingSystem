"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import { buildTableQrMenuUrl } from "@/lib/public-menu/buildPublicMenuUrl";

type TableQrDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeSlug: string;
  tableNumber: string | number;
};

export function TableQrDialog({
  open,
  onOpenChange,
  storeSlug,
  tableNumber,
}: TableQrDialogProps) {
  const normalizedTableNumber = String(tableNumber).trim();
  const menuUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return buildTableQrMenuUrl(storeSlug, normalizedTableNumber);
    }
    return buildTableQrMenuUrl(storeSlug, normalizedTableNumber, window.location.origin);
  }, [normalizedTableNumber, storeSlug]);

  const qrImageUrl = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(menuUrl)}`;
  }, [menuUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      toast.success("Table menu URL copied");
    } catch {
      toast.error("Could not copy URL");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Table {normalizedTableNumber} QR code</DialogTitle>
          <DialogDescription>
            Guests scan this to open the menu with table {normalizedTableNumber} pre-selected for
            dine-in ordering.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
            <img
              src={qrImageUrl}
              alt={`QR code for table ${normalizedTableNumber}`}
              width={240}
              height={240}
              className="h-60 w-60"
            />
          </div>
          <p className="w-full break-all rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
            {menuUrl}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="flex-1" onClick={() => void handleCopy()}>
            <Copy className="mr-2 h-4 w-4" />
            Copy link
          </Button>
          <Button type="button" className="flex-1" asChild>
            <a href={menuUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open menu
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
