import type { OrdersUnifiedOrder } from "@/lib/orders/ordersView";

function dedupeItemsById(
  items: OrdersUnifiedOrder["items"],
): OrdersUnifiedOrder["items"] {
  const seen = new Set<string>();
  const next: OrdersUnifiedOrder["items"] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    next.push(item);
  }
  return next;
}

function memberIdOf(order: OrdersUnifiedOrder): string {
  return order.orderId ?? order.id.replace(/^order-/, "");
}

/** Normalize display codes like "T5" / "5" / "Table T5" → "T5" (never the word "Table"). */
export function extractTableCode(order: Pick<OrdersUnifiedOrder, "label" | "guestLabel">): string {
  const guest = order.guestLabel ?? "";
  // Prefer "Table T5" / "Table Patio" — do not capture the word "Table" itself.
  const afterTable = guest.match(/\bTable\s+(?!Table\b)(T?[\w-]+)/i)?.[1] ?? null;
  const bareCode = guest.match(/\b(T\d[\w-]*)\b/i)?.[1] ?? null;
  const raw = (afterTable ?? bareCode ?? order.label ?? "").trim();
  if (!raw || /^table$/i.test(raw)) return "?";
  const plainNumeric = raw.match(/^(?:T)?(\d+)$/i)?.[1];
  if (plainNumeric) return `T${plainNumeric}`;
  if (/^T[\w-]+$/i.test(raw)) return `T${raw.slice(1)}`;
  return raw;
}

/** e.g. "Table T5 · S2 · Maya" or "Table T5 · S1 · Alex, S2 · Sam". */
export function formatTableSeatGuestLabel(
  tableCode: string,
  items: Array<{ seatNumber?: number | null; seatGuestName?: string | null }>,
): string {
  const bySeat = new Map<number, string | null>();
  for (const item of items) {
    const n = item.seatNumber;
    if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) continue;
    const name = item.seatGuestName?.trim() || null;
    const existing = bySeat.get(n);
    if (!existing && name) bySeat.set(n, name);
    else if (!bySeat.has(n)) bySeat.set(n, null);
  }
  const seats = [...bySeat.entries()].sort((a, b) => a[0] - b[0]);
  const base = tableCode && tableCode !== "?" ? `Table ${tableCode}` : "Table";
  if (seats.length === 0) return base;
  const seatPart = seats
    .map(([n, name]) => (name ? `S${n} · ${name}` : `S${n}`))
    .join(", ");
  return `${base} · ${seatPart}`;
}

function tableOnlyGuestLabel(tableCode: string): string {
  return tableCode && tableCode !== "?" ? `Table ${tableCode}` : "Table";
}

/**
 * Roll served (or paid history) table placements into one board ticket per session.
 */
export function buildTableCheckOrder(
  members: OrdersUnifiedOrder[],
  opts?: { paid?: boolean },
): OrdersUnifiedOrder | null {
  if (members.length === 0) return null;
  const primary = members[0]!;
  const sessionId = primary.sessionId;
  if (!sessionId) return null;

  const paid = opts?.paid === true || members.every((m) => m.paymentState === "paid");
  const items = dedupeItemsById(members.flatMap((m) => m.items));
  const subtotal = members.reduce((sum, m) => sum + (m.subtotal ?? 0), 0);
  const taxAmount = members.reduce((sum, m) => sum + (m.taxAmount ?? 0), 0);
  const total = members.reduce((sum, m) => sum + (m.total || 0), 0);
  const itemCount = items.reduce((sum, item) => sum + (item.qty || 0), 0);
  const createdAt = Math.min(...members.map((m) => m.createdAt || Date.now()));
  const updatedAt = Math.max(...members.map((m) => m.updatedAt || 0));

  const tableCode = extractTableCode(primary);

  return {
    id: `check-${sessionId}`,
    source: "table",
    label: tableCode,
    sectionLabel: primary.sectionLabel,
    guestLabel: tableOnlyGuestLabel(tableCode),
    status: "served",
    createdAt,
    updatedAt,
    subtotal,
    taxAmount,
    total,
    itemCount,
    items,
    waves: [],
    tableId: primary.tableId,
    sessionId,
    memberOrderIds: [...new Set(members.map(memberIdOf).filter(Boolean))],
    note: members
      .map((m) => m.note)
      .filter(Boolean)
      .join(" · ") || undefined,
    paymentState: paid ? "paid" : "unpaid",
    paymentMethod: paid ? primary.paymentMethod ?? null : null,
    needsAccept: false,
  };
}

