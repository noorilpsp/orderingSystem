"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Download, ExternalLink, QrCode } from "lucide-react";
import {
  buildGuestMenuQrUrl,
  type GuestMenuQrVariant,
} from "@/lib/public-menu/buildPublicMenuUrl";
import { downloadQrPng, qrDownloadFilename, qrServerImageUrl } from "@/lib/public-menu/qrCode";

function qrCopyForVariant(
  variant: GuestMenuQrVariant,
  tableNumber: string,
): { title: string; description: string; filename: string } {
  switch (variant) {
    case "table":
      return {
        title: `Table ${tableNumber} QR code`,
        description: `Guests scan this to open the menu with table ${tableNumber} pre-selected for dine-in ordering.`,
        filename: qrDownloadFilename(`table-${tableNumber}`),
      };
    case "pickup":
      return {
        title: "Pickup QR code",
        description: "Guests scan this to open the menu in pickup mode.",
        filename: qrDownloadFilename("pickup"),
      };
    case "delivery":
      return {
        title: "Delivery QR code",
        description: "Guests scan this to open the menu in delivery mode.",
        filename: qrDownloadFilename("delivery"),
      };
    case "dine-in":
      return {
        title: "Dine-in QR code",
        description: "Guests scan this to open the menu in dine-in mode, then choose their table.",
        filename: qrDownloadFilename("dine-in"),
      };
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

type TableQrDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeSlug: string;
  variant?: GuestMenuQrVariant;
  tableNumber?: string | number;
};

export function TableQrDialog({
  open,
  onOpenChange,
  storeSlug,
  variant = "table",
  tableNumber,
}: TableQrDialogProps) {
  const normalizedTableNumber = String(tableNumber ?? "").trim();
  const copy = qrCopyForVariant(variant, normalizedTableNumber);
  const [downloading, setDownloading] = useState(false);

  const menuUrl = useMemo(() => {
    return buildGuestMenuQrUrl({
      storeSlug,
      variant,
      tableNumber: normalizedTableNumber,
    });
  }, [normalizedTableNumber, storeSlug, variant]);

  const qrImageUrl = useMemo(() => qrServerImageUrl(menuUrl, 240), [menuUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      toast.success("Menu URL copied");
    } catch {
      toast.error("Could not copy URL");
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadQrPng(menuUrl, copy.filename);
      toast.success("QR code downloaded");
    } catch {
      toast.error("Could not download QR code");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
            <img
              src={qrImageUrl}
              alt={copy.title}
              width={240}
              height={240}
              className="h-60 w-60"
            />
          </div>
          <p className="w-full break-all rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
            {menuUrl}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button type="button" variant="outline" className="flex-1" onClick={() => void handleCopy()}>
            <Copy className="mr-2 h-4 w-4" />
            Copy link
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={downloading}
            onClick={() => void handleDownload()}
          >
            <Download className="mr-2 h-4 w-4" />
            {downloading ? "Downloading…" : "Download"}
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

type StoreMenuQrButtonProps = {
  storeSlug: string;
  variant: GuestMenuQrVariant;
  tableNumber?: string | number;
  label?: string;
  iconOnly?: boolean;
};

export function StoreMenuQrButton({
  storeSlug,
  variant,
  tableNumber,
  label = "QR code",
  iconOnly = false,
}: StoreMenuQrButtonProps) {
  const [open, setOpen] = useState(false);
  const slug = storeSlug.trim();

  const handleOpen = () => {
    if (!slug) {
      toast.error("Set a store URL above before generating QR codes.");
      return;
    }
    setOpen(true);
  };

  return (
    <>
      {iconOnly ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={handleOpen}
          aria-label={label}
        >
          <QrCode className="h-4 w-4" />
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleOpen}>
          <QrCode className="h-4 w-4" />
          {label}
        </Button>
      )}
      {slug ? (
        <TableQrDialog
          open={open}
          onOpenChange={setOpen}
          storeSlug={slug}
          variant={variant}
          tableNumber={tableNumber}
        />
      ) : null}
    </>
  );
}
