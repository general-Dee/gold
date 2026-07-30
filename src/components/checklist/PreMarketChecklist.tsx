"use client";

import { useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { toggleChecklistCompletionAction } from "@/server/actions/checklist";

export type ChecklistItem = { id: string; text: string };

export function PreMarketChecklist({
  items,
  date,
  completedItemIds,
}: {
  items: ChecklistItem[];
  date: string;
  completedItemIds: string[];
}) {
  const [checked, setChecked] = useState(() => new Set(completedItemIds));
  const [, startTransition] = useTransition();

  function toggle(itemId: string, next: boolean) {
    setChecked((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(itemId);
      else copy.delete(itemId);
      return copy;
    });
    startTransition(() => {
      toggleChecklistCompletionAction(itemId, date, next);
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No checklist items yet — add some below to build your pre-market routine.
      </p>
    );
  }

  const completed = items.filter((i) => checked.has(i.id)).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {completed} / {items.length} complete today
      </p>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
            <Checkbox
              id={`checklist-${item.id}`}
              checked={checked.has(item.id)}
              onCheckedChange={(v) => toggle(item.id, v === true)}
            />
            <label htmlFor={`checklist-${item.id}`} className="text-sm">
              {item.text}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
