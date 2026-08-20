"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, Minus, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGuestLocale, useGuestT, type GuestLocale } from "@/lib/guest-i18n";
import { resolveCatalogText } from "@/lib/catalog-i18n";
import { OpsCustomizationDisplayLines } from "@/components/shared/customization-display-lines";
import { useGuestLocalization } from "@/lib/hooks/useGuestLocalization";
import type {
  GuestBillSplitItem,
  GuestBillSplitSeat,
} from "@/lib/public-menu/getGuestTableBillSplit";
import type {
  GuestSplitClaimRecord,
  GuestSplitClaimsMap,
  GuestSplitExtraPayer,
  GuestSplitProposalRecord,
} from "@/lib/db/schema/guest-table-splits";
import {
  EXTRA_PAYER_PREFIX,
  isExtraPayerId,
} from "@/lib/db/schema/guest-table-splits";
import { cn } from "@/lib/utils";
import { toUserFacingErrorMessage } from "@/lib/db/withDbRetry";

export type GuestSplitMode = "one-bill" | "by-seat" | "equal" | "item";

export type SplitBillData = {
  tableNumber: string;
  sessionId?: string;
  subtotal: number;
  itemCount: number;
  yourSeat?: GuestBillSplitSeat | null;
  seats: GuestBillSplitSeat[];
  unassigned: GuestBillSplitSeat | null;
  seatCountWithItems?: number;
  items?: GuestBillSplitItem[];
  proposal?: GuestSplitProposalRecord | null;
  extraPayers?: GuestSplitExtraPayer[];
};

type GuestBillSplitDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overlayClassName?: string;
  tableNumber: string;
  storeSlug: string;
  deviceId: string;
  splitLoading: boolean;
  splitError: string | null;
  splitData: SplitBillData | null;
  initialMode?: GuestSplitMode | null;
  onRefresh: (options?: { silent?: boolean }) => void;
  onToast?: (message: string, type?: "success" | "warning") => void;
};

/** Max people for Equal split and Item + Payer (large parties). */
const MAX_SPLIT_PEOPLE = 20;

type LocalPayer = GuestSplitExtraPayer;

type PayerTarget = {
  seatId: string;
  seatNumber: number | null;
  guestName?: string | null;
  isYours?: boolean;
  isLocal: boolean;
};

function sanitizeLineId(lineId: string): string {
  return lineId.replace(/\u0000/g, "\u001f");
}

function lineIdsEqual(a: string, b: string): boolean {
  return a === b || sanitizeLineId(a) === sanitizeLineId(b);
}

/** Client-safe claim normalizer (mirrors server normalizeClaimRecord). */
function sharesFromClaimRecord(
  lineId: string,
  raw: GuestSplitClaimRecord | null | undefined,
): Array<{ seatId: string; seatNumber: number | null; shares: number }> {
  if (!raw) return [];
  if (Array.isArray(raw.shares) && raw.shares.length > 0) {
    return raw.shares
      .filter((s) => s.seatId && (s.shares ?? 0) > 0)
      .map((s) => ({
        seatId: s.seatId,
        seatNumber: s.seatNumber ?? null,
        shares: Math.max(1, Math.floor(s.shares ?? 1)),
      }));
  }
  if (raw.seatId) {
    return [
      {
        seatId: raw.seatId,
        seatNumber: raw.seatNumber ?? null,
        shares: 1,
      },
    ];
  }
  void lineId;
  return [];
}

function lookupClaimRecord(
  claims: GuestSplitClaimsMap,
  lineId: string,
): GuestSplitClaimRecord | null | undefined {
  if (claims[lineId]) return claims[lineId];
  // Legacy line ids used NUL in customization fingerprints; server stores Unit Separator.
  const legacySafe = lineId.replace(/\u0000/g, "\u001f");
  if (legacySafe !== lineId && claims[legacySafe]) return claims[legacySafe];
  return claims[lineId];
}

function billLineDisplayName(locale: GuestLocale, line: GuestBillSplitItem): string {
  return resolveCatalogText(locale, { name: line.name }, line.i18n).name;
}

