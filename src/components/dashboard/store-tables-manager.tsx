"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LocationTable = {
  id: string;
  tableNumber: string;
  displayId: string | null;
  seats: number | null;
};

function unwrapTablesPayload(payload: unknown): LocationTable[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as { ok?: boolean; data?: unknown };
  const list = record.ok === true ? record.data : payload;
  if (!Array.isArray(list)) return [];
  return list
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const t = row as Record<string, unknown>;
      if (typeof t.id !== "string" || typeof t.tableNumber !== "string") return null;
      return {
        id: t.id,
        tableNumber: t.tableNumber,
        displayId: typeof t.displayId === "string" ? t.displayId : null,
        seats: typeof t.seats === "number" ? t.seats : null,
      };
    })
    .filter((row): row is LocationTable => row !== null)
    .sort((a, b) =>
      a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true, sensitivity: "base" }),
    );
}

function newIdempotencyKey(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type StoreTablesManagerProps = {
  locationId: string | null;
};

export function StoreTablesManager({ locationId }: StoreTablesManagerProps) {
  const [tables, setTables] = useState<LocationTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTables = useCallback(async () => {
    if (!locationId) {
      setTables([]);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tables?locationId=${encodeURIComponent(locationId)}`,
        { credentials: "include", cache: "no-store" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: { message?: string } }).error?.message ?? "Failed to load tables")
            : "Failed to load tables";
        throw new Error(message);
      }
      setTables(unwrapTablesPayload(payload));
    } catch (error) {
      console.error("[StoreTablesManager] load failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load tables");
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  const handleAdd = async () => {
    if (!locationId) {
      toast.error("Save the store first so a location exists");
      return;
    }
    const tableNumber = draftName.trim();
    if (!tableNumber) {
      toast.error("Enter a table name");
      return;
    }
    if (tables.some((t) => t.tableNumber.toLowerCase() === tableNumber.toLowerCase())) {
      toast.error("That table name already exists");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/tables", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": newIdempotencyKey("store-table-create"),
        },
        body: JSON.stringify({
          locationId,
          tableNumber,
          seats: 4,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: { message?: string } }).error?.message ?? "Failed to add table")
            : "Failed to add table";
        throw new Error(message);
      }
      setDraftName("");
      toast.success(`Table “${tableNumber}” added`);
      await loadTables();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add table");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (table: LocationTable) => {
    setDeletingId(table.id);
    try {
      const response = await fetch(`/api/tables/${encodeURIComponent(table.id)}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Idempotency-Key": newIdempotencyKey("store-table-delete"),
        },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: { message?: string } }).error?.message ?? "Failed to remove table")
            : "Failed to remove table";
        throw new Error(message);
      }
      toast.success(`Table “${table.tableNumber}” removed`);
      await loadTables();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove table");
    } finally {
      setDeletingId(null);
    }
  };

  if (!locationId) {
    return (
      <div className="rounded-md border border-dashed border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
        Save your store once to create a location, then you can add table names here.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
      <div>
        <Label className="text-sm font-medium">Tables</Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Add every table name guests can choose (e.g. T1, Patio 2). These power QR links and delivery-to-table orders.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          placeholder="Table name"
          maxLength={20}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleAdd();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleAdd()}
          disabled={saving || !draftName.trim()}
          className="gap-1.5 shrink-0"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading tables…
        </div>
      ) : tables.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">No tables yet. Add your first table name above.</p>
      ) : (
        <ul className="space-y-1.5">
          {tables.map((table) => (
            <li
              key={table.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background px-3 py-2"
            >
              <span className="text-sm font-medium truncate">{table.tableNumber}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => void handleDelete(table)}
                disabled={deletingId === table.id}
                aria-label={`Remove table ${table.tableNumber}`}
              >
                {deletingId === table.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
