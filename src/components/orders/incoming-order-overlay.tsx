"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Clock3, Minus, Plus, Volume2, VolumeX } from "lucide-react";
import type { CatalogI18n } from "@/lib/catalog-i18n";
import { OpsCustomizationDisplayLines } from "@/components/shared/customization-display-lines";
import { useMerchantLocalization } from "@/lib/hooks/useMerchantLocalization";
import {
  opsItemsCountLabel,
  resolveOpsCatalogName,
  useStaffLocale,
} from "@/lib/ops-i18n";
import { groupOpsOrderItems } from "@/lib/orders/groupOpsOrderItems";
import { createIncomingOrderAlertSound } from "@/lib/orders/incoming-order-alert-sound";
import { cn } from "@/lib/utils";

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
    itemId?: string | null;
    i18n?: CatalogI18n | null;
    qty: number;
    price?: number;
    notes?: string | null;
    customizations?: Array<{
      groupName: string;
      optionName: string;
      optionPrice: number;
      quantity: number;
      groupI18n?: CatalogI18n | null;
      optionI18n?: CatalogI18n | null;
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
  const { formatMoney } = useMerchantLocalization();
  const { locale, t, dir } = useStaffLocale();
  const [now, setNow] = useState(() => Date.now());
  const [mode, setMode] = useState<"prompt" | "review">("prompt");
  const [etaMinutes, setEtaMinutes] = useState(() => clampEtaMinutes(defaultEtaMinutes));
  const busy = accepting;
  const trackingClass = locale === "en" ? "uppercase tracking-[0.16em]" : "";

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
  const money =
    order.total != null && Number.isFinite(order.total) ? formatMoney(order.total) : null;
  const items = groupOpsOrderItems(order.items ?? []);

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
          className={cn("text-[11px] font-bold text-amber-200/90", locale === "en" && "uppercase tracking-[0.22em]")}
        >
          {mode === "review" ? t("incoming.reviewOrder") : t("incoming.newOrder")}
        </p>
        <p className="mt-2 font-mono text-4xl font-black tracking-wide text-white md:text-5xl" dir="ltr">
          {order.label}
        </p>
        <p id="incoming-order-desc" className="mt-2 text-sm text-white/70">
          {order.sourceLabel}
          <span className="mx-1.5 text-white/30">·</span>
          {order.guestLabel}
          <span className="mx-1.5 text-white/30">·</span>
          {opsItemsCountLabel(t, order.itemCount)}
          {money ? (
            <>
              <span className="mx-1.5 text-white/30">·</span>
              <span dir="ltr">{money}</span>
            </>
          ) : null}
        </p>
        <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-amber-200/80">
          <Clock3 className="h-3.5 w-3.5" />
          {t("incoming.waiting", { elapsed })}
        </p>
        {extraWaiting > 0 ? (
          <p className="mt-3 text-xs font-semibold text-white/55">
            {t("incoming.moreWaiting", { count: extraWaiting })}
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
                <span
                  className={cn(
                    "text-[11px] font-bold text-slate-950/70",
                    locale === "en" && "uppercase tracking-[0.18em]",
                  )}
                >
                  {t("incoming.tapTo")}
                </span>
                <span className="text-2xl font-black tracking-wide md:text-3xl">
                  {accepting ? "…" : t("incoming.accept")}
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
              {t("incoming.tapToReview")}
            </button>
          </>
        ) : (
          <div className="mt-6 w-full rounded-2xl border border-white/15 bg-black/35 p-4 text-start shadow-xl backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setMode("prompt")}
                className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                <ArrowLeft className={cn("h-3.5 w-3.5", dir === "rtl" && "rotate-180")} />
                {t("common.back")}
              </button>
              <p className={cn("text-[11px] font-bold text-white/45", trackingClass)}>
                {t("common.items")}
              </p>
            </div>

            <ul className="max-h-[32vh] space-y-2 overflow-y-auto pe-1">
              {items.length > 0 ? (
                items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
                  >
                    <span className="w-8 shrink-0 font-mono text-sm font-semibold text-amber-200/90" dir="ltr">
                      {item.qty}×
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-white">
                        {resolveOpsCatalogName(locale, item.name, item.i18n)}
                      </span>
                      {item.customizations && item.customizations.length > 0 ? (
                        <OpsCustomizationDisplayLines
                          customizations={item.customizations}
                          textSizeClassName="text-xs"
                        />
                      ) : null}
                      {item.notes ? (
                        <p className="mt-1 text-xs">
                          <span className="text-white/55">{t("common.instructions")}</span>{" "}
                          <span className="italic text-amber-200/70">{item.notes}</span>
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold text-white/85" dir="ltr">
                      {typeof item.price === "number" && Number.isFinite(item.price)
                        ? formatMoney(item.price)
                        : "—"}
                    </span>
                  </li>
                ))
              ) : (
                <li className="rounded-xl border border-dashed border-white/15 px-3 py-4 text-center text-sm text-white/50">
                  {t("incoming.noItems")}
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
                <span className="not-italic text-white/55">{t("common.instructions")}</span>{" "}
                <span className="italic">{order.note}</span>
              </div>
            ) : null}

            {money ? (
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                <span className="text-white/60">{t("common.total")}</span>
                <span className="font-semibold text-white" dir="ltr">{money}</span>
              </div>
            ) : null}

            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
              <p className={cn("text-[11px] font-bold text-white/45", trackingClass)}>
                {t("incoming.prepTime")}
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={busy || etaMinutes <= ETA_MIN}
                  aria-label={t("incoming.decreaseEta")}
                  onClick={() => setEtaMinutes((prev) => clampEtaMinutes(prev - ETA_STEP))}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-white hover:bg-white/10 disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="text-center">
                  <p className="font-mono text-3xl font-black text-amber-200" dir="ltr">{etaMinutes}</p>
                  <p className="text-xs font-semibold text-white/55">{t("incoming.minutes")}</p>
                </div>
                <button
                  type="button"
                  disabled={busy || etaMinutes >= ETA_MAX}
                  aria-label={t("incoming.increaseEta")}
                  onClick={() => setEtaMinutes((prev) => clampEtaMinutes(prev + ETA_STEP))}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-white hover:bg-white/10 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-white/45">
                {t("incoming.guestEtaHint")}
              </p>
            </div>

            <div className="mt-4">
              <button
                type="button"
                disabled={busy}
                onClick={acceptWithEta}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-amber-300/60 bg-amber-500 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {accepting ? "…" : t("incoming.acceptEta", { minutes: etaMinutes })}
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
            {muted ? t("incoming.unmute") : t("incoming.mute")}
          </button>
          <button
            type="button"
            onClick={onSnooze}
            disabled={busy}
            className="inline-flex h-9 items-center rounded-full border border-white/15 bg-white/[0.06] px-3 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50"
          >
            {t("incoming.snooze")}
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
  const { t } = useStaffLocale();
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={onResume}
      className="incoming-order-overlay__badge fixed bottom-5 end-5 z-[70] inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/30"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inset-0 animate-ping rounded-full bg-slate-950/40" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-slate-950" />
      </span>
      {t("incoming.resume", { count })}
    </button>
  );
}
