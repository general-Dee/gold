import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { bootstrapTestFirestore } from "@/server/testUtils/testFirestore";

// revalidatePath requires Next's request-scoped internals, which don't exist
// in a bare vitest run — calling it unmocked throws immediately.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// The actions under test transitively import "@/server/firebase/client",
// which binds to the emulator project as a module-load side effect. A static
// top-level import would run before bootstrapTestFirestore() sets
// FIREBASE_PROJECT_ID, so they're imported dynamically inside beforeAll.
let wipe: Awaited<ReturnType<typeof bootstrapTestFirestore>>["wipe"];
let checklistItemsCollection: typeof import("@/server/firebase/collections").checklistItemsCollection;
let checklistCompletionsCollection: typeof import("@/server/firebase/collections").checklistCompletionsCollection;
let createChecklistItemAction: typeof import("@/server/actions/checklist").createChecklistItemAction;
let archiveChecklistItemAction: typeof import("@/server/actions/checklist").archiveChecklistItemAction;
let updateChecklistItemTextAction: typeof import("@/server/actions/checklist").updateChecklistItemTextAction;
let reorderChecklistItemsAction: typeof import("@/server/actions/checklist").reorderChecklistItemsAction;
let toggleChecklistCompletionAction: typeof import("@/server/actions/checklist").toggleChecklistCompletionAction;
let createChecklistItem: typeof import("@/server/queries/checklist").createChecklistItem;
let addCompletion: typeof import("@/server/queries/checklist").addCompletion;

beforeAll(async () => {
  ({ wipe } = await bootstrapTestFirestore());
  ({ checklistItemsCollection, checklistCompletionsCollection } = await import(
    "@/server/firebase/collections"
  ));
  ({
    createChecklistItemAction,
    archiveChecklistItemAction,
    updateChecklistItemTextAction,
    reorderChecklistItemsAction,
    toggleChecklistCompletionAction,
  } = await import("@/server/actions/checklist"));
  ({ createChecklistItem, addCompletion } = await import("@/server/queries/checklist"));
});

beforeEach(async () => {
  await wipe();
  vi.mocked(revalidatePath).mockClear();
});

async function allChecklistItemRows() {
  const snapshot = await checklistItemsCollection().get();
  return snapshot.docs.map((doc) => doc.data());
}

async function allCompletionRows() {
  const snapshot = await checklistCompletionsCollection().get();
  return snapshot.docs.map((doc) => doc.data());
}

function buildFormData(text: string) {
  const fd = new FormData();
  fd.set("text", text);
  return fd;
}

describe("createChecklistItemAction", () => {
  it("creates an item from FormData and revalidates /checklist only", async () => {
    await createChecklistItemAction(buildFormData("Check economic calendar"));

    const rows = await allChecklistItemRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ text: "Check economic calendar", isActive: true });
    expect(revalidatePath).toHaveBeenCalledWith("/checklist");
    expect(revalidatePath).not.toHaveBeenCalledWith("/");
  });

  it("throws a ZodError for blank text and inserts nothing", async () => {
    await expect(createChecklistItemAction(buildFormData(""))).rejects.toThrow();

    const rows = await allChecklistItemRows();
    expect(rows).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("archiveChecklistItemAction", () => {
  it("marks an existing item inactive with an archivedAt timestamp, revalidating /checklist", async () => {
    const item = await createChecklistItem("Wait for session open");

    await archiveChecklistItemAction(item.id);

    const [row] = await allChecklistItemRows();
    expect(row!.isActive).toBe(false);
    expect(row!.archivedAt).not.toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith("/checklist");
  });
});

describe("updateChecklistItemTextAction", () => {
  it("updates text for an existing item, revalidating /checklist", async () => {
    const item = await createChecklistItem("Old text");

    await updateChecklistItemTextAction(item.id, "New text");

    const [row] = await allChecklistItemRows();
    expect(row!.text).toBe("New text");
    expect(revalidatePath).toHaveBeenCalledWith("/checklist");
  });

  it("throws a ZodError for blank text without touching the row", async () => {
    const item = await createChecklistItem("Keep me");

    await expect(updateChecklistItemTextAction(item.id, "")).rejects.toThrow();

    const [row] = await allChecklistItemRows();
    expect(row!.text).toBe("Keep me");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("reorderChecklistItemsAction", () => {
  it("applies sortOrder in the given id order, revalidating /checklist", async () => {
    const a = await createChecklistItem("A");
    const b = await createChecklistItem("B");
    const c = await createChecklistItem("C");

    await reorderChecklistItemsAction([c.id, a.id, b.id]);

    const rows = (await allChecklistItemRows()).sort((x, y) => x.sortOrder - y.sortOrder);
    expect(rows.map((r) => r.id)).toEqual([c.id, a.id, b.id]);
    expect(revalidatePath).toHaveBeenCalledWith("/checklist");
  });
});

describe("toggleChecklistCompletionAction", () => {
  it("adds a completion when completed=true, revalidating /checklist and /", async () => {
    const item = await createChecklistItem("Journal the trade");

    await toggleChecklistCompletionAction(item.id, "2026-08-05", true);

    const rows = await allCompletionRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ itemId: item.id, completionDate: "2026-08-05" });
    expect(revalidatePath).toHaveBeenCalledWith("/checklist");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("removes a completion when completed=false", async () => {
    const item = await createChecklistItem("Journal the trade");
    await addCompletion(item.id, "2026-08-05");

    await toggleChecklistCompletionAction(item.id, "2026-08-05", false);

    const rows = await allCompletionRows();
    expect(rows).toEqual([]);
    expect(revalidatePath).toHaveBeenCalledWith("/checklist");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
});
