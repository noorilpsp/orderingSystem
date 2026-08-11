"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Clock3, Minus, Plus, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createIncomingOrderAlertSound,
} from "@/lib/orders/incoming-order-alert-sound";
import { OpsCustomizationDisplayLines } from "@/components/shared/customization-display-lines";

export type IncomingOrderOverlayOrder = {
  id: string;
  label: string;
  sourceLabel: string;
  guestLabel: string;
  itemCount: number;
  createdAt: number;
  note?: string;
  total?: number;
  items?: Array<{
    id: string;
    name: string;
    qty: number;
    price?: number;
    notes?: string | null;
    customizations?: Array<{
      groupName: string;
      optionName: string;
      optionPrice: number;
      quantity: number;
    }>;
  }>;
};

type IncomingOrderOverlayProps = {
  order: IncomingOrderOverlayOrder;
  waitingCount: number;
  accepting: boolean;
  muted: boolean;
  /** Default quoted prep time shown on review (minutes). */
  defaultEtaMinutes: number;
  onAccept: (etaMinutes: number) => void;
  onMuteToggle: () => void;
  onSnooze: () => void;
};

const ETA_MIN = 5;
const ETA_MAX = 90;
const ETA_STEP = 5;

function clampEtaMinutes(value: number): number {
  const stepped = Math.round(value / ETA_STEP) * ETA_STEP;
  return Math.min(ETA_MAX, Math.max(ETA_MIN, stepped));
}

