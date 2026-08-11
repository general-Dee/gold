import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrapTestFirestore } from "@/server/testUtils/testFirestore";

// Every function under test transitively imports "@/server/firebase/client",
// which binds to the emulator project as a module-load side effect. A static
// top-level import would run before bootstrapTestFirestore() sets
// FIREBASE_PROJECT_ID, so everything is imported dynamically inside
// beforeAll instead.
let wipe: Awaited<ReturnType<typeof bootstrapTestFirestore>>["wipe"];
let reflectionsCollection: typeof import("@/server/firebase/collections").reflectionsCollection;
let listReflections: typeof import("@/server/queries/reflections").listReflections;
let getReflectionById: typeof import("@/server/queries/reflections").getReflectionById;
let upsertReflection: typeof import("@/server/queries/reflections").upsertReflection;
let updateReflectionBody: typeof import("@/server/queries/reflections").updateReflectionBody;
let deleteReflection: typeof import("@/server/queries/reflections").deleteReflection;

beforeAll(async () => {
  ({ wipe } = await bootstrapTestFirestore());
  ({ reflectionsCollection } = await import("@/server/firebase/collections"));
  ({ listReflections, getReflectionById, upsertReflection, updateReflectionBody, deleteReflection } =
    await import("@/server/queries/reflections"));
});

beforeEach(async () => {
  await wipe();
});

async function allReflectionRows() {
  const snapshot = await reflectionsCollection().get();
  return snapshot.docs.map((doc) => doc.data());
}

describe("listReflections", () => {
  it("returns entries ordered by periodStart descending", async () => {
    await upsertReflection({ period: "weekly", periodStart: "2026-01-05", body: "Week 1" });
    await upsertReflection({ period: "weekly", periodStart: "2026-01-19", body: "Week 3" });
    await upsertReflection({ period: "weekly", periodStart: "2026-01-12", body: "Week 2" });

    const result = await listReflections();
    expect(result.map((r) => r.body)).toEqual(["Week 3", "Week 2", "Week 1"]);
  });

  it("filters by period when given one", async () => {
    await upsertReflection({ period: "weekly", periodStart: "2026-01-05", body: "Weekly entry" });
    await upsertReflection({ period: "monthly", periodStart: "2026-01-01", body: "Monthly entry" });

    const result = await listReflections("monthly");
    expect(result.map((r) => r.body)).toEqual(["Monthly entry"]);
  });
});

describe("getReflectionById", () => {
  it("returns the matching row", async () => {
    const row = await upsertReflection({ period: "weekly", periodStart: "2026-01-05", body: "Hello" });
    const result = await getReflectionById(row.id);
    expect(result).toMatchObject({ id: row.id, body: "Hello" });
  });

  it("returns null when no row matches", async () => {
    expect(await getReflectionById("nonexistent")).toBeNull();
  });
});

describe("upsertReflection", () => {
  it("creates a new row for a new (period, periodStart)", async () => {
    await upsertReflection({ period: "weekly", periodStart: "2026-01-05", body: "First" });
    const rows = await allReflectionRows();
    expect(rows).toHaveLength(1);
  });

  it("updates the existing row's body instead of duplicating on the same (period, periodStart)", async () => {
    await upsertReflection({ period: "weekly", periodStart: "2026-01-05", body: "First draft" });
    await upsertReflection({ period: "weekly", periodStart: "2026-01-05", body: "Revised draft" });

    const rows = await allReflectionRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toBe("Revised draft");
  });

  it("treats different periods with the same periodStart as distinct entries", async () => {
    await upsertReflection({ period: "weekly", periodStart: "2026-01-01", body: "Weekly" });
    await upsertReflection({ period: "monthly", periodStart: "2026-01-01", body: "Monthly" });

    const rows = await allReflectionRows();
    expect(rows).toHaveLength(2);
  });
});

describe("updateReflectionBody", () => {
  it("updates only the body of the matching row", async () => {
    const row = await upsertReflection({ period: "weekly", periodStart: "2026-01-05", body: "Old" });
    await updateReflectionBody(row.id, "New");

    const result = await getReflectionById(row.id);
    expect(result).toMatchObject({ body: "New", period: "weekly", periodStart: "2026-01-05" });
  });
});

describe("deleteReflection", () => {
  it("hard-removes the row", async () => {
    const row = await upsertReflection({ period: "weekly", periodStart: "2026-01-05", body: "Gone soon" });
    await deleteReflection(row.id);

    expect(await getReflectionById(row.id)).toBeNull();
    expect(await allReflectionRows()).toEqual([]);
  });
});
