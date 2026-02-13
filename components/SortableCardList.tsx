'use client';

import { ReactNode, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';

interface SortableCardListProps {
  items: { id: string }[];
  onReorder: (reorderedIds: string[]) => void;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function SortableCardList({
  items,
  onReorder,
  children,
  className,
  style,
}: SortableCardListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(
        items.map((item) => item.id),
        oldIndex,
        newIndex
      );
      onReorder(reordered);
    },
    [items, onReorder]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={rectSortingStrategy}
      >
        <div className={className} style={style}>
          {children}
        </div>
      </SortableContext>
    </DndContext>
  );
}
