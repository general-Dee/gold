import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { bootstrapTestDb } from "@/server/testUtils/testDb";

// revalidatePath requires Next's request-scoped internals, which don't exist
// in a bare vitest run — calling it unmocked throws immediately.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// The actions under test transitively import "@/server/db/client", which
// creates its sqlite client as a module-load side effect. A static top-level
// import would run before bootstrapTestDb() sets DATABASE_URL, so they're
// imported dynamically inside beforeAll instead (see gamification.test.ts for
// the failure mode this avoids).
let db: Awaited<ReturnType<typeof bootstrapTestDb>>["db"];
let schema: Awaited<ReturnType<typeof bootstrapTestDb>>["schema"];
let createRuleAction: typeof import("@/server/actions/rules").createRuleAction;
let archiveRuleAction: typeof import("@/server/actions/rules").archiveRuleAction;
let updateRuleTextAction: typeof import("@/server/actions/rules").updateRuleTextAction;
let reorderRulesAction: typeof import("@/server/actions/rules").reorderRulesAction;
let createSetupTagAction: typeof import("@/server/actions/rules").createSetupTagAction;
let archiveSetupTagAction: typeof import("@/server/actions/rules").archiveSetupTagAction;
let updateSetupTagDetailsAction: typeof import("@/server/actions/rules").updateSetupTagDetailsAction;
let createMoodTagAction: typeof import("@/server/actions/rules").createMoodTagAction;
let archiveMoodTagAction: typeof import("@/server/actions/rules").archiveMoodTagAction;
let createRule: typeof import("@/server/queries/rules").createRule;
let createSetupTag: typeof import("@/server/queries/rules").createSetupTag;
let createMoodTag: typeof import("@/server/queries/rules").createMoodTag;

beforeAll(async () => {
  ({ db, schema } = await bootstrapTestDb());
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
  } = await import("@/server/actions/rules"));
  ({ createRule, createSetupTag, createMoodTag } = await import("@/server/queries/rules"));
});

beforeEach(async () => {
  await db.delete(schema.tradeRuleChecks);
  await db.delete(schema.tradeSetupTags);
  await db.delete(schema.rules);
  await db.delete(schema.setupTags);
  await db.delete(schema.moodTags);
  vi.mocked(revalidatePath).mockClear();
});

function buildFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("createRuleAction", () => {
  it("creates a rule from FormData, revalidating /rules", async () => {
    await createRuleAction(buildFormData({ text: "Wait for session open" }));

    const rows = await db.select().from(schema.rules);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ text: "Wait for session open" });
    expect(revalidatePath).toHaveBeenCalledWith("/rules");
  });

  it("throws a ZodError for blank text and inserts nothing", async () => {
    await expect(createRuleAction(buildFormData({ text: "" }))).rejects.toThrow();

    const rows = await db.select().from(schema.rules);
    expect(rows).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("archiveRuleAction", () => {
  it("marks an existing rule inactive, revalidating /rules", async () => {
    const rule = await createRule("Risk sized at or below 1%");

    await archiveRuleAction(rule.id);

    const [row] = await db.select().from(schema.rules);
    expect(row.isActive).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith("/rules");
  });
});

describe("updateRuleTextAction", () => {
  it("updates text for an existing rule, revalidating /rules", async () => {
    const rule = await createRule("Old text");

    await updateRuleTextAction(rule.id, "New text");

    const [row] = await db.select().from(schema.rules);
    expect(row.text).toBe("New text");
    expect(revalidatePath).toHaveBeenCalledWith("/rules");
  });

  it("throws a ZodError for blank text without touching the row", async () => {
    const rule = await createRule("Keep me");

    await expect(updateRuleTextAction(rule.id, "")).rejects.toThrow();

    const [row] = await db.select().from(schema.rules);
    expect(row.text).toBe("Keep me");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("reorderRulesAction", () => {
  it("applies sortOrder in the given id order, revalidating /rules", async () => {
    const a = await createRule("A");
    const b = await createRule("B");
    const c = await createRule("C");

    await reorderRulesAction([c.id, a.id, b.id]);

    const rows = await db.select().from(schema.rules).orderBy(schema.rules.sortOrder);
    expect(rows.map((r) => r.id)).toEqual([c.id, a.id, b.id]);
    expect(revalidatePath).toHaveBeenCalledWith("/rules");
  });
});

describe("createSetupTagAction", () => {
  it("creates a setup tag from FormData, revalidating /rules", async () => {
    await createSetupTagAction(buildFormData({ name: "London breakout" }));

    const rows = await db.select().from(schema.setupTags);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "London breakout" });
    expect(revalidatePath).toHaveBeenCalledWith("/rules");
  });

  it("throws a ZodError for a blank name and inserts nothing", async () => {
    await expect(createSetupTagAction(buildFormData({ name: "" }))).rejects.toThrow();

    const rows = await db.select().from(schema.setupTags);
    expect(rows).toEqual([]);
  });
});

describe("archiveSetupTagAction", () => {
  it("marks an existing setup tag inactive, revalidating /rules", async () => {
    const tag = await createSetupTag("NY reversal");

    await archiveSetupTagAction(tag.id);

    const [row] = await db.select().from(schema.setupTags);
    expect(row.isActive).toBe(false);
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

    const [row] = await db.select().from(schema.setupTags);
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

    const [row] = await db.select().from(schema.setupTags);
    expect(row).toMatchObject({ notes: null, expectedR: null });
  });
});

describe("createMoodTagAction", () => {
  it("creates a mood tag with the given category, revalidating /rules", async () => {
    await createMoodTagAction(buildFormData({ name: "Confident", category: "before" }));

    const rows = await db.select().from(schema.moodTags);
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

    const rows = await db.select().from(schema.moodTags);
    expect(rows).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("archiveMoodTagAction", () => {
  it("marks an existing mood tag inactive, revalidating /rules", async () => {
    const tag = await createMoodTag("Calm", "both");

    await archiveMoodTagAction(tag.id);

    const [row] = await db.select().from(schema.moodTags);
    expect(row.isActive).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith("/rules");
  });
});