/** Collapsed one-line customizations with chevron to expand the full list. */
function BillLineCustomizations({
  customizations,
}: {
  customizations: GuestBillSplitItem["customizations"];
}) {
  const [expanded, setExpanded] = useState(false);
  if (!customizations?.length) return null;

  return (
    <div className="mt-0.5 flex items-start gap-0.5">
      <div className="min-w-0 flex-1">
        <OpsCustomizationDisplayLines
          customizations={customizations}
          surface="guest"
          compact={!expanded}
          textSizeClassName="text-[11px]"
        />
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? "Hide customizations" : "Show all customizations"}
        onClick={(event) => {
          event.stopPropagation();
          setExpanded((prev) => !prev);
        }}
        className="guest-bill-compact-btn mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            expanded && "rotate-180",
          )}
        />
      </button>
    </div>
  );
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export function GuestBillSplitDialog({
  open,
  onOpenChange,
  overlayClassName,
  tableNumber,
  storeSlug,
  deviceId,
  splitLoading,
  splitError,
  splitData,
  initialMode: _initialMode = null,
  onRefresh,
  onToast,
}: GuestBillSplitDialogProps) {
  const t = useGuestT();
  const { dir, locale } = useGuestLocale();
  const { formatMoney } = useGuestLocalization();
  const isRtl = dir === "rtl";
  const [splitMode, setSplitMode] = useState<GuestSplitMode>("item");
  const [splitCount, setSplitCount] = useState(2);
  const [localItems, setLocalItems] = useState<GuestBillSplitItem[]>([]);
  const [localPayers, setLocalPayers] = useState<LocalPayer[]>([]);
  const [expandedSplitLineId, setExpandedSplitLineId] = useState<string | null>(null);
  const [sendPending, setSendPending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const assignmentRollbackRef = useRef(new Map<string, GuestBillSplitItem>());
  const assignmentEpochRef = useRef(new Map<string, number>());
  const assignmentInFlightRef = useRef(new Set<string>());
  /** Optimistic + Payer ids not confirmed on server yet — keep across silent polls. */
  const pendingExtraPayerIdsRef = useRef(new Set<string>());
  /** In-flight + Payer create requests — claim waits on these so assign-after-add stays fast. */
  const pendingExtraPayerPostsRef = useRef(new Map<string, Promise<boolean>>());
  const splitCountSeededRef = useRef(false);
  const proposalEqualCountAppliedRef = useRef(false);
  const localItemsSeededRef = useRef(false);

  const equalSplitBase = splitData && splitData.subtotal > 0 ? splitData.subtotal : 0;
  const billLines = localItems;
  const assignableSeats = useMemo(
    () =>
      (splitData?.seats ?? []).filter(
        (seat): seat is GuestBillSplitSeat & { seatId: string } => Boolean(seat.seatId),
      ),
    [splitData?.seats],
  );
  const payerTargets = useMemo<PayerTarget[]>(
    () => [
      ...assignableSeats.map((seat) => ({
        seatId: seat.seatId,
        seatNumber: seat.seatNumber,
        guestName: seat.guestName,
        isYours: seat.isYours,
        isLocal: false,
      })),
      ...localPayers.map((payer) => ({
        seatId: payer.id,
        seatNumber: payer.seatNumber,
        guestName: null,
        isYours: false,
        isLocal: true,
      })),
    ],
    [assignableSeats, localPayers],
  );
  const yourSeat =
    splitData?.yourSeat ?? assignableSeats.find((seat) => seat.isYours) ?? null;
  const yourSeatNumber = yourSeat?.seatNumber ?? null;
  const yourSeatId = yourSeat?.seatId ?? null;

  const seatChipLabel = (seat: {
    seatNumber: number | null;
    guestName?: string | null;
    isYours?: boolean;
  }) => {
    const name = seat.guestName?.trim();
    const base = name
      ? name
      : seat.seatNumber != null
        ? t("actions.splitSeatChip", { number: seat.seatNumber })
        : t("actions.splitYourSeat");
    return seat.isYours ? `${base} · ${t("actions.splitYouTag")}` : base;
  };

  const perPerson = useMemo(() => {
    if (splitCount <= 0) return 0;
    return equalSplitBase / splitCount;
  }, [equalSplitBase, splitCount]);

  const claimTotalsBySeat = useMemo(() => {
    const totals = new Map<string, { seatNumber: number | null; amount: number }>();
    for (const line of billLines) {
      const shares = line.assignmentShares ?? [];
      if (shares.length === 0) continue;
      const totalShares = shares.reduce((sum, row) => sum + row.shares, 0);
      if (totalShares <= 0) continue;
      for (const row of shares) {
        const prev = totals.get(row.seatId) ?? {
          seatNumber: row.seatNumber,
          amount: 0,
        };
        prev.amount = money(prev.amount + line.price * (row.shares / totalShares));
        prev.seatNumber = row.seatNumber ?? prev.seatNumber;
        totals.set(row.seatId, prev);
      }
    }
    return [...totals.entries()].map(([seatId, value]) => ({
      seatId,
      seatNumber: value.seatNumber,
      amount: value.amount,
    }));
  }, [billLines]);

  const payerAmountById = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of claimTotalsBySeat) {
      map.set(row.seatId, row.amount);
    }
    return map;
  }, [claimTotalsBySeat]);

  const unclaimedLines = useMemo(
    () => billLines.filter((line) => (line.assignmentShares?.length ?? 0) === 0),
    [billLines],
  );
  const unclaimedTotal = useMemo(
    () => money(unclaimedLines.reduce((sum, line) => sum + line.price, 0)),
    [unclaimedLines],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    // Seed once per open; afterward merge remote payers/claims for cross-device sync
    // without clobbering lines that currently have an in-flight write.
    if (!open) return;
    if (!splitData) return;
    if (!localItemsSeededRef.current) {
      localItemsSeededRef.current = true;
      setLocalItems(splitData.items ?? []);
      setLocalPayers(splitData.extraPayers ?? []);
      return;
    }
    setLocalPayers((prev) => {
      const server = splitData.extraPayers ?? [];
      const pending = prev.filter((payer) =>
        pendingExtraPayerIdsRef.current.has(payer.id),
      );
      if (pending.length === 0) return server;
      const serverIds = new Set(server.map((payer) => payer.id));
      return [
        ...server,
        ...pending.filter((payer) => !serverIds.has(payer.id)),
      ];
    });
    const remoteItems = splitData.items ?? [];
    if (remoteItems.length === 0) return;
    setLocalItems((prev) => {
      const remoteById = new Map(remoteItems.map((line) => [line.id, line] as const));
      return prev.map((line) => {
        if (assignmentInFlightRef.current.has(line.id)) return line;
        const remote =
          remoteById.get(line.id) ?? remoteById.get(sanitizeLineId(line.id));
        if (!remote) return line;
        return {
          ...line,
          assignmentShares: remote.assignmentShares,
          isAssignmentSplit: remote.isAssignmentSplit,
          claimedBySeatId: remote.claimedBySeatId,
          claimedBySeatNumber: remote.claimedBySeatNumber,
          claimedByYou: remote.claimedByYou,
        };
      });
    });
  }, [open, splitData]);

  useEffect(() => {
    if (!open) {
      setSplitMode("item");
      setExpandedSplitLineId(null);
      setSendPending(false);
      setSendFeedback(null);
      setLocalPayers([]);
      setLocalItems([]);
      splitCountSeededRef.current = false;
      proposalEqualCountAppliedRef.current = false;
      localItemsSeededRef.current = false;
      assignmentRollbackRef.current.clear();
      assignmentEpochRef.current.clear();
      assignmentInFlightRef.current.clear();
      pendingExtraPayerIdsRef.current.clear();
      pendingExtraPayerPostsRef.current.clear();
      return;
    }
    setSplitMode("item");
  }, [open]);

  useEffect(() => {
    // Seed Equal people count once per open. Prefer the shared proposal's
    // equalCount when present so "Open split" matches what was sent.
    if (!open || !splitData) return;

    const proposalCount =
      splitData.proposal?.mode === "equal" &&
      typeof splitData.proposal.equalCount === "number" &&
      splitData.proposal.equalCount >= 2
        ? Math.min(MAX_SPLIT_PEOPLE, Math.floor(splitData.proposal.equalCount))
        : null;

    if (proposalCount != null && !proposalEqualCountAppliedRef.current) {
      proposalEqualCountAppliedRef.current = true;
      splitCountSeededRef.current = true;
      setSplitCount(proposalCount);
      return;
    }

    if (splitCountSeededRef.current) return;
    splitCountSeededRef.current = true;
    // Default to table seat count (not only seats that already ordered).
    const seatCount = Math.max(2, splitData.seats.length);
    setSplitCount(Math.min(MAX_SPLIT_PEOPLE, seatCount));
  }, [open, splitData]);

  const requestRefresh = (options?: { silent?: boolean }) => {
    // Explicit (non-silent) refresh re-seeds from server on next splitData.
    if (!options?.silent) {
      localItemsSeededRef.current = false;
      assignmentRollbackRef.current.clear();
      assignmentEpochRef.current.clear();
      assignmentInFlightRef.current.clear();
    }
    onRefresh(options);
  };

  const withAssignmentShares = (
    line: GuestBillSplitItem,
    shares: Array<{ seatId: string; seatNumber: number | null; shares: number }>,
  ): GuestBillSplitItem => {
    const sole = shares.length === 1 ? shares[0] : null;
    return {
      ...line,
      assignmentShares: shares,
      isAssignmentSplit: shares.length > 1,
      claimedBySeatId: sole?.seatId ?? null,
      claimedBySeatNumber: sole?.seatNumber ?? null,
      claimedByYou: yourSeatId
        ? shares.some((share) => share.seatId === yourSeatId)
        : false,
    };
  };

  const rollbackAssignment = (lineId: string) => {
    const previous = assignmentRollbackRef.current.get(lineId);
    if (previous) {
      setLocalItems((prev) =>
        prev.map((line) => (lineIdsEqual(line.id, lineId) ? previous : line)),
      );
    }
    assignmentRollbackRef.current.delete(lineId);
  };

  const postAssignments = (
    ops: Array<{
      lineId: string;
      body: Record<string, unknown>;
      optimisticShares: Array<{ seatId: string; seatNumber: number | null; shares: number }>;
    }>,
  ) => {
    if (!storeSlug || !tableNumber || !deviceId || ops.length === 0) return;

    const epochs = new Map<string, number>();
    for (const op of ops) {
      const epoch = (assignmentEpochRef.current.get(op.lineId) ?? 0) + 1;
      assignmentEpochRef.current.set(op.lineId, epoch);
      epochs.set(op.lineId, epoch);
      assignmentInFlightRef.current.add(op.lineId);
    }

    setLocalItems((prev) => {
      for (const op of ops) {
        if (!assignmentRollbackRef.current.has(op.lineId)) {
          const current = prev.find((line) => lineIdsEqual(line.id, op.lineId));
          if (current) assignmentRollbackRef.current.set(op.lineId, current);
        }
      }
      return prev.map((line) => {
        const op = ops.find((entry) => lineIdsEqual(line.id, entry.lineId));
        return op ? withAssignmentShares(line, op.optimisticShares) : line;
      });
    });

    void (async () => {
      const stillLatest = (lineId: string) =>
        assignmentEpochRef.current.get(lineId) === epochs.get(lineId);

      // If user assigned to a + Payer that was just added, wait for that create.
      const pendingPayerIds = new Set<string>();
      for (const op of ops) {
        for (const share of op.optimisticShares) {
          if (pendingExtraPayerPostsRef.current.has(share.seatId)) {
            pendingPayerIds.add(share.seatId);
          }
        }
        const bodySeatId =
          typeof op.body.seatId === "string" ? op.body.seatId : null;
        if (bodySeatId && pendingExtraPayerPostsRef.current.has(bodySeatId)) {
          pendingPayerIds.add(bodySeatId);
        }
        const bodyShares = op.body.shares;
        if (Array.isArray(bodyShares)) {
          for (const row of bodyShares) {
            const seatId =
              row && typeof row === "object" && "seatId" in row
                ? String((row as { seatId?: string }).seatId ?? "")
                : "";
            if (seatId && pendingExtraPayerPostsRef.current.has(seatId)) {
              pendingPayerIds.add(seatId);
            }
          }
        }
      }
      if (pendingPayerIds.size > 0) {
        const results = await Promise.all(
          [...pendingPayerIds].map((id) =>
            pendingExtraPayerPostsRef.current.get(id),
          ),
        );
        if (results.some((ok) => ok === false)) {
          for (const op of ops) {
            if (!stillLatest(op.lineId)) continue;
            rollbackAssignment(op.lineId);
            assignmentInFlightRef.current.delete(op.lineId);
          }
          onToast?.(t("actions.requestFailed"), "warning");
          return;
        }
      }

      try {
        const response = await fetch("/api/public/table-bill/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            ops.length === 1
              ? {
                  storeSlug,
                  tableNumber,
                  deviceId,
                  lineId: ops[0].lineId,
                  ...ops[0].body,
                }
              : {
                  storeSlug,
                  tableNumber,
                  deviceId,
                  assignments: ops.map((op) => ({
                    lineId: op.lineId,
                    ...op.body,
                  })),
                },
          ),
        });
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          data?: { claims?: GuestSplitClaimsMap };
          error?: { message?: string };
        } | null;
        if (!response.ok || payload?.ok === false) {
          let rolledBack = false;
          for (const op of ops) {
            if (!stillLatest(op.lineId)) continue;
            rollbackAssignment(op.lineId);
            assignmentInFlightRef.current.delete(op.lineId);
            rolledBack = true;
          }
          if (rolledBack) {
            onToast?.(
              toUserFacingErrorMessage(
                payload?.error?.message?.trim() || t("actions.requestFailed"),
                t("actions.requestFailed"),
              ),
              "warning",
            );
          }
          return;
        }
        const committedLineIds: string[] = [];
        for (const op of ops) {
          if (!stillLatest(op.lineId)) continue;
          assignmentRollbackRef.current.delete(op.lineId);
          assignmentInFlightRef.current.delete(op.lineId);
          committedLineIds.push(op.lineId);
        }
        if (committedLineIds.length > 0) {
          const claims = payload?.data?.claims;
          if (claims) {
            // Apply committed lines; cleared lines won't be in claims map.
            setLocalItems((prev) =>
              prev.map((line) => {
                if (!committedLineIds.some((id) => lineIdsEqual(line.id, id))) {
                  return line;
                }
                const claim = lookupClaimRecord(claims, line.id);
                if (!claim) {
                  return withAssignmentShares(line, []);
                }
                return withAssignmentShares(
                  line,
                  sharesFromClaimRecord(line.id, claim),
                );
              }),
            );
          }
        }
      } catch {
        let rolledBack = false;
        for (const op of ops) {
          if (!stillLatest(op.lineId)) continue;
          rollbackAssignment(op.lineId);
          assignmentInFlightRef.current.delete(op.lineId);
          rolledBack = true;
        }
        if (rolledBack) {
          onToast?.(t("actions.requestFailed"), "warning");
        }
      }
    })();
  };

  const sharesForSeatId = (seatId: string) => {
    const seat = payerTargets.find((entry) => entry.seatId === seatId);
    return [
      {
        seatId,
        seatNumber: seat?.seatNumber ?? null,
        shares: 1,
      },
    ];
  };

  const assignmentBodyForShares = (
    shares: Array<{ seatId: string; shares: number }>,
  ): {
    body: Record<string, unknown>;
    optimisticShares: Array<{ seatId: string; seatNumber: number | null; shares: number }>;
  } => {
    const optimisticShares = shares.map((row) => {
      const seat = payerTargets.find((entry) => entry.seatId === row.seatId);
      return {
        seatId: row.seatId,
        seatNumber: seat?.seatNumber ?? null,
        shares: row.shares,
      };
    });
    if (shares.length === 0) {
      return { body: { clear: true }, optimisticShares: [] };
    }
    if (shares.length === 1) {
      return { body: { seatId: shares[0].seatId }, optimisticShares };
    }
    return { body: { shares }, optimisticShares };
  };

  const postAssignment = (
    lineId: string,
    body: Record<string, unknown>,
    optimisticShares: Array<{ seatId: string; seatNumber: number | null; shares: number }>,
  ) => {
    postAssignments([{ lineId, body, optimisticShares }]);
  };

  const assignToSeat = (line: GuestBillSplitItem, seatId: string) => {
    const sole = line.assignmentShares?.length === 1 ? line.assignmentShares[0] : null;
    if (sole?.seatId === seatId && !line.isAssignmentSplit) {
      postAssignment(line.id, { clear: true }, []);
      return;
    }
    postAssignment(line.id, { seatId }, sharesForSeatId(seatId));
  };

  const clearLine = (line: GuestBillSplitItem) => {
    postAssignment(line.id, { clear: true }, []);
  };

  const saveSplitShares = (
    line: GuestBillSplitItem,
    shares: Array<{ seatId: string; shares: number }>,
  ) => {
    const { body, optimisticShares } = assignmentBodyForShares(shares);
    postAssignment(line.id, body, optimisticShares);
  };

  const toggleSplitSeat = (line: GuestBillSplitItem, seatId: string) => {
    const current = [...(line.assignmentShares ?? [])];
    const idx = current.findIndex((row) => row.seatId === seatId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      const seat = payerTargets.find((s) => s.seatId === seatId);
      current.push({
        seatId,
        seatNumber: seat?.seatNumber ?? null,
        shares: 1,
      });
    }
    saveSplitShares(
      line,
      current.map((row) => ({ seatId: row.seatId, shares: row.shares })),
    );
  };

  const changeSplitShare = (
    line: GuestBillSplitItem,
    seatId: string,
    delta: number,
  ) => {
    const current = (line.assignmentShares ?? []).map((row) =>
      row.seatId === seatId
        ? { ...row, shares: Math.max(1, row.shares + delta) }
        : row,
    );
    if (!current.some((row) => row.seatId === seatId)) return;
    saveSplitShares(
      line,
      current.map((row) => ({ seatId: row.seatId, shares: row.shares })),
    );
  };

  const addLocalPayer = () => {
    if (payerTargets.length >= MAX_SPLIT_PEOPLE) return;
    if (!storeSlug || !tableNumber || !deviceId) return;

    const optimistic: GuestSplitExtraPayer = {
      id: `${EXTRA_PAYER_PREFIX}${crypto.randomUUID()}`,
      seatNumber:
        Math.max(0, ...payerTargets.map((payer) => payer.seatNumber ?? 0)) + 1,
    };
    pendingExtraPayerIdsRef.current.add(optimistic.id);
    setLocalPayers((prev) => [...prev, optimistic]);

    const postPromise = (async (): Promise<boolean> => {
      try {
        const response = await fetch("/api/public/table-bill/payers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeSlug,
            tableNumber,
            deviceId,
            action: "add",
            payer: optimistic,
          }),
        });
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          data?: {
            extraPayers?: GuestSplitExtraPayer[];
            added?: GuestSplitExtraPayer;
          };
          error?: { message?: string };
        } | null;
        if (!response.ok || payload?.ok === false || !payload?.data?.extraPayers) {
          pendingExtraPayerIdsRef.current.delete(optimistic.id);
          setLocalPayers((prev) =>
            prev.filter((payer) => payer.id !== optimistic.id),
          );
          onToast?.(
            toUserFacingErrorMessage(
              payload?.error?.message?.trim() || t("actions.requestFailed"),
              t("actions.requestFailed"),
            ),
            "warning",
          );
          return false;
        }
        pendingExtraPayerIdsRef.current.delete(optimistic.id);
        setLocalPayers(payload.data.extraPayers);
        return true;
      } catch {
        pendingExtraPayerIdsRef.current.delete(optimistic.id);
        setLocalPayers((prev) =>
          prev.filter((payer) => payer.id !== optimistic.id),
        );
        onToast?.(t("actions.requestFailed"), "warning");
        return false;
      } finally {
        pendingExtraPayerPostsRef.current.delete(optimistic.id);
      }
    })();
    pendingExtraPayerPostsRef.current.set(optimistic.id, postPromise);
  };

  const removeLocalPayer = (payerId: string) => {
    if (!isExtraPayerId(payerId)) return;
    if (!storeSlug || !tableNumber || !deviceId) return;

    pendingExtraPayerIdsRef.current.delete(payerId);
    const previousPayers = localPayers;
    const previousItems = billLines;
    setLocalPayers((prev) => prev.filter((payer) => payer.id !== payerId));
    setLocalItems((prev) =>
      prev.map((line) => {
        const nextShares = (line.assignmentShares ?? []).filter(
          (row) => row.seatId !== payerId,
        );
        if (nextShares.length === (line.assignmentShares?.length ?? 0)) return line;
        return withAssignmentShares(line, nextShares);
      }),
    );

    void (async () => {
      try {
        const response = await fetch("/api/public/table-bill/payers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeSlug,
            tableNumber,
            deviceId,
            action: "remove",
            payerId,
          }),
        });
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          data?: {
            extraPayers?: GuestSplitExtraPayer[];
            claims?: GuestSplitClaimsMap;
          };
          error?: { message?: string };
        } | null;
        if (!response.ok || payload?.ok === false) {
          setLocalPayers(previousPayers);
          setLocalItems(previousItems);
          onToast?.(
            toUserFacingErrorMessage(
              payload?.error?.message?.trim() || t("actions.requestFailed"),
              t("actions.requestFailed"),
            ),
            "warning",
          );
          return;
        }
        if (payload?.data?.extraPayers) {
          setLocalPayers(payload.data.extraPayers);
        }
      } catch {
        setLocalPayers(previousPayers);
        setLocalItems(previousItems);
        onToast?.(t("actions.requestFailed"), "warning");
      }
    })();
  };

  const applyBySeatPreset = () => {
    const ops = billLines.flatMap((line) => {
      if (line.seatId) {
        return [
          {
            lineId: line.id,
            body: { seatId: line.seatId },
            optimisticShares: sharesForSeatId(line.seatId),
          },
        ];
      }
      if (assignableSeats.length === 0) return [];
      const shares = assignableSeats.map((seat) => ({
        seatId: seat.seatId,
        shares: 1,
      }));
      const { body, optimisticShares } = assignmentBodyForShares(shares);
      return [{ lineId: line.id, body, optimisticShares }];
    });
    postAssignments(ops);
  };

  const applyEqualPreset = () => {
    if (payerTargets.length === 0) return;
    const shares = payerTargets.map((seat) => ({ seatId: seat.seatId, shares: 1 }));
    const { body, optimisticShares } = assignmentBodyForShares(shares);
    postAssignments(
      billLines.map((line) => ({
        lineId: line.id,
        body,
        optimisticShares,
      })),
    );
  };

  const clearAllAssignments = () => {
    postAssignments(
      billLines.map((line) => ({
        lineId: line.id,
        body: { clear: true },
        optimisticShares: [],
      })),
    );
  };

  const buildProposalAmounts = (): Array<{
    seatId: string | null;
    seatNumber: number | null;
    amount: number;
  }> => {
    if (!splitData) return [];
    switch (splitMode) {
      case "one-bill":
        return splitData.seats.map((seat) => ({
          seatId: seat.seatId,
          seatNumber: seat.seatNumber,
          amount: money(splitData.subtotal),
        }));
      case "by-seat":
        return [
          ...splitData.seats.map((seat) => ({
            seatId: seat.seatId,
            seatNumber: seat.seatNumber,
            amount: money(seat.subtotal),
          })),
          ...(splitData.unassigned
            ? [
                {
                  seatId: null as string | null,
                  seatNumber: null as number | null,
                  amount: money(splitData.unassigned.subtotal),
                },
              ]
            : []),
        ];
      case "equal":
        return splitData.seats.map((seat) => ({
          seatId: seat.seatId,
          seatNumber: seat.seatNumber,
          amount: money(perPerson),
        }));
      case "item":
        return claimTotalsBySeat.map((row) => ({
          seatId: row.seatId,
          seatNumber: row.seatNumber,
          amount: row.amount,
        }));
      default: {
        const _exhaustive: never = splitMode;
        return _exhaustive;
      }
    }
  };

  const sendToTable = async () => {
    if (!storeSlug || !tableNumber || !deviceId || !splitData) {
      setSendFeedback(t("actions.requestFailed"));
      return;
    }
    if (splitMode === "item" && unclaimedLines.length > 0) {
      const message = t("actions.splitClaimAllFirst");
      setSendFeedback(message);
      onToast?.(message, "warning");
      return;
    }
    setSendFeedback(null);
    setSendPending(true);
    try {
      const response = await fetch("/api/public/table-bill/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeSlug,
          tableNumber,
          deviceId,
          mode: splitMode,
          equalCount: splitMode === "equal" ? splitCount : undefined,
          amounts: buildProposalAmounts(),
          unassignedAmount:
            splitMode === "item"
              ? unclaimedTotal
              : splitMode === "by-seat"
                ? splitData.unassigned?.subtotal
                : undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: { message?: string };
      } | null;
      if (!response.ok || payload?.ok === false) {
        const message = toUserFacingErrorMessage(
          payload?.error?.message?.trim() || t("actions.requestFailed"),
          t("actions.requestFailed"),
        );
        setSendFeedback(message);
        onToast?.(message, "warning");
        return;
      }
      onToast?.(t("actions.splitSentToTable"), "success");
      requestRefresh();
      onOpenChange(false);
    } catch {
      const message = t("actions.requestFailed");
      setSendFeedback(message);
      onToast?.(message, "warning");
    } finally {
      setSendPending(false);
    }
  };

  if (!open || !mounted) return null;

  return createPortal(
    <>
      <div
        className={cn("fixed inset-0 bg-black/50", overlayClassName, "z-[1000]")}
        aria-hidden
        onClick={() => onOpenChange(false)}
      />
      <div
        className="fixed inset-0 z-[1001] flex items-center justify-center p-3 animate-in fade-in-0 duration-200"
        onClick={() => onOpenChange(false)}
        role="presentation"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-bill-split-title"
          dir={dir}
          lang={locale}
          className="item-modal-surface liquid-glass relative flex max-h-[min(96dvh,920px)] w-full max-w-xl flex-col gap-4 overflow-hidden rounded-3xl border border-border/70 bg-card/90 p-5 text-start text-foreground shadow-2xl shadow-black/35 backdrop-blur-xl animate-in zoom-in-95 duration-200 md:max-w-2xl"
          style={{ direction: dir }}
          onClick={(event) => event.stopPropagation()}
        >
        <div className="flex shrink-0 items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-0 text-start">
            <h2
              id="guest-bill-split-title"
              className="text-lg font-semibold leading-none text-foreground"
            >
              {t("actions.splitBillTitle")}
            </h2>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 gap-1.5 border-border bg-background text-xs text-foreground hover:bg-muted"
            disabled={splitLoading}
            onClick={() => requestRefresh()}
          >
            {splitLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {t("actions.splitRefresh")}
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          {splitLoading && !splitData ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-3 text-sm text-foreground/80">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("actions.splitLoading")}
            </div>
          ) : null}

          {splitError && !splitData ? (
            <p className="rounded-xl border border-amber-500/45 bg-amber-500/15 px-3 py-2 text-sm font-medium text-amber-950 dark:text-amber-50">
              {splitError}
            </p>
          ) : null}

          {splitData ? (
            <div className="space-y-3">
              <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl border border-emerald-600/40 bg-emerald-500/15 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-emerald-900/85 dark:text-emerald-100/85">
                    {t("actions.splitTableTotal")}
                  </p>
                  <p className="truncate text-sm font-semibold text-emerald-950 dark:text-emerald-50">
                    {t("actions.tableForRequest", { number: splitData.tableNumber })}
                    {" · "}
                    {t("actions.splitItemCount", { count: splitData.itemCount })}
                  </p>
                  {yourSeat?.guestName?.trim() ? (
                    <p className="mt-0.5 text-xs font-medium text-foreground/75">
                      {t("actions.splitYouAreNamed", { name: yourSeat.guestName.trim() })}
                    </p>
                  ) : yourSeatNumber != null ? (
                    <p className="mt-0.5 text-xs font-medium text-foreground/75">
                      {t("actions.splitYouAreSeat", { number: yourSeatNumber })}
                    </p>
                  ) : yourSeat ? (
                    <p className="mt-0.5 text-xs font-medium text-foreground/75">
                      {t("actions.splitYourSeat")}
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 text-base font-bold tabular-nums text-emerald-950 dark:text-emerald-50" dir="ltr">
                  {formatMoney(splitData.subtotal)}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-foreground/65">{t("actions.splitAssignHint")}</p>

                <div className="rounded-xl border border-emerald-600/40 bg-emerald-500/15 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-100">
                    {t("actions.splitItemOwes")}
                  </div>
                  <div className="space-y-1.5">
                    {payerTargets.map((payer) => (
                      <div
                        key={payer.seatId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-emerald-600/25 bg-background/50 px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-sm font-semibold text-emerald-950 dark:text-emerald-50">
                            {seatChipLabel(payer)}
                          </span>
                          {payer.isLocal ? (
                            <button
                              type="button"
                              className="guest-bill-compact-btn inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-emerald-900/55 hover:text-emerald-950 dark:text-emerald-100/55 dark:hover:text-emerald-50"
                              onClick={() => removeLocalPayer(payer.seatId)}
                              aria-label={t("actions.splitRemovePayer", {
                                label: seatChipLabel(payer),
                              })}
                            >
                              <X className="size-3" strokeWidth={2.5} aria-hidden />
                            </button>
                          ) : null}
                        </div>
                        <span
                          className="shrink-0 text-lg font-bold tabular-nums text-emerald-950 dark:text-emerald-50"
                          dir="ltr"
                        >
                          {formatMoney(payerAmountById.get(payer.seatId) ?? 0)}
                        </span>
                      </div>
                    ))}
                    {payerTargets.length === 0 ? (
                      <p className="text-xs text-emerald-900/80 dark:text-emerald-100/80">
                        {t("actions.splitNoClaimsYet")}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="guest-bill-compact-btn flex w-full items-center justify-center rounded-lg border border-emerald-600/35 bg-background/50 px-3 py-2 text-sm font-semibold leading-none text-emerald-950 hover:bg-background disabled:opacity-50 dark:text-emerald-50"
                      onClick={addLocalPayer}
                      disabled={payerTargets.length >= MAX_SPLIT_PEOPLE}
                    >
                      {t("actions.splitAddPayer")}
                    </button>
                  </div>
                  {unclaimedLines.length > 0 ? (
                    <div className="mt-2 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
                      <span>{t("actions.splitUnclaimedItems")}</span>
                      <span className="font-semibold tabular-nums" dir="ltr">
                        {unclaimedLines.length} · {formatMoney(unclaimedTotal)}
                      </span>
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2" style={{ direction: dir }}>
                    <button
                      type="button"
                      className="guest-bill-compact-btn inline-flex items-center rounded-full border border-border bg-background/60 px-3 py-1.5 text-sm font-medium leading-none text-foreground hover:bg-background"
                      onClick={() => applyBySeatPreset()}
                    >
                      {t("actions.splitPresetBySeat")}
                    </button>
                    <button
                      type="button"
                      className="guest-bill-compact-btn inline-flex items-center rounded-full border border-border bg-background/60 px-3 py-1.5 text-sm font-medium leading-none text-foreground hover:bg-background"
                      onClick={() => applyEqualPreset()}
                    >
                      {t("actions.splitPresetEqual")}
                    </button>
                    <button
                      type="button"
                      className="guest-bill-compact-btn inline-flex items-center rounded-full border border-rose-400/40 bg-background/60 px-3 py-1.5 text-sm font-medium leading-none text-rose-700 hover:bg-rose-500/10 dark:text-rose-200"
                      onClick={() => clearAllAssignments()}
                    >
                      {t("actions.splitClearAssignments")}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {billLines.map((line) => {
                    const shares = line.assignmentShares ?? [];
                    const totalShares = shares.reduce((sum, row) => sum + row.shares, 0);
                    const sole = shares.length === 1 ? shares[0] : null;
                    const claimedByMe =
                      Boolean(sole && yourSeatId && sole.seatId === yourSeatId) &&
                      !line.isAssignmentSplit;
                    const splitOpen = expandedSplitLineId === line.id;
                    const claimedPayer = sole
                      ? payerTargets.find((payer) => payer.seatId === sole.seatId)
                      : null;
                    const claimedName = claimedPayer?.guestName?.trim();
                    const statusLabel = line.isAssignmentSplit
                      ? t("actions.splitItemShare")
                      : claimedByMe
                        ? t("actions.splitClaimedByYou")
                        : claimedName
                          ? t("actions.splitClaimedByName", { name: claimedName })
                          : sole
                            ? t("actions.splitClaimedBySeat", {
                                number: sole.seatNumber ?? "?",
                              })
                            : t("actions.splitItemUnassigned");

                    const seatButtons = [...payerTargets]
                      .sort((a, b) => Number(Boolean(b.isYours)) - Number(Boolean(a.isYours)))
                      .map((seat) => {
                      const active =
                        sole?.seatId === seat.seatId && !line.isAssignmentSplit;
                      return (
                        <button
                          key={seat.seatId}
                          type="button"
                          onClick={() => assignToSeat(line, seat.seatId)}
                          className={cn(
                            "guest-bill-compact-btn inline-flex max-w-40 items-center truncate rounded-md border px-2.5 py-1.5 text-xs font-semibold leading-none transition-colors",
                            active
                              ? "border-cyan-500/50 bg-cyan-500/20 text-foreground"
                              : "border-border text-foreground/65 hover:bg-muted",
                          )}
                        >
                          {seatChipLabel(seat)}
                        </button>
                      );
                    });
                    const splitButton = (
                      <button
                        key="split"
                        type="button"
                        onClick={() =>
                          setExpandedSplitLineId((prev) =>
                            prev === line.id ? null : line.id,
                          )
                        }
                        className={cn(
                          "guest-bill-compact-btn inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-semibold leading-none transition-colors",
                          line.isAssignmentSplit || splitOpen
                            ? "border-amber-500/50 bg-amber-500/20 text-foreground"
                            : "border-border text-foreground/65 hover:bg-muted",
                        )}
                      >
                        {t("actions.splitItemShare")}
                      </button>
                    );
                    const clearButton =
                      shares.length > 0 ? (
                        <button
                          key="clear"
                          type="button"
                          onClick={() => clearLine(line)}
                          className="guest-bill-compact-btn inline-flex items-center rounded-md border border-rose-400/40 px-2.5 py-1.5 text-xs font-semibold leading-none text-rose-700 hover:bg-rose-500/10 dark:text-rose-200"
                        >
                          {t("actions.splitClearAssignments")}
                        </button>
                      ) : null;
                    // RTL: Split on the right (first in DOM); seat chips flow right→left.
                    const actionChips = isRtl
                      ? [splitButton, ...seatButtons, clearButton]
                      : [...seatButtons, splitButton, clearButton];

                    return (
                      <div
                        key={line.id}
                        className="rounded-lg border border-border bg-muted/40 p-3"
                        style={{ direction: dir }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 text-start">
                            <p className="font-medium leading-snug text-foreground">
                              {line.quantity > 1 ? (
                                <span className="me-1.5 text-[13px] font-bold tabular-nums">
                                  ×{line.quantity}
                                </span>
                              ) : null}
                              {billLineDisplayName(locale, line)}
                            </p>
                            {(line.customizations?.length ?? 0) > 0 ? (
                              <BillLineCustomizations customizations={line.customizations} />
                            ) : null}
                            {line.notes ? (
                              <p className="mt-0.5 text-[11px] text-foreground/60">{line.notes}</p>
                            ) : null}
                            <p
                              className={cn(
                                "mt-0.5 text-xs font-semibold",
                                shares.length === 0
                                  ? "text-rose-600 dark:text-rose-300"
                                  : "text-foreground/70",
                              )}
                            >
                              {statusLabel}
                            </p>
                          </div>
                          <p
                            className="shrink-0 text-end text-sm font-semibold tabular-nums text-foreground"
                            dir="ltr"
                          >
                            {formatMoney(line.price)}
                          </p>
                        </div>

                        <div
                          className="mt-2 flex flex-wrap gap-1"
                          style={{ direction: dir }}
                        >
                          {actionChips}
                        </div>

                        {splitOpen ? (
                          <div className="mt-2 rounded-md border border-border bg-background/70 p-2.5">
                            <div className="mb-2 text-start text-[11px] font-semibold uppercase tracking-wide text-foreground/65">
                              {t("actions.splitItemShareHint")}
                            </div>
                            <div className="space-y-1.5">
                              {payerTargets.map((seat) => {
                                const row = shares.find((s) => s.seatId === seat.seatId);
                                const selected = Boolean(row);
                                const shareCount = row?.shares ?? 0;
                                const pct =
                                  totalShares > 0 && selected
                                    ? Math.round((shareCount / totalShares) * 100)
                                    : 0;
                                return (
                                  <div
                                    key={seat.seatId}
                                    className="flex items-center justify-between gap-2"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleSplitSeat(line, seat.seatId)}
                                      className={cn(
                                        "guest-bill-compact-btn inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-semibold leading-none transition-colors",
                                        selected
                                          ? "border-cyan-500/50 bg-cyan-500/20 text-foreground"
                                          : "border-border text-foreground/65 hover:bg-muted",
                                      )}
                                    >
                                      {seatChipLabel(seat)}
                                    </button>
                                    {selected ? (
                                      <div className="flex items-center gap-2" dir="ltr">
                                        <button
                                          type="button"
                                          className="guest-bill-stepper-btn inline-flex shrink-0 items-center justify-center border border-border bg-background text-foreground hover:bg-muted"
                                          onClick={() =>
                                            changeSplitShare(line, seat.seatId, -1)
                                          }
                                        >
                                          <Minus className="size-4" />
                                        </button>
                                        <span className="min-w-11 text-center text-xs font-semibold tabular-nums text-foreground">
                                          {shareCount} · {pct}%
                                        </span>
                                        <button
                                          type="button"
                                          className="guest-bill-stepper-btn inline-flex shrink-0 items-center justify-center border border-border bg-background text-foreground hover:bg-muted"
                                          onClick={() =>
                                            changeSplitShare(line, seat.seatId, 1)
                                          }
                                        >
                                          <Plus className="size-4" />
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-[11px] text-foreground/50">—</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {billLines.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-foreground/70">
                      {t("actions.splitEmpty")}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-border/70 pt-3">
          {sendFeedback ? (
            <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
              {sendFeedback}
            </p>
          ) : null}
          <div className="flex flex-row flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            className="border-border text-foreground"
            onClick={() => onOpenChange(false)}
          >
            {t("actions.splitDone")}
          </Button>
          {tableNumber && splitData ? (
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              disabled={sendPending || splitLoading}
              onClick={() => void sendToTable()}
            >
              {sendPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("common.sending")}
                </>
              ) : (
                t("actions.splitConfirmSplit")
              )}
            </Button>
          ) : null}
          </div>
        </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
