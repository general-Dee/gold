"use client";

import { useState, useTransition } from "react";
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
import { Check, GripVertical, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Item = { id: string; text: string };

export function SortableTextList({
  id,
  items,
  onReorder,
  onEdit,
  onArchive,
  emptyMessage = "No items yet — add one below.",
}: {
  id: string;
  items: Item[];
  onReorder: (orderedIds: string[]) => void | Promise<void>;
  onEdit: (id: string, text: string) => void | Promise<void>;
  onArchive: (id: string) => void | Promise<void>;
  emptyMessage?: string;
}) {
  const [localItems, setLocalItems] = useState(items);
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setLocalItems(items);
  }
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id);
      const newIndex = prev.findIndex((i) => i.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      startTransition(() => {
        onReorder(next.map((i) => i.id));
      });
      return next;
    });
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={localItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {localItems.map((item) => (
            <SortableRow
              key={item.id}
              item={item}
              onEdit={onEdit}
              onArchive={onArchive}
              startTransition={startTransition}
            />
          ))}
          {localItems.length === 0 && (
            <li className="text-sm text-muted-foreground">{emptyMessage}</li>
          )}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  item,
  onEdit,
  onArchive,
  startTransition,
}: {
  item: Item;
  onEdit: (id: string, text: string) => void | Promise<void>;
  onArchive: (id: string) => void | Promise<void>;
  startTransition: (callback: () => void) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function save() {
    const text = draft.trim();
    if (text.length === 0) return;
    setIsEditing(false);
    startTransition(() => {
      onEdit(item.id, text);
    });
  }

  function cancel() {
    setDraft(item.text);
    setIsEditing(false);
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>

      {isEditing ? (
        <>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancel();
            }}
            autoFocus
            className="flex-1"
          />
          <Button type="button" variant="ghost" size="icon-sm" onClick={save} aria-label="Save">
            <Check className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={cancel} aria-label="Cancel">
            <X className="size-4" />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1">{item.text}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsEditing(true)}
            aria-label="Edit"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              startTransition(() => {
                onArchive(item.id);
              })
            }
          >
            Archive
          </Button>
        </>
      )}
    </li>
  );
}
