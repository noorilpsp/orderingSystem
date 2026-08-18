"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gift, Loader2, Pencil, Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/lib/contexts/TenantContext";
import { useLocations } from "@/lib/hooks/useLocations";
import type { LoyaltyRewardDto, LoyaltyRewardKind } from "@/lib/loyalty/loyaltyRewards";
import { toast } from "sonner";

type MenuItemOption = { id: string; name: string; price: string };

type FormState = {
  name: string;
  description: string;
  kind: LoyaltyRewardKind;
  pointsCost: string;
  discountAmount: string;
  percentOff: string;
  maxDiscountAmount: string;
  menuItemId: string;
  status: "active" | "inactive";
};

const emptyForm = (): FormState => ({
  name: "",
  description: "",
  kind: "fixed_off",
  pointsCost: "50",
  discountAmount: "5",
  percentOff: "10",
  maxDiscountAmount: "8",
  menuItemId: "",
  status: "active",
});

function kindLabel(kind: LoyaltyRewardKind): string {
  switch (kind) {
    case "fixed_off":
      return "$ off";
    case "percent_off":
      return "% off";
    case "free_item":
      return "Free item";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function formatStoredAmount(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return amount.toFixed(2).replace(/\.00$/, "");
}

function summary(reward: LoyaltyRewardDto): string {
  switch (reward.kind) {
    case "fixed_off": {
      const amount = formatStoredAmount(reward.discountAmount);
      return amount ? `$${amount} off` : "Fixed $ off";
    }
    case "percent_off": {
      const percent =
        reward.percentOff != null && Number.isFinite(reward.percentOff)
          ? `${reward.percentOff}% off`
          : "% off";
      const max = formatStoredAmount(reward.maxDiscountAmount);
      return max ? `${percent} (max $${max})` : percent;
    }
    case "free_item":
      return reward.menuItemName ? `Free ${reward.menuItemName}` : "Free menu item";
    default: {
      const _exhaustive: never = reward.kind;
      return _exhaustive;
    }
  }
}

function storedNumberInput(value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return String(amount);
}

export function LoyaltyRewardsManager() {
  const { currentMerchantId, loading: tenantLoading } = useTenant();
  const { locations } = useLocations();
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState<LoyaltyRewardDto[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const locationIds = useMemo(
    () => locations.map((location) => location.id).filter(Boolean),
    [locations],
  );
  const locationId = locationIds[0] ?? null;

  const rewardsByPoints = useMemo(
    () =>
      [...rewards].sort((a, b) => {
        if (a.pointsCost !== b.pointsCost) return a.pointsCost - b.pointsCost;
        return a.name.localeCompare(b.name);
      }),
    [rewards],
  );

  const fetchRewards = useCallback(async () => {
    if (!currentMerchantId) {
      setRewards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `/api/loyalty/rewards?merchantId=${encodeURIComponent(currentMerchantId)}`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to load rewards");
      const payload = await response.json();
      setRewards(Array.isArray(payload.rewards) ? payload.rewards : []);
    } catch (error) {
      console.error("[LoyaltyRewardsManager]", error);
      toast.error("Could not load rewards");
    } finally {
      setLoading(false);
    }
  }, [currentMerchantId]);

  useEffect(() => {
    void fetchRewards();
  }, [fetchRewards]);

  useEffect(() => {
    if (locationIds.length === 0 || !dialogOpen) return;
    let cancelled = false;
    setItemsLoading(true);
    void (async () => {
      try {
        const responses = await Promise.all(
          locationIds.map((id) =>
            fetch(`/api/items?locationId=${encodeURIComponent(id)}`, {
              credentials: "include",
            }),
          ),
        );
        const lists = await Promise.all(
          responses.map(async (response) => {
            if (!response.ok) return [] as MenuItemOption[];
            const payload = await response.json();
            const list = (payload.data ?? payload.items ?? payload) as MenuItemOption[];
            return Array.isArray(list) ? list : [];
          }),
        );
        const byId = new Map<string, MenuItemOption>();
        for (const item of lists.flat()) {
          if (item?.id) byId.set(item.id, item);
        }
        if (!cancelled) {
          setMenuItems([...byId.values()].sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch {
        if (!cancelled) setMenuItems([]);
      } finally {
        if (!cancelled) setItemsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, locationIds]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (reward: LoyaltyRewardDto) => {
    setEditingId(reward.id);
    setForm({
      name: reward.name,
      description: reward.description ?? "",
      kind: reward.kind,
      pointsCost: String(reward.pointsCost),
      discountAmount: storedNumberInput(reward.discountAmount) || emptyForm().discountAmount,
      percentOff: storedNumberInput(reward.percentOff) || emptyForm().percentOff,
      maxDiscountAmount:
        storedNumberInput(reward.maxDiscountAmount) || emptyForm().maxDiscountAmount,
      menuItemId: reward.menuItemId ?? "",
      status: reward.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentMerchantId) return;
    setSaving(true);
    try {
      const body = {
        merchantId: currentMerchantId,
        name: form.name,
        description: form.description || null,
        kind: form.kind,
        pointsCost: Math.floor(Number(form.pointsCost)),
        status: form.status,
        discountAmount:
          form.kind === "fixed_off" ? Number(form.discountAmount) : null,
        percentOff: form.kind === "percent_off" ? Math.floor(Number(form.percentOff)) : null,
        maxDiscountAmount:
          form.kind === "percent_off" ? Number(form.maxDiscountAmount) : null,
        menuItemId: form.kind === "free_item" ? form.menuItemId || null : null,
      };

      const response = await fetch(
        editingId
          ? `/api/loyalty/rewards/${encodeURIComponent(editingId)}`
          : "/api/loyalty/rewards",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save reward");
      }
      toast.success(editingId ? "Reward updated" : "Reward created");
      setDialogOpen(false);
      await fetchRewards();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save reward");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (reward: LoyaltyRewardDto) => {
    if (!currentMerchantId) return;
    const nextStatus = reward.status === "active" ? "inactive" : "active";
    try {
      const response = await fetch(
        `/api/loyalty/rewards/${encodeURIComponent(reward.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            merchantId: currentMerchantId,
            status: nextStatus,
          }),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to update status");
      }
      await fetchRewards();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-orange-600" />
            <div>
              <CardTitle>Rewards catalog</CardTitle>
              <CardDescription>
                Fixed $ off, % off with a cap, or a free menu item. Guests redeem at checkout.
              </CardDescription>
            </div>
          </div>
          <Button size="sm" className="gap-2" onClick={openCreate} disabled={!currentMerchantId}>
            <Plus className="h-4 w-4" />
            Add reward
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {tenantLoading || loading ? (
          <Skeleton className="h-24 w-full" />
        ) : !currentMerchantId ? (
          <p className="text-sm text-muted-foreground">Select a merchant to manage rewards.</p>
        ) : rewards.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rewards yet. Create a fixed discount, percent off, or free item.
          </p>
        ) : (
          <div className="space-y-3">
            {rewardsByPoints.map((reward) => (
              <div
                key={reward.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{reward.name}</span>
                    <Badge variant="outline">{kindLabel(reward.kind)}</Badge>
                    <Badge variant={reward.status === "active" ? "default" : "secondary"}>
                      {reward.status}
                    </Badge>
                  </div>
                  {reward.description ? (
                    <p className="text-sm text-muted-foreground">{reward.description}</p>
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    {summary(reward)} · {reward.pointsCost.toLocaleString()} pts
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 pr-2">
                    <Switch
                      checked={reward.status === "active"}
                      onCheckedChange={() => void toggleStatus(reward)}
                      aria-label={`Toggle ${reward.name}`}
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openEdit(reward)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit reward" : "Create reward"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reward-name">Name</Label>
              <Input
                id="reward-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reward-description">Description</Label>
              <Textarea
                id="reward-description"
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.kind}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, kind: value as LoyaltyRewardKind }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed_off">Fixed $ off</SelectItem>
                    <SelectItem value="percent_off">Percent off (capped)</SelectItem>
                    <SelectItem value="free_item">Free menu item</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reward-points">Points cost</Label>
                <Input
                  id="reward-points"
                  type="number"
                  min={1}
                  value={form.pointsCost}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, pointsCost: event.target.value }))
                  }
                />
              </div>
            </div>

            {form.kind === "fixed_off" ? (
              <div className="space-y-2">
                <Label htmlFor="reward-fixed">Discount amount ($)</Label>
                <Input
                  id="reward-fixed"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={form.discountAmount}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, discountAmount: event.target.value }))
                  }
                />
              </div>
            ) : null}

            {form.kind === "percent_off" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="reward-percent">Percent off</Label>
                  <Input
                    id="reward-percent"
                    type="number"
                    min={1}
                    max={100}
                    value={form.percentOff}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, percentOff: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reward-max">Max discount ($)</Label>
                  <Input
                    id="reward-max"
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={form.maxDiscountAmount}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        maxDiscountAmount: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            ) : null}

            {form.kind === "free_item" ? (
              <div className="space-y-2">
                <Label>Menu item</Label>
                {itemsLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select
                    value={form.menuItemId}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, menuItemId: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an item" />
                    </SelectTrigger>
                    <SelectContent>
                      {menuItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {!locationId ? (
                  <p className="text-xs text-muted-foreground">
                    Add a store location to pick menu items.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save reward"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
