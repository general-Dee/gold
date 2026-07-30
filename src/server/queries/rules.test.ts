import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrapTestDb } from "@/server/testUtils/testDb";
import { DEFAULT_MOOD_TAGS, DEFAULT_RULES, DEFAULT_SETUP_TAGS } from "@/lib/constants";

// seedDefaultsIfEmpty transitively imports "@/server/db/client", which creates
// its sqlite client as a module-load side effect. A static top-level import
// would run before bootstrapTestDb() sets DATABASE_URL, so it's imported
// dynamically inside beforeAll instead (see gamification.test.ts for the
// failure mode this avoids).
let db: Awaited<ReturnType<typeof bootstrapTestDb>>["db"];
let schema: Awaited<ReturnType<typeof bootstrapTestDb>>["schema"];
let seedDefaultsIfEmpty: typeof import("@/server/queries/rules").seedDefaultsIfEmpty;

beforeAll(async () => {
  ({ db, schema } = await bootstrapTestDb());
  ({ seedDefaultsIfEmpty } = await import("@/server/queries/rules"));
});

beforeEach(async () => {
  await db.delete(schema.rules);
  await db.delete(schema.setupTags);
  await db.delete(schema.moodTags);
});

describe("seedDefaultsIfEmpty", () => {
  it("seeds default rules, setup tags, and mood tags when all three tables are empty", async () => {
    await seedDefaultsIfEmpty();

    expect(await db.select().from(schema.rules)).toHaveLength(DEFAULT_RULES.length);
    expect(await db.select().from(schema.setupTags)).toHaveLength(DEFAULT_SETUP_TAGS.length);
    expect(await db.select().from(schema.moodTags)).toHaveLength(DEFAULT_MOOD_TAGS.length);
  });

  it("never overwrites existing rows in a table, even when the other two tables are empty", async () => {
    await db.insert(schema.rules).values({ text: "My custom rule" });

    await seedDefaultsIfEmpty();

    const rules = await db.select().from(schema.rules);
    expect(rules).toHaveLength(1);
    expect(rules[0].text).toBe("My custom rule");

    // The other two tables were empty, so they still get seeded independently.
    expect(await db.select().from(schema.setupTags)).toHaveLength(DEFAULT_SETUP_TAGS.length);
    expect(await db.select().from(schema.moodTags)).toHaveLength(DEFAULT_MOOD_TAGS.length);
  });

  it("is a no-op on a second call once everything is seeded", async () => {
    await seedDefaultsIfEmpty();
    await seedDefaultsIfEmpty();

    expect(await db.select().from(schema.rules)).toHaveLength(DEFAULT_RULES.length);
    expect(await db.select().from(schema.setupTags)).toHaveLength(DEFAULT_SETUP_TAGS.length);
    expect(await db.select().from(schema.moodTags)).toHaveLength(DEFAULT_MOOD_TAGS.length);
  });
});
