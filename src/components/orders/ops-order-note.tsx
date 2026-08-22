import { Bike, MapPin, MessageSquare, Phone } from "lucide-react";
import { splitGuestDeliveryOrderNote } from "@/lib/public-menu/guest-delivery-address";
import { cn } from "@/lib/utils";

export type OpsOrderNoteParts = "all" | "address" | "instructions";

export function OpsOrderNote({
  note,
  instructionsLabel,
  deliverToLabel,
  className,
  parts = "all",
}: {
  note: string;
  instructionsLabel: string;
  deliverToLabel?: string;
  className?: string;
  parts?: OpsOrderNoteParts;
}) {
  const { place, contact, instructions } = splitGuestDeliveryOrderNote(note);
  const showAddress = parts !== "instructions" && Boolean(place || contact);
  const showInstructions = parts !== "address" && Boolean(instructions);
  if (!showAddress && !showInstructions) return null;

  return (
    <div className={className}>
      {showAddress ? (
        <>
          {deliverToLabel ? (
            <div className="flex items-center gap-1.5">
              <Bike className="h-3.5 w-3.5 shrink-0 text-white/55" />
              <span className="not-italic font-semibold text-foreground">{deliverToLabel}</span>
            </div>
          ) : null}
          {place ? (
            <div className={cn("flex items-start gap-1.5", deliverToLabel && "mt-1")}>
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/55" />
              <span className="whitespace-pre-wrap not-italic">{place}</span>
            </div>
          ) : null}
          {contact ? (
            <div className="mt-0.5 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 shrink-0 text-white/55" />
              <span className="whitespace-pre-wrap not-italic">{contact}</span>
            </div>
          ) : null}
        </>
      ) : null}
      {showInstructions ? (
        <div className={cn("flex items-start gap-1.5", showAddress && "mt-1")}>
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/55" />
          <span>
            {showAddress ? null : (
              <span className="not-italic text-white/55">{instructionsLabel} </span>
            )}
            <span className="whitespace-pre-wrap italic">{instructions}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
