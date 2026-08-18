"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gift, Loader2, Pencil, Percent, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTenant } from "@/lib/contexts/TenantContext";
import { useLocation } from "@/lib/contexts/LocationContext";
import { useMerchantLocalization } from "@/lib/hooks/useMerchantLocalization";
import type {
  PromotionDto,
  PromotionItemInput,
  PromotionKind,
  PromotionStatus,
} from "@/lib/promotions/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SortablePromotionsList } from "@/components/promotions/sortable-promotions-list";

type MenuItemOption = { id: string; name: string; price: number; status: string };

type FormState = {
  name: string;
  kind: PromotionKind;
  status: PromotionStatus;
  selectedItemId: string;
  salePrice: string;
  useSchedule: boolean;
  startsOn: string;
  endsOn: string;
  startTime: string;
  endTime: string;
  activeDays: string[];
};

const WEEKDAYS = [
  { id: "monday", label: "Mon" },
  { id: "tuesday", label: "Tue" },
  { id: "wednesday", label: "Wed" },
  { id: "thursday", label: "Thu" },
  { id: "friday", label: "Fri" },
  { id: "saturday", label: "Sat" },
  { id: "sunday", label: "Sun" },
] as const;

const emptyForm = (): FormState => ({
  name: "",
  kind: "sale_price",
  status: "active",
  selectedItemId: "",
  salePrice: "",
  useSchedule: false,
  startsOn: "",
  endsOn: "",
  startTime: "17:00",
  endTime: "19:00",
  activeDays: WEEKDAYS.map((day) => day.id),
});

