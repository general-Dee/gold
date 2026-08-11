import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrapTestFirestore } from "@/server/testUtils/testFirestore";
import { DEFAULT_CHECKLIST_ITEMS } from "@/lib/constants";
import { localDateKey } from "@/lib/dates";

// Every function under test transitively imports "@/server/firebase/client",
// which binds to the emulator project as a module-load side effect. A static
// top-level import would run before bootstrapTestFirestore() sets
// FIREBASE_PROJECT_ID, so everything is imported dynamically inside
// beforeAll instead. DEFAULT_CHECKLIST_ITEMS/localDateKey have no db
// dependency, so they're safe to import statically above.
let wipe: Awaited<ReturnType<typeof bootstrapTestFirestore>>["wipe"];
let checklistItemsCollection: typeof import("@/server/firebase/collections").checklistItemsCollection;
let computeChecklistStreaks: typeof import("@/server/queries/checklist").computeChecklistStreaks;
let createChecklistItem: typeof import("@/server/queries/checklist").createChecklistItem;
let archiveChecklistItem: typeof import("@/server/queries/checklist").archiveChecklistItem;
let addCompletion: typeof import("@/server/queries/checklist").addCompletion;
let getCompletionsForDate: typeof import("@/server/queries/checklist").getCompletionsForDate;
let getChecklistStatusForDate: typeof import("@/server/queries/checklist").getChecklistStatusForDate;
let getChecklistHistory: typeof import("@/server/queries/checklist").getChecklistHistory;
let seedDefaultChecklistItemsIfEmpty: typeof import("@/server/queries/checklist").seedDefaultChecklistItemsIfEmpty;

beforeAll(async () => {
  ({ wipe } = await bootstrapTestFirestore());
  ({ checklistItemsCollection } = await import("@/server/firebase/collections"));
  ({
    computeChecklistStreaks,
    createChecklistItem,
    archiveChecklistItem,
    addCompletion,
    getCompletionsForDate,
    getChecklistStatusForDate,
    getChecklistHistory,
    seedDefaultChecklistItemsIfEmpty,
  } = await import("@/server/queries/checklist"));
});

beforeEach(async () => {
  await wipe();
});

async function allChecklistItemRows() {
  const snapshot = await checklistItemsCollection().get();
  return snapshot.docs.map((doc) => doc.data());
}

function daysAgoKey(n: number) {
  // Mirrors getChecklistHistory's own calendar-day subtraction (setDate, not a
  // fixed millisecond offset), so this can't drift from it across a DST change.
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateKey(d);
}

describe("computeChecklistStreaks", () => {
  it("returns zeros for an empty history", () => {
    expect(computeChecklistStreaks([])).toEqual({
      streakAtDay: [],
      currentStreak: 0,
      longestStreak: 0,
    });
  });

  it("counts an unbroken run of fully-completed days", () => {
    const history = [{ allDone: true }, { allDone: true }, { allDone: true }];
    expect(computeChecklistStreaks(history)).toEqual({
      streakAtDay: [1, 2, 3],
      currentStreak: 3,
      longestStreak: 3,
    });
  });

  it("resets the streak on an incomplete day", () => {
    const history = [{ allDone: true }, { allDone: false }, { allDone: true }];
    const result = computeChecklistStreaks(history);
    expect(result.streakAtDay).toEqual([1, 0, 1]);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });
});

describe("getChecklistStatusForDate", () => {
  it("is never done when there are zero active items", async () => {
    expect(await getChecklistStatusForDate(daysAgoKey(0))).toEqual({
      total: 0,
      completed: 0,
      allDone: false,
    });
  });

  it("is done once completions cover every active item", async () => {
    const a = await createChecklistItem("Check calendar");
    const b = await createChecklistItem("Check DXY");
    const today = daysAgoKey(0);

    expect(await getChecklistStatusForDate(today)).toEqual({ total: 2, completed: 0, allDone: false });

    await addCompletion(a.id, today);
    expect(await getChecklistStatusForDate(today)).toEqual({ total: 2, completed: 1, allDone: false });

    await addCompletion(b.id, today);
    expect(await getChecklistStatusForDate(today)).toEqual({ total: 2, completed: 2, allDone: true });
  });
});

describe("addCompletion", () => {
  it("is idempotent for the same item and date", async () => {
    const item = await createChecklistItem("Check calendar");
    const today = daysAgoKey(0);

    await addCompletion(item.id, today);
    await addCompletion(item.id, today);

    expect(await getCompletionsForDate(today)).toHaveLength(1);
  });
});

describe("getChecklistHistory", () => {
  it("includes every date in the window, including zero-completion days", async () => {
    await createChecklistItem("Check calendar");

    const history = await getChecklistHistory(3);

    expect(history).toHaveLength(4); // since..today inclusive
    expect(history.map((h) => h.date)).toEqual([
      daysAgoKey(3),
      daysAgoKey(2),
      daysAgoKey(1),
      daysAgoKey(0),
    ]);
    expect(history.every((h) => h.completed === 0 && h.total === 1 && !h.allDone)).toBe(true);
  });

  it("uses the currently-active item count for `total`, not the count active on that historical day", async () => {
    const a = await createChecklistItem("Check calendar");
    const b = await createChecklistItem("Check DXY");
    const twoDaysAgo = daysAgoKey(2);

    // Both items were active and completed two days ago.
    await addCompletion(a.id, twoDaysAgo);
    await addCompletion(b.id, twoDaysAgo);

    // Item b is archived after the fact — history is recomputed against
    // today's active-item count (1), not the 2 that were active back then.
    await archiveChecklistItem(b.id);

    const history = await getChecklistHistory(5);
    const day = history.find((h) => h.date === twoDaysAgo);

    expect(day).toMatchObject({ completed: 2, total: 1, allDone: true });
  });
});

describe("seedDefaultChecklistItemsIfEmpty", () => {
  it("seeds the default items only when the table is empty", async () => {
    await seedDefaultChecklistItemsIfEmpty();
    const afterFirstSeed = await allChecklistItemRows();
    expect(afterFirstSeed).toHaveLength(DEFAULT_CHECKLIST_ITEMS.length);

    await seedDefaultChecklistItemsIfEmpty();
    const afterSecondSeed = await allChecklistItemRows();
    expect(afterSecondSeed).toHaveLength(DEFAULT_CHECKLIST_ITEMS.length);
  });

  it("does not seed when an item already exists", async () => {
    await createChecklistItem("Custom item");
    await seedDefaultChecklistItemsIfEmpty();

    const items = await allChecklistItemRows();
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe("Custom item");
  });
});
