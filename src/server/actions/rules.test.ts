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
let rulesCollection: typeof import("@/server/firebase/collections").rulesCollection;
let setupTagsCollection: typeof import("@/server/firebase/collections").setupTagsCollection;
let moodTagsCollection: typeof import("@/server/firebase/collections").moodTagsCollection;
let createRuleAction: typeof import("@/server/actions/rules").createRuleAction;
let archiveRuleAction: typeof import("@/server/actions/rules").archiveRuleAction;
let updateRuleTextAction: typeof import("@/server/actions/rules").updateRuleTextAction;
let reorderRulesAction: typeof import("@/server/actions/rules").reorderRulesAction;
let createSetupTagAction: typeof import("@/server/actions/rules").createSetupTagAction;
let archiveSetupTagAction: typeof import("@/server/actions/rules").archiveSetupTagAction;
let updateSetupTagDetailsAction: typeof import("@/server/actions/rules").updateSetupTagDetailsAction;
let createMoodTagAction: typeof import("@/server/actions/rules").createMoodTagAction;
let archiveMoodTagAction: typeof import("@/server/actions/rules").archiveMoodTagAction;
let updateMoodTagDetailsAction: typeof import("@/server/actions/rules").updateMoodTagDetailsAction;
let createRule: typeof import("@/server/queries/rules").createRule;
let createSetupTag: typeof import("@/server/queries/rules").createSetupTag;
let createMoodTag: typeof import("@/server/queries/rules").createMoodTag;

beforeAll(async () => {
  ({ wipe } = await bootstrapTestFirestore());
  ({ rulesCollection, setupTagsCollection, moodTagsCollection } = await import(
    "@/server/firebase/collections"
  ));
  ({
    createRuleAction,
    archiveRuleAction,
    updateRuleTextAction,
    reorderRulesAction,
    createSetupTagAction,
    archiveSetupTagAction,
    updateSetupTagDetailsAction,
    createMoodTagAction,
    archiveMoodTagAction,
    updateMoodTagDetailsAction,
  } = await import("@/server/actions/rules"));
  ({ createRule, createSetupTag, createMoodTag } = await import("@/server/queries/rules"));
});

beforeEach(async () => {
  await wipe();
  vi.mocked(revalidatePath).mockClear();
});

async function allRuleRows() {
  return (await rulesCollection().get()).docs.map((d) => d.data());
}
async function allSetupTagRows() {
  return (await setupTagsCollection().get()).docs.map((d) => d.data());
}
async function allMoodTagRows() {
  return (await moodTagsCollection().get()).docs.map((d) => d.data());
}

function buildFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("createRuleAction", () => {
  it("creates a rule from FormData, revalidating /rules", async () => {
    await createRuleAction(buildFormData({ text: "Wait for session open" }));

    const rows = await allRuleRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ text: "Wait for session open" });
    expect(revalidatePath).toHaveBeenCalledWith("/rules");
  });

  it("throws a ZodError for blank text and inserts nothing", async () => {
    await expect(createRuleAction(buildFormData({ text: "" }))).rejects.toThrow();

    const rows = await allRuleRows();
    expect(rows).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("archiveRuleAction", () => {
  it("marks an existing rule inactive, revalidating /rules", async () => {
    const rule = await createRule("Risk sized at or below 1%");

    await archiveRuleAction(rule.id);

    const [row] = await allRuleRows();
    expect(row!.isActive).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith("/rules");
  });
});

describe("updateRuleTextAction", () => {
  it("updates text for an existing rule, revalidating /rules", async () => {
    const rule = await createRule("Old text");

    await updateRuleTextAction(rule.id, "New text");

    const [row] = await allRuleRows();
    expect(row!.text).toBe("New text");
    expect(revalidatePath).toHaveBeenCalledWith("/rules");
  });

  it("throws a ZodError for blank text without touching the row", async () => {
    const rule = await createRule("Keep me");

    await expect(updateRuleTextAction(rule.id, "")).rejects.toThrow();

    const [row] = await allRuleRows();
    expect(row!.text).toBe("Keep me");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("reorderRulesAction", () => {
  it("applies sortOrder in the given id order, revalidating /rules", async () => {
    const a = await createRule("A");
    const b = await createRule("B");
    const c = await createRule("C");

    await reorderRulesAction([c.id, a.id, b.id]);

    const rows = (await allRuleRows()).sort((x, y) => x.sortOrder - y.sortOrder);
    expect(rows.map((r) => r.id)).toEqual([c.id, a.id, b.id]);
    expect(revalidatePath).toHaveBeenCalledWith("/rules");
  });
});

describe("createSetupTagAction", () => {
  it("creates a setup tag from FormData, revalidating /rules", async () => {
    await createSetupTagAction(buildFormData({ name: "London breakout" }));

    const rows = await allSetupTagRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "London breakout" });
    expect(revalidatePath).toHaveBeenCalledWith("/rules");
  });

  it("throws a ZodError for a blank name and inserts nothing", async () => {
    await expect(createSetupTagAction(buildFormData({ name: "" }))).rejects.toThrow();

    const rows = await allSetupTagRows();
    expect(rows).toEqual([]);
  });
});

describe("archiveSetupTagAction", () => {
  it("marks an existing setup tag inactive, revalidating /rules", async () => {
    const tag = await createSetupTag("NY reversal");

    await archiveSetupTagAction(tag.id);

    const [row] = await allSetupTagRows();
    expect(row!.isActive).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith("/rules");
  });
});

describe("updateSetupTagDetailsAction", () => {
  it("updates notes and expectedR, revalidating /rules and /setups/[id]", async () => {
    const tag = await createSetupTag("NY reversal");

    await updateSetupTagDetailsAction(
      tag.id,
      buildFormData({ notes: "Wait for sweep", expectedR: "2.5" }),
    );

    const [row] = await allSetupTagRows();
    expect(row).toMatchObject({ notes: "Wait for sweep", expectedR: 2.5 });
    expect(revalidatePath).toHaveBeenCalledWith("/rules");
    expect(revalidatePath).toHaveBeenCalledWith(`/setups/${tag.id}`);
  });

  it("treats empty-string fields as null", async () => {
    const tag = await createSetupTag("NY reversal");
    await updateSetupTagDetailsAction(
      tag.id,
      buildFormData({ notes: "Some notes", expectedR: "2" }),
    );

    await updateSetupTagDetailsAction(tag.id, buildFormData({ notes: "", expectedR: "" }));

    const [row] = await allSetupTagRows();
    expect(row).toMatchObject({ notes: null, expectedR: null });
  });
});

describe("createMoodTagAction", () => {
  it("creates a mood tag with the given category, revalidating /rules", async () => {
    await createMoodTagAction(buildFormData({ name: "Confident", category: "before" }));

    const rows = await allMoodTagRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Confident", category: "before" });
    expect(revalidatePath).toHaveBeenCalledWith("/rules");
  });

  // moodTagSchema's category field is `z.enum([...]).default("both")`, but
  // .default() only substitutes for `undefined` — and FormData.get() returns
  // `null`, not `undefined`, for a key that was never set. So a FormData that
  // omits "category" entirely does NOT fall back to "both"; it throws.
  // Verified directly against zod: moodTagSchema.parse({ name: "x", category:
  // null }) throws a ZodError. This test locks that boundary behavior down.
  it("throws when category is omitted from the FormData entirely", async () => {
    await expect(createMoodTagAction(buildFormData({ name: "Confident" }))).rejects.toThrow();

    const rows = await allMoodTagRows();
    expect(rows).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("archiveMoodTagAction", () => {
  it("marks an existing mood tag inactive, revalidating /rules", async () => {
    const tag = await createMoodTag("Calm", "both");

    await archiveMoodTagAction(tag.id);

    const [row] = await allMoodTagRows();
    expect(row!.isActive).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith("/rules");
  });
});

describe("updateMoodTagDetailsAction", () => {
  it("updates notes and expectedR, revalidating /rules and /moods/[id]", async () => {
    const tag = await createMoodTag("Anxious", "before");

    await updateMoodTagDetailsAction(
      tag.id,
      buildFormData({ notes: "Tends to overtrade", expectedR: "-0.5" }),
    );

    const [row] = await allMoodTagRows();
    expect(row).toMatchObject({ notes: "Tends to overtrade", expectedR: -0.5 });
    expect(revalidatePath).toHaveBeenCalledWith("/rules");
    expect(revalidatePath).toHaveBeenCalledWith(`/moods/${tag.id}`);
  });

  it("treats empty-string fields as null", async () => {
    const tag = await createMoodTag("Anxious", "before");
    await updateMoodTagDetailsAction(
      tag.id,
      buildFormData({ notes: "Some notes", expectedR: "2" }),
    );

    await updateMoodTagDetailsAction(tag.id, buildFormData({ notes: "", expectedR: "" }));

    const [row] = await allMoodTagRows();
    expect(row).toMatchObject({ notes: null, expectedR: null });
  });
});
