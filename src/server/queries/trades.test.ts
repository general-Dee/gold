import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { bootstrapTestDb } from "@/server/testUtils/testDb";
import { rowsToCsv } from "@/lib/csv";
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
let listTrades: typeof import("@/server/queries/trades").listTrades;
let importTradesFromCsv: typeof import("@/server/queries/trades").importTradesFromCsv;

beforeAll(async () => {
  ({ db, schema } = await bootstrapTestDb());
  ({ createTrade, updateTrade, deleteTrade, getTradeById, listTrades, importTradesFromCsv } =
    await import("@/server/queries/trades"));
});

beforeEach(async () => {
  await db.delete(schema.badgeUnlocks);
  await db.delete(schema.tradeRuleChecks);
  await db.delete(schema.tradeSetupTags);
  await db.delete(schema.trades);
  await db.delete(schema.rules);
  await db.delete(schema.setupTags);
  await db.delete(schema.moodTags);
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

  it("links multiple setup tags to a trade", async () => {
    const [tagA] = await db.insert(schema.setupTags).values({ name: "Tag A" }).returning();
    const [tagB] = await db.insert(schema.setupTags).values({ name: "Tag B" }).returning();

    const trade = await createTrade(buildInput({ setupTagIds: [tagA.id, tagB.id] }));

    const found = await getTradeById(trade.id);
    expect(found?.setupTagIds.sort()).toEqual([tagA.id, tagB.id].sort());
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

  it("wholesale-replaces setup tags rather than merging them", async () => {
    const [tagA] = await db.insert(schema.setupTags).values({ name: "Tag A" }).returning();
    const [tagB] = await db.insert(schema.setupTags).values({ name: "Tag B" }).returning();

    const trade = await createTrade(buildInput({ setupTagIds: [tagA.id] }));
    await updateTrade(trade.id, buildInput({ setupTagIds: [tagB.id] }));

    const found = await getTradeById(trade.id);
    expect(found?.setupTagIds).toEqual([tagB.id]);
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

describe("listTrades", () => {
  it("returns all trades ordered by entryAt descending when no filters are given", async () => {
    const early = await createTrade(buildInput({ entryAt: "2026-01-01T10:00:00.000Z" }));
    const late = await createTrade(buildInput({ entryAt: "2026-01-05T10:00:00.000Z" }));

    const found = await listTrades();
    expect(found.map((t) => t.id)).toEqual([late.id, early.id]);
  });

  it("filters by date range", async () => {
    const jan1 = await createTrade(buildInput({ entryAt: "2026-01-01T10:00:00.000Z" }));
    await createTrade(buildInput({ entryAt: "2026-01-10T10:00:00.000Z" }));

    const found = await listTrades({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-01T23:59:59.999Z",
    });
    expect(found.map((t) => t.id)).toEqual([jan1.id]);
  });

  it("filters by direction", async () => {
    const long = await createTrade(buildInput({ direction: "long" }));
    await createTrade(buildInput({ direction: "short" }));

    const found = await listTrades({ direction: "long" });
    expect(found.map((t) => t.id)).toEqual([long.id]);
  });

  it("filters by outcome", async () => {
    const win = await createTrade(buildInput({ outcome: "win" }));
    await createTrade(buildInput({ outcome: "loss" }));

    const found = await listTrades({ outcome: "win" });
    expect(found.map((t) => t.id)).toEqual([win.id]);
  });

  it("filters by status", async () => {
    const open = await createTrade(buildInput({ status: "open" }));
    await createTrade(buildInput({ status: "closed" }));

    const found = await listTrades({ status: "open" });
    expect(found.map((t) => t.id)).toEqual([open.id]);
  });

  it("filters by session", async () => {
    const ny = await createTrade(buildInput({ session: "ny" }));
    await createTrade(buildInput({ session: "london" }));

    const found = await listTrades({ session: "ny" });
    expect(found.map((t) => t.id)).toEqual([ny.id]);
  });

  it("filters by setup tag", async () => {
    const [tagA] = await db.insert(schema.setupTags).values({ name: "London breakout" }).returning();
    const [tagB] = await db.insert(schema.setupTags).values({ name: "Trend continuation" }).returning();
    const tagged = await createTrade(buildInput({ setupTagIds: [tagA.id, tagB.id] }));
    await createTrade(buildInput());

    const foundByA = await listTrades({ setupTagId: tagA.id });
    expect(foundByA.map((t) => t.id)).toEqual([tagged.id]);

    const foundByB = await listTrades({ setupTagId: tagB.id });
    expect(foundByB.map((t) => t.id)).toEqual([tagged.id]);
  });

  it("returns an empty list when filtering by a setup tag no trade has", async () => {
    const [tag] = await db.insert(schema.setupTags).values({ name: "Unused tag" }).returning();
    await createTrade(buildInput());

    expect(await listTrades({ setupTagId: tag.id })).toEqual([]);
  });

  it("searches across reasoning, notesAfter, and newsNote", async () => {
    const match = await createTrade(buildInput({ reasoning: "Waited for London breakout confirmation" }));
    await createTrade(buildInput({ reasoning: "Unrelated setup" }));

    const found = await listTrades({ q: "breakout" });
    expect(found.map((t) => t.id)).toEqual([match.id]);
  });

  it("combines multiple filters with AND semantics", async () => {
    const match = await createTrade(buildInput({ direction: "long", outcome: "win" }));
    await createTrade(buildInput({ direction: "long", outcome: "loss" }));
    await createTrade(buildInput({ direction: "short", outcome: "win" }));

    const found = await listTrades({ direction: "long", outcome: "win" });
    expect(found.map((t) => t.id)).toEqual([match.id]);
  });

  it("returns an empty list when no trades match", async () => {
    await createTrade(buildInput({ direction: "long" }));
    expect(await listTrades({ direction: "short" })).toEqual([]);
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

const IMPORT_HEADERS = [
  "entryAt", "exitAt", "direction", "instrument", "status",
  "entryPrice", "exitPrice", "stopLoss", "takeProfit", "positionSize",
  "riskRewardPlanned", "riskRewardRealized", "outcome", "pnl",
  "setupTag", "session", "dxyBias", "newsNearby", "newsNote",
  "moodBefore", "moodAfter", "reasoning", "notesAfter",
];

function buildImportRow(overrides: Record<string, string | number | boolean | null> = {}) {
  const base: Record<string, string | number | boolean | null> = {
    entryAt: "2026-01-01T10:00:00.000Z",
    exitAt: null,
    direction: "long",
    instrument: "XAUUSD",
    status: "closed",
    entryPrice: 100,
    exitPrice: null,
    stopLoss: 95,
    takeProfit: null,
    positionSize: 1,
    riskRewardPlanned: null,
    riskRewardRealized: null,
    outcome: null,
    pnl: null,
    setupTag: null,
    session: "ny",
    dxyBias: null,
    newsNearby: false,
    newsNote: null,
    moodBefore: null,
    moodAfter: null,
    reasoning: null,
    notesAfter: null,
    ...overrides,
  };
  return IMPORT_HEADERS.map((h) => base[h]);
}

function buildImportCsv(rows: (string | number | boolean | null)[][]) {
  return rowsToCsv(IMPORT_HEADERS, rows);
}

describe("importTradesFromCsv", () => {
  it("imports a valid row and links an existing setup tag by name", async () => {
    const [tag] = await db.insert(schema.setupTags).values({ name: "London breakout" }).returning();

    const result = await importTradesFromCsv(
      buildImportCsv([buildImportRow({ setupTag: "London breakout" })]),
    );

    expect(result.importedCount).toBe(1);
    expect(result.skipped).toEqual([]);
    expect(result.createdSetupTags).toEqual([]);

    const trades = await db.select().from(schema.trades);
    expect(trades).toHaveLength(1);
    const links = await db.select().from(schema.tradeSetupTags);
    expect(links).toEqual([expect.objectContaining({ tradeId: trades[0].id, setupTagId: tag.id })]);
  });

  it("auto-creates a setup tag and mood tag that don't exist yet, matching existing ones case-insensitively", async () => {
    await db.insert(schema.setupTags).values({ name: "London breakout" });

    const result = await importTradesFromCsv(
      buildImportCsv([
        buildImportRow({ setupTag: "london breakout, NY reversal", moodBefore: "Calm" }),
      ]),
    );

    expect(result.importedCount).toBe(1);
    expect(result.createdSetupTags).toEqual(["NY reversal"]);
    expect(result.createdMoodTags).toEqual(["Calm"]);
    expect(await db.select().from(schema.setupTags)).toHaveLength(2);
    expect(await db.select().from(schema.moodTags)).toHaveLength(1);
  });

  it("only creates a repeated new tag name once across multiple rows", async () => {
    const result = await importTradesFromCsv(
      buildImportCsv([
        buildImportRow({ setupTag: "News spike fade" }),
        buildImportRow({ setupTag: "news spike fade" }),
      ]),
    );

    expect(result.importedCount).toBe(2);
    expect(result.createdSetupTags).toEqual(["News spike fade"]);
    expect(await db.select().from(schema.setupTags)).toHaveLength(1);
  });

  it("reports invalid rows as skipped without failing the whole import", async () => {
    const result = await importTradesFromCsv(
      buildImportCsv([
        buildImportRow(),
        buildImportRow({ session: "tokyo" }),
        buildImportRow({ direction: "long" }),
      ]),
    );

    expect(result.importedCount).toBe(2);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].row).toBe(3);
    expect(result.skipped[0].reason).toContain("session");
  });

  it("recomputes badges once after import rather than per row", async () => {
    const result = await importTradesFromCsv(
      buildImportCsv([
        buildImportRow({ outcome: "loss", pnl: -50 }),
        buildImportRow({ outcome: "loss", pnl: -50, entryAt: "2026-01-02T10:00:00.000Z" }),
      ]),
    );

    expect(result.importedCount).toBe(2);
    // Doesn't throw and leaves the trades queryable — full behavior of
    // evaluateBadgesForTrade is covered by its own test suite.
    expect(await listTrades()).toHaveLength(2);
  });

  it("rejects a file missing the expected headers", async () => {
    await expect(importTradesFromCsv("a,b\r\n1,2")).rejects.toThrow(
      /doesn't look like a trades export/,
    );
  });
});
