"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DragHandle } from "@/components/drag-and-drop/drag-handle";
import { cn } from "@/lib/utils";

type SortablePromotionsListProps<T extends { id: string }> = {
  promotions: T[];
  onReorder: (promotions: T[]) => void;
  renderPromotion: (promotion: T) => ReactNode;
};

function PromotionRowFrame({
  children,
  handle,
  isDragging,
  setNodeRef,
  style,
}: {
  children: ReactNode;
  handle: ReactNode;
  isDragging?: boolean;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
}) {
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border p-4",
        isDragging && "z-20 opacity-50 shadow-lg",
      )}
    >
      <div className="shrink-0">{handle}</div>
      {children}
    </div>
  );
}

function SortablePromotionRow({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <PromotionRowFrame
      setNodeRef={setNodeRef}
      isDragging={isDragging}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      handle={
        <div {...attributes} {...listeners}>
          <DragHandle isDragging={isDragging} />
        </div>
      }
    >
      {children}
    </PromotionRowFrame>
  );
}

export function SortablePromotionsList<T extends { id: string }>({
  promotions,
  onReorder,
  renderPromotion,
}: SortablePromotionsListProps<T>) {
  const [isMounted, setIsMounted] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = promotions.findIndex((promo) => promo.id === active.id);
    const newIndex = promotions.findIndex((promo) => promo.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(promotions, oldIndex, newIndex));
  };

  if (!isMounted) {
    return (
      <div className="space-y-3">
        {promotions.map((promo) => (
          <PromotionRowFrame key={promo.id} handle={<DragHandle disabled />}>
            {renderPromotion(promo)}
          </PromotionRowFrame>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={promotions.map((promo) => promo.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {promotions.map((promo) => (
            <SortablePromotionRow key={promo.id} id={promo.id}>
              {renderPromotion(promo)}
            </SortablePromotionRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
