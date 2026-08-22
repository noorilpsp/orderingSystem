/**
 * Domain event emitter - a seam for realtime, webhooks, and analytics.
 * Currently a no-op. Wire Supabase Realtime, webhooks, or analytics later.
 */

export type DomainEvent =
  | {
      type: "session.closed";
      payload: { sessionId: string; closedAt?: string };
      correlationId?: string;
    }
  | {
      type: "wave.fired";
      payload: {
        sessionId: string;
        orderId: string;
        wave: number;
        firedAt: string;
        itemCount?: number;
        affectedItems?: string[];
      };
      correlationId?: string;
    }
  | {
      type: "wave.advanced";
      payload: {
        sessionId: string;
        orderId: string;
        wave: number;
        status: "preparing" | "ready" | "served";
        updatedItemIds: string[];
        failed?: Array<{ itemId: string; error: string }>;
      };
      correlationId?: string;
    }
  | {
      type: "order.items_added";
      payload: {
        sessionId: string;
        orderId: string;
        wave: number;
        addedItemIds: string[];
        itemCount?: number;
      };
      correlationId?: string;
    }
  | {
      type: "item.status_changed";
      payload: {
        itemId: string;
        orderId: string;
        sessionId?: string | null;
        status: "preparing" | "ready" | "served" | "voided" | "refired";
      };
      correlationId?: string;
    };

export interface Emitter {
  emit(event: DomainEvent): Promise<void> | void;
}

/** No-op implementation. Replace with realtime/webhook/analytics wiring later. */
export const emitter: Emitter = {
  emit: async () => {},
};

export function emit(event: DomainEvent): Promise<void> | void {
  return emitter.emit(event);
}
