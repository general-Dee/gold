import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { bootstrapTestDb } from "@/server/testUtils/testDb";
import { tradeSchema, type TradeInput } from "@/lib/validation";

// createTrade/updateTrade/getTradeById transitively import "@/server/db/client",
// which creates its sqlite client as a module-load side effect. A static
// top-level import would run before bootstrapTestDb() sets DATABASE_URL, so
// they're imported dynamically inside beforeAll instead (see
// gamification.test.ts for the failure mode this avoids). tradeSchema itself
// has no db dependency, so it's safe to import statically above.
let db: Awaited<ReturnType<typeof bootstrapTestDb>>["db"];
let schema: Awaited<ReturnType<typeof bootstrapTestDb>>["schema"];
let createTrade: typeof import("@/server/queries/trades").createTrade;
let updateTrade: typeof import("@/server/queries/trades").updateTrade;
let deleteTrade: typeof import("@/server/queries/trades").deleteTrade;
let getTradeById: typeof import("@/server/queries/trades").getTradeById;

beforeAll(async () => {
  ({ db, schema } = await bootstrapTestDb());
  ({ createTrade, updateTrade, deleteTrade, getTradeById } = await import("@/server/queries/trades"));
});

beforeEach(async () => {
  await db.delete(schema.badgeUnlocks);
  await db.delete(schema.tradeRuleChecks);
  await db.delete(schema.trades);
  await db.delete(schema.rules);
});

function buildInput(overrides: Partial<TradeInput> = {}): TradeInput {
  return tradeSchema.parse({
    direction: "long",
    entryPrice: 100,
    stopLoss: 95,
    positionSize: 1,
    session: "ny",
    entryAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  });
}

describe("createTrade", () => {
  it("snapshots the rule's current text onto the trade's rule checks", async () => {
    const [rule] = await db.insert(schema.rules).values({ text: "Wait for confirmation" }).returning();

    const trade = await createTrade(
      buildInput({ ruleChecks: [{ ruleId: rule.id, status: "followed" }] }),
    );

    const found = await getTradeById(trade.id);
    expect(found?.checks).toHaveLength(1);
    expect(found?.checks[0]).toMatchObject({
      ruleId: rule.id,
      ruleTextSnapshot: "Wait for confirmation",
      status: "followed",
    });
  });

  it("silently drops rule checks that reference a rule id that doesn't exist", async () => {
    const trade = await createTrade(
      buildInput({ ruleChecks: [{ ruleId: "does-not-exist", status: "followed" }] }),
    );

    const found = await getTradeById(trade.id);
    expect(found?.checks).toEqual([]);
  });
});

describe("updateTrade", () => {
  it("wholesale-replaces rule checks rather than merging them", async () => {
    const [ruleA] = await db.insert(schema.rules).values({ text: "Rule A" }).returning();
    const [ruleB] = await db.insert(schema.rules).values({ text: "Rule B" }).returning();

    const trade = await createTrade(
      buildInput({ ruleChecks: [{ ruleId: ruleA.id, status: "followed" }] }),
    );

    await updateTrade(trade.id, buildInput({ ruleChecks: [{ ruleId: ruleB.id, status: "not_followed" }] }));

    const found = await getTradeById(trade.id);
    expect(found?.checks).toHaveLength(1);
    expect(found?.checks[0]).toMatchObject({ ruleId: ruleB.id, status: "not_followed" });
  });

  it("re-snapshots against the rule's current text even if it changed since the trade was created", async () => {
    const [rule] = await db.insert(schema.rules).values({ text: "Original text" }).returning();

    const trade = await createTrade(
      buildInput({ ruleChecks: [{ ruleId: rule.id, status: "followed" }] }),
    );

    await db.update(schema.rules).set({ text: "Changed text" }).where(eq(schema.rules.id, rule.id));
    await updateTrade(trade.id, buildInput({ ruleChecks: [{ ruleId: rule.id, status: "followed" }] }));

    const found = await getTradeById(trade.id);
    expect(found?.checks[0]).toMatchObject({ ruleTextSnapshot: "Changed text" });
  });
});

describe("getTradeById", () => {
  it("returns null for a missing id", async () => {
    expect(await getTradeById("does-not-exist")).toBeNull();
  });

  it("returns the trade joined with its checks and images", async () => {
    const trade = await createTrade(buildInput());
    const found = await getTradeById(trade.id);
    expect(found?.trade.id).toBe(trade.id);
    expect(found?.checks).toEqual([]);
    expect(found?.images).toEqual([]);
  });
});

describe("deleteTrade", () => {
  it("removes the trade and cascades its rule checks", async () => {
    const [rule] = await db.insert(schema.rules).values({ text: "Rule A" }).returning();
    const trade = await createTrade(
      buildInput({ ruleChecks: [{ ruleId: rule.id, status: "followed" }] }),
    );

    await deleteTrade(trade.id);

    expect(await getTradeById(trade.id)).toBeNull();
    const remainingChecks = await db
      .select()
      .from(schema.tradeRuleChecks)
      .where(eq(schema.tradeRuleChecks.tradeId, trade.id));
    expect(remainingChecks).toEqual([]);
  });

  it("detaches rather than throws when a badge unlock still references the trade", async () => {
    const trade = await createTrade(buildInput());
    const [unlock] = await db
      .insert(schema.badgeUnlocks)
      .values({ badgeKey: "streak_3", tradeId: trade.id })
      .returning();

    await expect(deleteTrade(trade.id)).resolves.not.toThrow();

    const [after] = await db
      .select()
      .from(schema.badgeUnlocks)
      .where(eq(schema.badgeUnlocks.id, unlock.id));
    expect(after).toMatchObject({ badgeKey: "streak_3", tradeId: null });
  });

  it("is a no-op for an id that doesn't exist", async () => {
    await expect(deleteTrade("does-not-exist")).resolves.not.toThrow();
  });
});