function formatElapsed(createdAt: number, now: number): string {
  const totalSec = Math.max(0, Math.floor((now - createdAt) / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatMoney(total: number | undefined): string | null {
  if (total == null || !Number.isFinite(total)) return null;
  return `€${total.toFixed(2)}`;
}

export function IncomingOrderOverlay({
  order,
  waitingCount,
  accepting,
  muted,
  defaultEtaMinutes,
  onAccept,
  onMuteToggle,
  onSnooze,
}: IncomingOrderOverlayProps) {
  const [now, setNow] = useState(() => Date.now());
  const [mode, setMode] = useState<"prompt" | "review">("prompt");
  const [etaMinutes, setEtaMinutes] = useState(() => clampEtaMinutes(defaultEtaMinutes));
  const busy = accepting;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setMode("prompt");
    setEtaMinutes(clampEtaMinutes(defaultEtaMinutes));
  }, [order.id, defaultEtaMinutes]);

  const elapsed = formatElapsed(order.createdAt, now);
  const extraWaiting = Math.max(0, waitingCount - 1);
  const money = formatMoney(order.total);
  const items = order.items ?? [];

  const acceptWithEta = () => {
    createIncomingOrderAlertSound().stop();
    onAccept(etaMinutes);
  };

  return (
    <div
      className="incoming-order-overlay fixed inset-0 z-[80] flex flex-col items-center justify-center px-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="incoming-order-title"
      aria-describedby="incoming-order-desc"
    >
      <div className="incoming-order-overlay__pulse pointer-events-none absolute inset-0" aria-hidden />
      <div className="absolute inset-0 bg-black/72 backdrop-blur-[2px]" aria-hidden />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <p
          id="incoming-order-title"
          className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200/90"
        >
          {mode === "review" ? "Review order" : "New order"}
        </p>
        <p className="mt-2 font-mono text-4xl font-black tracking-wide text-white md:text-5xl">
          {order.label}
        </p>
        <p id="incoming-order-desc" className="mt-2 text-sm text-white/70">
          {order.sourceLabel}
          <span className="mx-1.5 text-white/30">·</span>
          {order.guestLabel}
          <span className="mx-1.5 text-white/30">·</span>
          {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
          {money ? (
            <>
              <span className="mx-1.5 text-white/30">·</span>
              {money}
            </>
          ) : null}
        </p>
        <p className="mt-1.5 inline-flex items-center gap-1 font-mono text-xs text-amber-200/80">
          <Clock3 className="h-3.5 w-3.5" />
          waiting {elapsed}
        </p>
        {extraWaiting > 0 ? (
          <p className="mt-3 text-xs font-semibold text-white/55">
            +{extraWaiting} more waiting after this
          </p>
        ) : null}

        {mode === "prompt" ? (
          <>
            <div className="relative mt-10 flex h-44 w-44 items-center justify-center md:h-52 md:w-52">
              <span className="incoming-order-overlay__ring absolute inset-0 rounded-full" aria-hidden />
              <span
                className="incoming-order-overlay__ring incoming-order-overlay__ring--delay absolute inset-3 rounded-full"
                aria-hidden
              />
              <button
                type="button"
                disabled={busy}
                onClick={acceptWithEta}
                className={cn(
                  "incoming-order-overlay__accept relative z-10 flex h-36 w-36 flex-col items-center justify-center rounded-full border-2 border-amber-300/70 bg-amber-500 text-slate-950 shadow-[0_0_40px_rgba(245,158,11,0.45)] transition-transform md:h-40 md:w-40",
                  "hover:scale-[1.03] active:scale-[0.98]",
                  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200/50",
                  busy && "opacity-70",
                )}
              >
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-950/70">
                  Tap to
                </span>
                <span className="text-2xl font-black tracking-wide md:text-3xl">
                  {accepting ? "…" : "Accept"}
                </span>
              </button>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                createIncomingOrderAlertSound().stop();
                setMode("review");
              }}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-full border border-white/20 bg-white/[0.08] px-5 text-sm font-semibold text-white hover:bg-white/12 disabled:opacity-50"
            >
              Tap to review
            </button>
          </>
        ) : (
          <div className="mt-6 w-full rounded-2xl border border-white/15 bg-black/35 p-4 text-left shadow-xl backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setMode("prompt")}
                className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">
                Items
              </p>
            </div>

            <ul className="max-h-[32vh] space-y-2 overflow-y-auto pr-1">
              {items.length > 0 ? (
                items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
                  >
                    <span className="w-8 shrink-0 font-mono text-sm font-semibold text-amber-200/90">
                      {item.qty}×
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-white">
                        {item.name}
                      </span>
                      {item.customizations && item.customizations.length > 0 ? (
                        <OpsCustomizationDisplayLines
                          customizations={item.customizations}
                          textSizeClassName="text-xs"
                        />
                      ) : null}
                      {item.notes ? (
                        <p className="mt-1 text-xs">
                          <span className="text-white/55">Instructions:</span>{" "}
                          <span className="italic text-amber-200/70">{item.notes}</span>
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold text-white/85">
                      {typeof item.price === "number" && Number.isFinite(item.price)
                        ? `€${item.price.toFixed(2)}`
                        : "—"}
                    </span>
                  </li>
                ))
              ) : (
                <li className="rounded-xl border border-dashed border-white/15 px-3 py-4 text-center text-sm text-white/50">
                  No item details available
                </li>
              )}
            </ul>

            {order.note ? (
              <div
                className={cn(
                  "mt-3 rounded-xl border px-3 py-2 text-xs",
                  /allergy|no nuts|no nut|allergic/i.test(order.note)
                    ? "border-amber-400/25 bg-amber-500/10 text-amber-100/90"
                    : "border-white/10 bg-white/[0.04] text-white/75",
                )}
              >
                <span className="not-italic text-white/55">Instructions:</span>{" "}
                <span className="italic">{order.note}</span>
              </div>
            ) : null}

            {money ? (
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                <span className="text-white/60">Total</span>
                <span className="font-semibold text-white">{money}</span>
              </div>
            ) : null}

            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">
                Prep time
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={busy || etaMinutes <= ETA_MIN}
                  aria-label="Decrease prep time"
                  onClick={() => setEtaMinutes((prev) => clampEtaMinutes(prev - ETA_STEP))}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-white hover:bg-white/10 disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="text-center">
                  <p className="font-mono text-3xl font-black text-amber-200">{etaMinutes}</p>
                  <p className="text-xs font-semibold text-white/55">minutes</p>
                </div>
                <button
                  type="button"
                  disabled={busy || etaMinutes >= ETA_MAX}
                  aria-label="Increase prep time"
                  onClick={() => setEtaMinutes((prev) => clampEtaMinutes(prev + ETA_STEP))}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-white hover:bg-white/10 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-white/45">
                Guest live ETA uses this time
              </p>
            </div>

            <div className="mt-4">
              <button
                type="button"
                disabled={busy}
                onClick={acceptWithEta}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-amber-300/60 bg-amber-500 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {accepting ? "…" : `Accept · ${etaMinutes}m`}
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center gap-2">
          <button
            type="button"
            onClick={onMuteToggle}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 text-xs font-semibold text-white/80 hover:bg-white/10"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            {muted ? "Unmute" : "Mute"}
          </button>
          <button
            type="button"
            onClick={onSnooze}
            disabled={busy}
            className="inline-flex h-9 items-center rounded-full border border-white/15 bg-white/[0.06] px-3 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50"
          >
            Snooze 30s
          </button>
        </div>
      </div>
    </div>
  );
}

type IncomingWaitingBadgeProps = {
  count: number;
  onResume: () => void;
};

export function IncomingWaitingBadge({ count, onResume }: IncomingWaitingBadgeProps) {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={onResume}
      className="incoming-order-overlay__badge fixed bottom-5 right-5 z-[70] inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/30"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inset-0 animate-ping rounded-full bg-slate-950/40" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-slate-950" />
      </span>
      {count} waiting — resume
    </button>
  );
}
