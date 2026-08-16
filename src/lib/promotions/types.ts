import type { PromotionKind } from "@/lib/promotions/pricing";

export type { PromotionKind };

export type PromotionStatus = "active" | "paused";

export type PromotionItemDto = {
  itemId: string;
  name: string;
  catalogPrice: number;
  salePrice: number | null;
};

export type PromotionDto = {
  id: string;
  merchantId: string;
  locationId: string;
  name: string;
  kind: PromotionKind;
  status: PromotionStatus;
  startsOn: string | null;
  endsOn: string | null;
  startTime: string | null;
  endTime: string | null;
  activeDays: string[] | null;
  items: PromotionItemDto[];
  createdAt: string;
  updatedAt: string;
};

export type PromotionItemInput = {
  itemId: string;
  salePrice?: number | null;
};
