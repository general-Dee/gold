import {
  checklistCompletionsCollection,
  checklistItemsCollection,
  type ChecklistCompletion,
  type ChecklistItem,
} from "@/server/firebase/collections";
import { completionId, nanoid } from "@/server/firebase/ids";
import { runBatch } from "@/server/firebase/batch";
import { DEFAULT_CHECKLIST_ITEMS } from "@/lib/constants";
import { localDateKey, startOfLocalDay } from "@/lib/dates";

function isAlreadyExists(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === 6;
}

async function allChecklistItemsSortedByOrder(): Promise<ChecklistItem[]> {
  const snapshot = await checklistItemsCollection().orderBy("sortOrder", "asc").get();
  return snapshot.docs.map((doc) => doc.data());
}

export async function listActiveChecklistItems() {
  return (await allChecklistItemsSortedByOrder()).filter((item) => item.isActive);
}

export async function listAllChecklistItems() {
  return allChecklistItemsSortedByOrder();
}

export async function createChecklistItem(text: string): Promise<ChecklistItem> {
  const lastSnapshot = await checklistItemsCollection().orderBy("sortOrder", "desc").limit(1).get();
  const maxSort = lastSnapshot.empty ? -1 : lastSnapshot.docs[0]!.data().sortOrder;
  const now = new Date().toISOString();
  const row: ChecklistItem = {
    id: nanoid(),
    text,
    sortOrder: maxSort + 1,
    isActive: true,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await checklistItemsCollection().doc(row.id).set(row);
  return row;
}

export async function archiveChecklistItem(id: string) {
  await checklistItemsCollection()
    .doc(id)
    .update({ isActive: false, archivedAt: new Date().toISOString() });
}

export async function updateChecklistItemText(id: string, text: string) {
  await checklistItemsCollection().doc(id).update({ text });
}

export async function reorderChecklistItems(orderedIds: string[]) {
  await runBatch((batch) => {
    orderedIds.forEach((id, index) => {
      batch.update(checklistItemsCollection().doc(id), { sortOrder: index });
    });
  });
}

/** Seeds the default pre-market checklist items on first run only. */
export async function seedDefaultChecklistItemsIfEmpty() {
  const existing = await checklistItemsCollection().limit(1).get();
  if (existing.empty) {
    const now = new Date().toISOString();
    await runBatch((batch) => {
      DEFAULT_CHECKLIST_ITEMS.forEach((text, i) => {
        const row: ChecklistItem = {
          id: nanoid(),
          text,
          sortOrder: i,
          isActive: true,
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(checklistItemsCollection().doc(row.id), row);
      });
    });
  }
}

export async function getCompletionsForDate(date: string) {
  const snapshot = await checklistCompletionsCollection()
    .where("completionDate", "==", date)
    .get();
  return snapshot.docs.map((doc) => doc.data());
}

export async function addCompletion(itemId: string, date: string) {
  const ref = checklistCompletionsCollection().doc(completionId(itemId, date));
  const row: ChecklistCompletion = {
    id: ref.id,
    itemId,
    completionDate: date,
    completedAt: new Date().toISOString(),
  };
  try {
    await ref.create(row);
  } catch (err) {
    if (!isAlreadyExists(err)) throw err;
  }
}

export async function removeCompletion(itemId: string, date: string) {
  await checklistCompletionsCollection().doc(completionId(itemId, date)).delete();
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

  const [items, completionsSnapshot] = await Promise.all([
    listAllChecklistItems(),
    checklistCompletionsCollection().where("completionDate", ">=", sinceKey).get(),
  ]);
  const completions = completionsSnapshot.docs.map((doc) => doc.data());

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
