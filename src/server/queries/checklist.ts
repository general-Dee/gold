import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/server/db/client";
import { checklistCompletions, checklistItems } from "@/server/db/schema";
import { DEFAULT_CHECKLIST_ITEMS } from "@/lib/constants";
import { localDateKey, startOfLocalDay } from "@/lib/dates";

export async function listActiveChecklistItems() {
  return db
    .select()
    .from(checklistItems)
    .where(and(eq(checklistItems.isActive, true)))
    .orderBy(asc(checklistItems.sortOrder));
}

export async function listAllChecklistItems() {
  return db.select().from(checklistItems).orderBy(asc(checklistItems.sortOrder));
}

export async function createChecklistItem(text: string) {
  const existing = await db.select().from(checklistItems);
  const maxSort = existing.reduce((max, r) => Math.max(max, r.sortOrder), -1);
  const [row] = await db
    .insert(checklistItems)
    .values({ text, sortOrder: maxSort + 1 })
    .returning();
  return row;
}

export async function archiveChecklistItem(id: string) {
  await db
    .update(checklistItems)
    .set({ isActive: false, archivedAt: new Date().toISOString() })
    .where(eq(checklistItems.id, id));
}

export async function updateChecklistItemText(id: string, text: string) {
  await db.update(checklistItems).set({ text }).where(eq(checklistItems.id, id));
}

export async function reorderChecklistItems(orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(checklistItems).set({ sortOrder: index }).where(eq(checklistItems.id, id)),
    ),
  );
}

/** Seeds the default pre-market checklist items on first run only. */
export async function seedDefaultChecklistItemsIfEmpty() {
  const existing = await db.select().from(checklistItems).limit(1);
  if (existing.length === 0) {
    await db
      .insert(checklistItems)
      .values(DEFAULT_CHECKLIST_ITEMS.map((text, i) => ({ text, sortOrder: i })));
  }
}

export async function getCompletionsForDate(date: string) {
  return db
    .select()
    .from(checklistCompletions)
    .where(eq(checklistCompletions.completionDate, date));
}

export async function addCompletion(itemId: string, date: string) {
  await db
    .insert(checklistCompletions)
    .values({ itemId, completionDate: date })
    .onConflictDoNothing();
}

export async function removeCompletion(itemId: string, date: string) {
  await db
    .delete(checklistCompletions)
    .where(
      and(
        eq(checklistCompletions.itemId, itemId),
        eq(checklistCompletions.completionDate, date),
      ),
    );
}

export async function getChecklistStatusForDate(date: string) {
  const [items, completions] = await Promise.all([
    listActiveChecklistItems(),
    getCompletionsForDate(date),
  ]);
  const total = items.length;
  const completed = completions.length;
  return { total, completed, allDone: total > 0 && completed >= total };
}

export type ChecklistHistoryPoint = {
  date: string;
  completed: number;
  total: number;
  allDone: boolean;
};

/** Per-date completion counts for the last `days` days — feeds the history view and any
 * future correlation-with-journal-outcomes analytics. Every day in the window is present
 * (including zero-completion days), so this is safe to feed directly into streak logic. */
export async function getChecklistHistory(days = 30): Promise<ChecklistHistoryPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceKey = localDateKey(since);

  const [items, completions] = await Promise.all([
    listAllChecklistItems(),
    db
      .select()
      .from(checklistCompletions)
      .where(gte(checklistCompletions.completionDate, sinceKey)),
  ]);

  const totalActiveAtQueryTime = items.filter((i) => i.isActive).length;
  const byDate = new Map<string, number>();
  for (const c of completions) {
    byDate.set(c.completionDate, (byDate.get(c.completionDate) ?? 0) + 1);
  }

  const result: ChecklistHistoryPoint[] = [];
  const cursor = startOfLocalDay(since);
  const today = startOfLocalDay();
  while (cursor.getTime() <= today.getTime()) {
    const date = localDateKey(cursor);
    const completed = byDate.get(date) ?? 0;
    result.push({
      date,
      completed,
      total: totalActiveAtQueryTime,
      allDone: totalActiveAtQueryTime > 0 && completed >= totalActiveAtQueryTime,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

/** Streak = consecutive fully-completed days in chronological order; any day that isn't
 * fully done resets it to 0. Parallel to computeStreaks in gamification.ts — kept
 * separate and checklist-specific rather than coupling the two systems. */
export function computeChecklistStreaks(history: { allDone: boolean }[]) {
  let streak = 0;
  let longest = 0;
  const streakAtDay: number[] = [];
  for (const day of history) {
    streak = day.allDone ? streak + 1 : 0;
    longest = Math.max(longest, streak);
    streakAtDay.push(streak);
  }
  return { streakAtDay, currentStreak: streak, longestStreak: longest };
}

/** Bounded to the last `days` days — there is no unbounded "all-time" checklist history
 * query, so a streak that started before the window began will appear truncated. */
export async function getChecklistStreaks(days = 90) {
  return computeChecklistStreaks(await getChecklistHistory(days));
}
