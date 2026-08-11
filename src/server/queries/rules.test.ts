import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrapTestFirestore } from "@/server/testUtils/testFirestore";
import { DEFAULT_MOOD_TAGS, DEFAULT_RULES, DEFAULT_SETUP_TAGS } from "@/lib/constants";

// seedDefaultsIfEmpty transitively imports "@/server/firebase/client", which
// binds to the emulator project as a module-load side effect. A static
// top-level import would run before bootstrapTestFirestore() sets
// FIREBASE_PROJECT_ID, so it's imported dynamically inside beforeAll instead.
let wipe: Awaited<ReturnType<typeof bootstrapTestFirestore>>["wipe"];
let rulesCollection: typeof import("@/server/firebase/collections").rulesCollection;
let setupTagsCollection: typeof import("@/server/firebase/collections").setupTagsCollection;
let moodTagsCollection: typeof import("@/server/firebase/collections").moodTagsCollection;
let seedDefaultsIfEmpty: typeof import("@/server/queries/rules").seedDefaultsIfEmpty;
let createSetupTag: typeof import("@/server/queries/rules").createSetupTag;
let getSetupTagById: typeof import("@/server/queries/rules").getSetupTagById;
let updateSetupTagDetails: typeof import("@/server/queries/rules").updateSetupTagDetails;
let createMoodTag: typeof import("@/server/queries/rules").createMoodTag;
let getMoodTagById: typeof import("@/server/queries/rules").getMoodTagById;
let updateMoodTagDetails: typeof import("@/server/queries/rules").updateMoodTagDetails;

beforeAll(async () => {
  ({ wipe } = await bootstrapTestFirestore());
  ({ rulesCollection, setupTagsCollection, moodTagsCollection } = await import(
    "@/server/firebase/collections"
  ));
  ({
    seedDefaultsIfEmpty,
    createSetupTag,
    getSetupTagById,
    updateSetupTagDetails,
    createMoodTag,
    getMoodTagById,
    updateMoodTagDetails,
  } = await import("@/server/queries/rules"));
});

beforeEach(async () => {
  await wipe();
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

describe("seedDefaultsIfEmpty", () => {
  it("seeds default rules, setup tags, and mood tags when all three tables are empty", async () => {
    await seedDefaultsIfEmpty();

    expect(await allRuleRows()).toHaveLength(DEFAULT_RULES.length);
    expect(await allSetupTagRows()).toHaveLength(DEFAULT_SETUP_TAGS.length);
    expect(await allMoodTagRows()).toHaveLength(DEFAULT_MOOD_TAGS.length);
  });

  it("never overwrites existing rows in a table, even when the other two tables are empty", async () => {
    const now = new Date().toISOString();
    await rulesCollection()
      .doc("custom-rule")
      .set({
        id: "custom-rule",
        text: "My custom rule",
        sortOrder: 0,
        isActive: true,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      });

    await seedDefaultsIfEmpty();

    const rules = await allRuleRows();
    expect(rules).toHaveLength(1);
    expect(rules[0]!.text).toBe("My custom rule");

    // The other two tables were empty, so they still get seeded independently.
    expect(await allSetupTagRows()).toHaveLength(DEFAULT_SETUP_TAGS.length);
    expect(await allMoodTagRows()).toHaveLength(DEFAULT_MOOD_TAGS.length);
  });

  it("is a no-op on a second call once everything is seeded", async () => {
    await seedDefaultsIfEmpty();
    await seedDefaultsIfEmpty();

    expect(await allRuleRows()).toHaveLength(DEFAULT_RULES.length);
    expect(await allSetupTagRows()).toHaveLength(DEFAULT_SETUP_TAGS.length);
    expect(await allMoodTagRows()).toHaveLength(DEFAULT_MOOD_TAGS.length);
  });
});

describe("getSetupTagById", () => {
  it("returns the matching row", async () => {
    const tag = await createSetupTag("London breakout");
    const result = await getSetupTagById(tag.id);
    expect(result).toMatchObject({ id: tag.id, name: "London breakout" });
  });

  it("returns null when no row matches", async () => {
    expect(await getSetupTagById("nonexistent")).toBeNull();
  });
});

describe("updateSetupTagDetails", () => {
  it("updates notes and expectedR, leaving name and isActive untouched", async () => {
    const tag = await createSetupTag("NY reversal");

    await updateSetupTagDetails(tag.id, { notes: "Wait for liquidity sweep", expectedR: 2.5 });

    const result = await getSetupTagById(tag.id);
    expect(result).toMatchObject({
      name: "NY reversal",
      notes: "Wait for liquidity sweep",
      expectedR: 2.5,
      isActive: true,
    });
  });

  it("can clear notes/expectedR back to null", async () => {
    const tag = await createSetupTag("NY reversal");
    await updateSetupTagDetails(tag.id, { notes: "Some notes", expectedR: 2 });

    await updateSetupTagDetails(tag.id, { notes: null, expectedR: null });

    const result = await getSetupTagById(tag.id);
    expect(result).toMatchObject({ notes: null, expectedR: null });
  });
});

describe("getMoodTagById", () => {
  it("returns the matching row", async () => {
    const tag = await createMoodTag("Calm", "both");
    const result = await getMoodTagById(tag.id);
    expect(result).toMatchObject({ id: tag.id, name: "Calm" });
  });

  it("returns null when no row matches", async () => {
    expect(await getMoodTagById("nonexistent")).toBeNull();
  });
});

describe("updateMoodTagDetails", () => {
  it("updates notes and expectedR, leaving name and isActive untouched", async () => {
    const tag = await createMoodTag("Anxious", "before");

    await updateMoodTagDetails(tag.id, { notes: "Tends to overtrade", expectedR: -0.5 });

    const result = await getMoodTagById(tag.id);
    expect(result).toMatchObject({
      name: "Anxious",
      notes: "Tends to overtrade",
      expectedR: -0.5,
      isActive: true,
    });
  });

  it("can clear notes/expectedR back to null", async () => {
    const tag = await createMoodTag("Anxious", "before");
    await updateMoodTagDetails(tag.id, { notes: "Some notes", expectedR: -1 });

    await updateMoodTagDetails(tag.id, { notes: null, expectedR: null });

    const result = await getMoodTagById(tag.id);
    expect(result).toMatchObject({ notes: null, expectedR: null });
  });
});
