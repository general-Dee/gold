import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bootstrapTestDb } from "@/server/testUtils/testDb";
import { tradeSchema } from "@/lib/validation";

// revalidatePath/redirect require Next's request-scoped internals, which
// don't exist in a bare vitest run — calling them unmocked throws
// immediately ("Invariant: static generation store missing..." / a
// NEXT_REDIRECT error). redirect is mocked as a no-op rather than a throw so
// createTradeAction/updateTradeAction's trailing return value (marked
// "unreachable" in real Next.js) is reachable for assertions here too.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

// createTradeAction/updateTradeAction/deleteTradeAction transitively import
// "@/server/db/client", which creates its sqlite client as a module-load side
// effect. A static top-level import would run before bootstrapTestDb() sets
// DATABASE_URL, so they're imported dynamically inside beforeAll instead (see
// gamification.test.ts for the failure mode this avoids). tradeSchema itself
// has no db dependency, so it's safe to import statically above.
let db: Awaited<ReturnType<typeof bootstrapTestDb>>["db"];
let schema: Awaited<ReturnType<typeof bootstrapTestDb>>["schema"];
let createTradeAction: typeof import("@/server/actions/trades").createTradeAction;
let updateTradeAction: typeof import("@/server/actions/trades").updateTradeAction;
let deleteTradeAction: typeof import("@/server/actions/trades").deleteTradeAction;
let createTrade: typeof import("@/server/queries/trades").createTrade;

beforeAll(async () => {
  ({ db, schema } = await bootstrapTestDb());
  ({ createTradeAction, updateTradeAction, deleteTradeAction } = await import(
    "@/server/actions/trades"
  ));
  ({ createTrade } = await import("@/server/queries/trades"));
});

beforeEach(async () => {
  await db.delete(schema.badgeUnlocks);
  await db.delete(schema.tradeRuleChecks);
  await db.delete(schema.tradeSetupTags);
  await db.delete(schema.trades);
  await db.delete(schema.rules);
  await db.delete(schema.setupTags);
  await db.delete(schema.moodTags);
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(redirect).mockClear();
});

function buildRawInput(overrides: Record<string, unknown> = {}) {
  return {
    direction: "long",
    entryPrice: 100,
    stopLoss: 95,
    positionSize: 1,
    session: "ny",
    entryAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("createTradeAction", () => {
  it("creates the trade, revalidates /trades and /, and redirects to the new trade's detail page", async () => {
    const result = await createTradeAction(buildRawInput());

    expect(result.trade).toMatchObject({ direction: "long", entryPrice: 100 });
    expect(Array.isArray(result.unlocked)).toBe(true);

    const rows = await db.select().from(schema.trades);
    expect(rows).toHaveLength(1);

    expect(revalidatePath).toHaveBeenCalledWith("/trades");
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(redirect).toHaveBeenCalledWith(`/trades/${result.trade.id}`);
  });

  it("throws and performs no writes when input fails schema validation", async () => {
    await expect(createTradeAction(buildRawInput({ direction: "sideways" }))).rejects.toThrow();

    const rows = await db.select().from(schema.trades);
    expect(rows).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("updateTradeAction", () => {
  it("updates the trade, revalidates /trades, the trade's own path, and /, and redirects to the trade's detail page", async () => {
    const trade = await createTrade(tradeSchema.parse(buildRawInput()));

    const updated = await updateTradeAction(trade.id, buildRawInput({ entryPrice: 150 }));

    expect(updated).toMatchObject({ id: trade.id, entryPrice: 150 });
    expect(revalidatePath).toHaveBeenCalledWith("/trades");
    expect(revalidatePath).toHaveBeenCalledWith(`/trades/${trade.id}`);
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(redirect).toHaveBeenCalledWith(`/trades/${trade.id}`);
  });

  it("throws and leaves the trade unchanged when input fails validation", async () => {
    const trade = await createTrade(tradeSchema.parse(buildRawInput()));

    await expect(
      updateTradeAction(trade.id, buildRawInput({ direction: "sideways" })),
    ).rejects.toThrow();

    const [row] = await db.select().from(schema.trades);
    expect(row.entryPrice).toBe(100);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  // updateTrade in the query layer has no existence guard — it's a bare
  // .update().where(eq(id)).returning(), so a bogus id just updates zero rows
  // rather than throwing. This documents that boundary behavior.
  it("still redirects for an id that doesn't exist, since the query layer silently no-ops", async () => {
    await updateTradeAction("does-not-exist", buildRawInput());

    expect(redirect).toHaveBeenCalledWith("/trades/does-not-exist");
  });
});

describe("deleteTradeAction", () => {
  it("deletes the trade, revalidates /trades and /, and redirects to /trades", async () => {
    const trade = await createTrade(tradeSchema.parse(buildRawInput()));

    await deleteTradeAction(trade.id);

    const rows = await db.select().from(schema.trades);
    expect(rows).toEqual([]);
    expect(revalidatePath).toHaveBeenCalledWith("/trades");
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(redirect).toHaveBeenCalledWith("/trades");
  });
});
