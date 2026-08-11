import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bootstrapTestFirestore } from "@/server/testUtils/testFirestore";

// revalidatePath/redirect require Next's request-scoped internals, which
// don't exist in a bare vitest run — calling them unmocked throws
// immediately. redirect is mocked as a no-op rather than a throw so these
// actions run to completion for assertions here.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

// The actions under test transitively import "@/server/firebase/client",
// which binds to the emulator project as a module-load side effect. A static
// top-level import would run before bootstrapTestFirestore() sets
// FIREBASE_PROJECT_ID, so they're imported dynamically inside beforeAll.
let wipe: Awaited<ReturnType<typeof bootstrapTestFirestore>>["wipe"];
let reflectionsCollection: typeof import("@/server/firebase/collections").reflectionsCollection;
let createReflectionAction: typeof import("@/server/actions/reflections").createReflectionAction;
let updateReflectionAction: typeof import("@/server/actions/reflections").updateReflectionAction;
let deleteReflectionAction: typeof import("@/server/actions/reflections").deleteReflectionAction;
let upsertReflection: typeof import("@/server/queries/reflections").upsertReflection;

beforeAll(async () => {
  ({ wipe } = await bootstrapTestFirestore());
  ({ reflectionsCollection } = await import("@/server/firebase/collections"));
  ({ createReflectionAction, updateReflectionAction, deleteReflectionAction } = await import(
    "@/server/actions/reflections"
  ));
  ({ upsertReflection } = await import("@/server/queries/reflections"));
});

beforeEach(async () => {
  await wipe();
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(redirect).mockClear();
});

async function allReflectionRows() {
  const snapshot = await reflectionsCollection().get();
  return snapshot.docs.map((doc) => doc.data());
}

function buildFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("createReflectionAction", () => {
  it("normalizes a weekly anchor date to that week's Monday", async () => {
    // 2026-01-14 is a Wednesday; the ISO week starts Monday 2026-01-12.
    await createReflectionAction(
      buildFormData({ period: "weekly", anchorDate: "2026-01-14", body: "Good week" }),
    );

    const rows = await allReflectionRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ period: "weekly", periodStart: "2026-01-12", body: "Good week" });
    expect(revalidatePath).toHaveBeenCalledWith("/journal");
    expect(redirect).toHaveBeenCalledWith(`/journal/${rows[0].id}/edit`);
  });

  it("normalizes a monthly anchor date to the 1st of that month", async () => {
    await createReflectionAction(
      buildFormData({ period: "monthly", anchorDate: "2026-01-19", body: "Good month" }),
    );

    const rows = await allReflectionRows();
    expect(rows[0]).toMatchObject({ period: "monthly", periodStart: "2026-01-01" });
  });

  it("updates the existing entry in place for a second create in the same period", async () => {
    await createReflectionAction(
      buildFormData({ period: "weekly", anchorDate: "2026-01-12", body: "First draft" }),
    );
    await createReflectionAction(
      buildFormData({ period: "weekly", anchorDate: "2026-01-14", body: "Revised draft" }),
    );

    const rows = await allReflectionRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toBe("Revised draft");
  });

  it("throws and performs no writes when body is blank", async () => {
    await expect(
      createReflectionAction(buildFormData({ period: "weekly", anchorDate: "2026-01-12", body: "" })),
    ).rejects.toThrow();

    expect(await allReflectionRows()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("updateReflectionAction", () => {
  it("updates the body, revalidates /journal, and redirects there", async () => {
    const row = await upsertReflection({ period: "weekly", periodStart: "2026-01-12", body: "Old" });

    await updateReflectionAction(row.id, buildFormData({ body: "New" }));

    const [updated] = await allReflectionRows();
    expect(updated.body).toBe("New");
    expect(revalidatePath).toHaveBeenCalledWith("/journal");
    expect(redirect).toHaveBeenCalledWith("/journal");
  });
});

describe("deleteReflectionAction", () => {
  it("removes the entry, revalidates /journal, and redirects there", async () => {
    const row = await upsertReflection({ period: "weekly", periodStart: "2026-01-12", body: "Gone" });

    await deleteReflectionAction(row.id);

    expect(await allReflectionRows()).toEqual([]);
    expect(revalidatePath).toHaveBeenCalledWith("/journal");
    expect(redirect).toHaveBeenCalledWith("/journal");
  });
});