function kindLabel(kind: PromotionKind): string {
  switch (kind) {
    case "sale_price":
      return "Sale price";
    case "bogo":
      return "Buy 1 get 1";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function parsePromotionKind(value: string): PromotionKind | null {
  switch (value) {
    case "sale_price":
    case "bogo":
      return value;
    default:
      return null;
  }
}

function scheduleLabel(promo: PromotionDto): string {
  const bits: string[] = [];
  if (promo.startsOn || promo.endsOn) {
    bits.push(`${promo.startsOn ?? "…"} → ${promo.endsOn ?? "…"}`);
  }
  if (promo.startTime || promo.endTime) {
    bits.push(`${promo.startTime ?? "00:00"}–${promo.endTime ?? "23:59"}`);
  }
  if (promo.activeDays && promo.activeDays.length > 0) {
    bits.push(promo.activeDays.map((day) => day.slice(0, 3)).join(", "));
  }
  return bits.length > 0 ? bits.join(" · ") : "Always on";
}

export function PromotionsManager() {
  const { currentMerchantId, loading: tenantLoading } = useTenant();
  const { currentLocationId } = useLocation();
  const { formatMoney } = useMerchantLocalization();
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState<PromotionDto[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([]);
  const [itemSearch, setItemSearch] = useState("");

  const fetchPromotions = useCallback(async () => {
    if (!currentMerchantId || !currentLocationId) {
      setPromotions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `/api/promotions?merchantId=${encodeURIComponent(currentMerchantId)}&locationId=${encodeURIComponent(currentLocationId)}`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to load promotions");
      const payload = await response.json();
      setPromotions(Array.isArray(payload.promotions) ? payload.promotions : []);
    } catch (error) {
      console.error("[PromotionsManager]", error);
      toast.error("Could not load promotions");
    } finally {
      setLoading(false);
    }
  }, [currentMerchantId, currentLocationId]);

  const fetchItems = useCallback(async () => {
    if (!currentLocationId) {
      setMenuItems([]);
      return;
    }
    try {
      const response = await fetch(
        `/api/items?locationId=${encodeURIComponent(currentLocationId)}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!response.ok) return;
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: Array<{
          id: string;
          name: string;
          price: string | number;
          status?: string;
        }>;
      };
      const list = payload.ok && Array.isArray(payload.data) ? payload.data : [];
      setMenuItems(
        list
          .filter((item) => item.status === "live" || item.status === "soldout")
          .map((item) => ({
            id: item.id,
            name: item.name,
            price:
              typeof item.price === "string" ? parseFloat(item.price) : Number(item.price) || 0,
            status: item.status === "soldout" ? "soldout" : "live",
          })),
      );
    } catch (error) {
      console.error("[PromotionsManager] items", error);
    }
  }, [currentLocationId]);

  useEffect(() => {
    void fetchPromotions();
  }, [fetchPromotions]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const filteredItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    if (!query) return menuItems;
    return menuItems.filter((item) => item.name.toLowerCase().includes(query));
  }, [menuItems, itemSearch]);

  const suggestedSalePrice = (catalogPrice: number) =>
    Math.max(0, catalogPrice * 0.8).toFixed(2);

  const selectItem = (itemId: string) => {
    const item = menuItems.find((entry) => entry.id === itemId);
    setForm((prev) => {
      if (prev.selectedItemId === itemId) return prev;
      return {
        ...prev,
        selectedItemId: itemId,
        salePrice: item ? suggestedSalePrice(item.price) : "",
      };
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setItemSearch("");
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (promo: PromotionDto) => {
    const item = promo.items[0];
    setEditingId(promo.id);
    setForm({
      name: promo.name,
      kind: promo.kind,
      status: promo.status,
      selectedItemId: item?.itemId ?? "",
      salePrice: item?.salePrice != null ? String(item.salePrice) : "",
      useSchedule: Boolean(
        promo.startsOn ||
          promo.endsOn ||
          promo.startTime ||
          promo.endTime ||
          (promo.activeDays && promo.activeDays.length > 0),
      ),
      startsOn: promo.startsOn ?? "",
      endsOn: promo.endsOn ?? "",
      startTime: promo.startTime ?? "17:00",
      endTime: promo.endTime ?? "19:00",
      activeDays: promo.activeDays ?? WEEKDAYS.map((day) => day.id),
    });
    setItemSearch("");
    setFormError(null);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!currentMerchantId || !currentLocationId) return;
    if (!form.name.trim()) {
      setFormError("Give it a name");
      return;
    }
    if (!form.selectedItemId) {
      setFormError("Pick an item");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const body = {
        merchantId: currentMerchantId,
        locationId: currentLocationId,
        name: form.name,
        kind: form.kind,
        status: form.status,
        startsOn: form.useSchedule ? form.startsOn || null : null,
        endsOn: form.useSchedule ? form.endsOn || null : null,
        startTime: form.useSchedule ? form.startTime || null : null,
        endTime: form.useSchedule ? form.endTime || null : null,
        activeDays: form.useSchedule ? form.activeDays : null,
        items: [
          {
            itemId: form.selectedItemId,
            salePrice: form.kind === "sale_price" ? Number(form.salePrice) : null,
          },
        ] satisfies PromotionItemInput[],
      };
      const response = await fetch(
        editingId ? `/api/promotions/${editingId}` : "/api/promotions",
        {
          method: editingId ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Save failed");
      }
      setDialogOpen(false);
      await fetchPromotions();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save promotion");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (promo: PromotionDto, status: PromotionStatus) => {
    if (!currentMerchantId) return;
    try {
      const response = await fetch(`/api/promotions/${promo.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId: currentMerchantId, status }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Update failed");
      }
      await fetchPromotions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update status");
    }
  };

  const remove = async (promo: PromotionDto) => {
    if (!currentMerchantId) return;
    if (!window.confirm(`Delete “${promo.name}”?`)) return;
    try {
      const response = await fetch(
        `/api/promotions/${promo.id}?merchantId=${encodeURIComponent(currentMerchantId)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok) throw new Error("Delete failed");
      toast.success("Promotion deleted");
      await fetchPromotions();
    } catch {
      toast.error("Could not delete promotion");
    }
  };

  const reorder = async (reordered: PromotionDto[]) => {
    if (!currentMerchantId || !currentLocationId) return;
    const previous = promotions;
    const updated = reordered.map((promo, index) => ({
      ...promo,
      displayOrder: index,
    }));
    setPromotions(updated);
    try {
      const response = await fetch("/api/promotions/reorder", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantId: currentMerchantId,
          locationId: currentLocationId,
          promotions: updated.map((promo) => ({
            id: promo.id,
            displayOrder: promo.displayOrder,
          })),
        }),
      });
      if (!response.ok) throw new Error("Failed to reorder");
    } catch {
      setPromotions(previous);
      toast.error("Could not save promotion order");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-orange-600" />
            <div>
              <CardTitle>Item promotions</CardTitle>
              <CardDescription>
                One item per promotion. Drag to set the order guests see under Promotions on the menu.
              </CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            className="gap-2"
            onClick={openCreate}
            disabled={!currentMerchantId || !currentLocationId}
          >
            <Plus className="h-4 w-4" />
            New promotion
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {tenantLoading || loading ? (
          <Skeleton className="h-24 w-full" />
        ) : !currentMerchantId || !currentLocationId ? (
          <p className="text-sm text-muted-foreground">Select a location to manage promotions.</p>
        ) : promotions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No promotions yet. Create a sale or buy 1 get 1 for one item.
          </p>
        ) : (
          <SortablePromotionsList
            promotions={promotions}
            onReorder={(next) => void reorder(next)}
            renderPromotion={(promo) => (
              <>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{promo.name}</span>
                    <Badge variant="outline">{kindLabel(promo.kind)}</Badge>
                    <Badge variant={promo.status === "active" ? "default" : "secondary"}>
                      {promo.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {promo.items[0]?.name ?? "No item"}
                  </p>
                  <p className="text-xs text-muted-foreground">{scheduleLabel(promo)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={promo.status === "active"}
                    onCheckedChange={(checked) =>
                      void setStatus(promo, checked ? "active" : "paused")
                    }
                    aria-label={`Toggle ${promo.name}`}
                  />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(promo)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => void remove(promo)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          />
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit promotion" : "New promotion"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup
              value={form.kind}
              onValueChange={(value) => {
                const kind = parsePromotionKind(value);
                if (!kind) return;
                setForm((prev) => ({ ...prev, kind }));
              }}
              className="grid grid-cols-2 gap-2"
              aria-label="Promotion type"
            >
              <div>
                <RadioGroupItem
                  value="sale_price"
                  id="promo-kind-sale"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="promo-kind-sale"
                  className={cn(
                    "flex h-10 cursor-pointer justify-center rounded-md border text-sm font-medium",
                    form.kind === "sale_price"
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "bg-background hover:bg-accent",
                  )}
                >
                  Sale price
                </Label>
              </div>
              <div>
                <RadioGroupItem value="bogo" id="promo-kind-bogo" className="peer sr-only" />
                <Label
                  htmlFor="promo-kind-bogo"
                  className={cn(
                    "flex h-10 cursor-pointer justify-center gap-2 rounded-md border text-sm font-medium",
                    form.kind === "bogo"
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "bg-background hover:bg-accent",
                  )}
                >
                  <Gift className="h-4 w-4" />
                  Buy 1 get 1
                </Label>
              </div>
            </RadioGroup>
            <div className="space-y-2">
              <Label htmlFor="promo-name">Name</Label>
              <Input
                id="promo-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Happy hour drafts"
              />
            </div>
            <div className="space-y-2">
              <Label>Item</Label>
              <p className="text-xs text-muted-foreground">
                This deal and its hours apply to one item. Make another promotion for a second item.
              </p>
              <Input
                value={itemSearch}
                onChange={(event) => setItemSearch(event.target.value)}
                placeholder="Search items"
              />
              <RadioGroup
                value={form.selectedItemId || undefined}
                onValueChange={selectItem}
                className="max-h-56 gap-1 overflow-y-auto rounded-md border p-2"
                aria-label="Promotion item"
              >
                {filteredItems.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">No items found.</p>
                ) : (
                  filteredItems.map((item) => {
                    const itemRadioId = `promo-item-${item.id}`;
                    const selected = form.selectedItemId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-1 py-1.5 text-sm",
                          selected ? "bg-accent" : null,
                        )}
                      >
                        <RadioGroupItem value={item.id} id={itemRadioId} />
                        <Label
                          htmlFor={itemRadioId}
                          className="flex flex-1 cursor-pointer items-center gap-2 font-normal"
                        >
                          <span className="flex-1 truncate">
                            {item.name}
                            {item.status === "soldout" ? " (sold out)" : ""}
                          </span>
                          <span className="text-muted-foreground">
                            {formatMoney(item.price)}
                          </span>
                        </Label>
                      </div>
                    );
                  })
                )}
              </RadioGroup>
              {form.kind === "sale_price" && form.selectedItemId ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Sale</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-8 w-28"
                    value={form.salePrice}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, salePrice: event.target.value }))
                    }
                  />
                </div>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.useSchedule}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, useSchedule: checked === true }))
                }
              />
              Limit days and hours
            </label>
            {form.useSchedule ? (
              <div className="space-y-3 rounded-md border p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="starts-on">From</Label>
                    <Input
                      id="starts-on"
                      type="date"
                      value={form.startsOn}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, startsOn: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ends-on">Until</Label>
                    <Input
                      id="ends-on"
                      type="date"
                      value={form.endsOn}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, endsOn: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="start-time">Start</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={form.startTime}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, startTime: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="end-time">End</Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={form.endTime}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, endTime: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {WEEKDAYS.map((day) => {
                    const active = form.activeDays.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        className={cn(
                          "rounded-full border px-2 py-1 text-xs",
                          active
                            ? "border-foreground bg-foreground text-background"
                            : "text-muted-foreground",
                        )}
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            activeDays: active
                              ? prev.activeDays.filter((value) => value !== day.id)
                              : [...prev.activeDays, day.id],
                          }))
                        }
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingId ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