/** Live board: kitchen tickets stay separate; served+unpaid roll into one check per table session. */
export function mergeServedTableTicketsForBoard(
  orders: OrdersUnifiedOrder[],
): OrdersUnifiedOrder[] {
  const existingChecks = new Map<string, OrdersUnifiedOrder>();
  const servedBySession = new Map<string, OrdersUnifiedOrder[]>();
  const passthrough: OrdersUnifiedOrder[] = [];

  for (const order of orders) {
    if (order.id.startsWith("check-") && order.sessionId) {
      existingChecks.set(order.sessionId, order);
      continue;
    }
    if (
      order.source === "table" &&
      order.sessionId &&
      order.id.startsWith("order-") &&
      order.status === "served" &&
      order.paymentState !== "paid"
    ) {
      const list = servedBySession.get(order.sessionId) ?? [];
      list.push(order);
      servedBySession.set(order.sessionId, list);
      continue;
    }
    passthrough.push(order);
  }

  const result = [...passthrough];
  const sessionIds = new Set([
    ...existingChecks.keys(),
    ...servedBySession.keys(),
  ]);

  for (const sessionId of sessionIds) {
    const existing = existingChecks.get(sessionId);
    const extras = servedBySession.get(sessionId) ?? [];
    if (existing && extras.length === 0) {
      const tableCode = extractTableCode(existing);
      result.push({
        ...existing,
        label: tableCode !== "?" ? tableCode : existing.label,
        guestLabel: tableOnlyGuestLabel(
          tableCode !== "?" ? tableCode : existing.label,
        ),
        items: dedupeItemsById(existing.items),
      });
      continue;
    }
    if (existing) {
      const knownMembers = new Set(existing.memberOrderIds ?? []);
      // Skip tickets already represented on the server check (avoids duplicate item keys).
      const newExtras = extras.filter((m) => !knownMembers.has(memberIdOf(m)));
      if (newExtras.length === 0) {
        const tableCode = extractTableCode(existing);
        result.push({
          ...existing,
          label: tableCode !== "?" ? tableCode : existing.label,
          guestLabel: tableOnlyGuestLabel(
            tableCode !== "?" ? tableCode : existing.label,
          ),
          items: dedupeItemsById(existing.items),
        });
        continue;
      }
      const mergedItems = dedupeItemsById([
        ...existing.items,
        ...newExtras.flatMap((m) => m.items),
      ]);
      const extraIds = newExtras.map(memberIdOf).filter(Boolean);
      const memberOrderIds = [
        ...new Set([...(existing.memberOrderIds ?? []), ...extraIds]),
      ];
      const tableCode =
        [existing, ...newExtras]
          .map((row) => extractTableCode(row))
          .find((code) => code !== "?") ?? "?";
      result.push({
        ...existing,
        items: mergedItems,
        itemCount: mergedItems.reduce((sum, item) => sum + (item.qty || 0), 0),
        subtotal:
          (existing.subtotal ?? 0) +
          newExtras.reduce((sum, m) => sum + (m.subtotal ?? 0), 0),
        taxAmount:
          (existing.taxAmount ?? 0) +
          newExtras.reduce((sum, m) => sum + (m.taxAmount ?? 0), 0),
        total:
          existing.total + newExtras.reduce((sum, m) => sum + (m.total || 0), 0),
        memberOrderIds,
        label: tableCode,
        guestLabel: tableOnlyGuestLabel(tableCode),
        updatedAt: Math.max(
          existing.updatedAt,
          ...newExtras.map((m) => m.updatedAt || 0),
        ),
      });
      continue;
    }
    const check = buildTableCheckOrder(extras);
    if (check) result.push(check);
  }

  return result;
}
