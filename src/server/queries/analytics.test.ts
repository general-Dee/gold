import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrapTestDb } from "@/server/testUtils/testDb";

// Every function under test transitively imports "@/server/db/client", which
// creates its sqlite client as a module-load side effect. A static top-level
// import would run before bootstrapTestDb() sets DATABASE_URL, so everything
// is imported dynamically inside beforeAll instead (see gamification.test.ts
// for the failure mode this avoids).
let db: Awaited<ReturnType<typeof bootstrapTestDb>>["db"];
let schema: Awaited<ReturnType<typeof bootstrapTestDb>>["schema"];
let analytics: typeof import("@/server/queries/analytics");

beforeAll(async () => {
  ({ db, schema } = await bootstrapTestDb());
  analytics = await import("@/server/queries/analytics");
});

let ruleAId: string;
let ruleBId: string;

beforeEach(async () => {
  await db.delete(schema.tradeRuleChecks);
  await db.delete(schema.trades);
  await db.delete(schema.rules);
  await db.delete(schema.setupTags);
  await db.delete(schema.moodTags);

  const [ruleA] = await db.insert(schema.rules).values({ text: "Rule A" }).returning();
  const [ruleB] = await db.insert(schema.rules).values({ text: "Rule B" }).returning();
  ruleAId = ruleA.id;
  ruleBId = ruleB.id;
});

type TradeOverrides = {
  entryAt: string;
  outcome?: "win" | "loss" | "breakeven" | null;
  pnl?: number | null;
  riskRewardPlanned?: number | null;
  riskRewardRealized?: number | null;
  session?: "asian" | "london" | "ny" | "overlap" | "other";
  setupTagIds?: string[];
  moodBeforeId?: string | null;
  status?: "open" | "closed";
};

async function addTrade(opts: TradeOverrides) {
  const [trade] = await db
    .insert(schema.trades)
    .values({
      direction: "long",
      entryPrice: 100,
      stopLoss: 95,
      positionSize: 1,
      session: opts.session ?? "ny",
      entryAt: opts.entryAt,
      status: opts.status ?? "closed",
      outcome: opts.outcome ?? null,
      pnl: opts.pnl ?? null,
      riskRewardPlanned: opts.riskRewardPlanned ?? null,
      riskRewardRealized: opts.riskRewardRealized ?? null,
      moodBeforeId: opts.moodBeforeId ?? null,
    })
    .returning();

  if (opts.setupTagIds && opts.setupTagIds.length > 0) {
    await db
      .insert(schema.tradeSetupTags)
      .values(opts.setupTagIds.map((setupTagId) => ({ tradeId: trade.id, setupTagId })));
  }

  return trade;
}

async function addCheck(
  tradeId: string,
  ruleId: string,
  status: "followed" | "not_followed" | "not_applicable",
) {
  await db.insert(schema.tradeRuleChecks).values({
    tradeId,
    ruleId,
    ruleTextSnapshot: "snapshot",
    status,
  });
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

describe("getWinRate", () => {
  it("returns null when there are no decided trades", async () => {
    expect(await analytics.getWinRate()).toBeNull();
  });

  it("excludes breakeven trades from the denominator", async () => {
    await addTrade({ entryAt: "2026-01-01T10:00:00.000Z", outcome: "win" });
    await addTrade({ entryAt: "2026-01-02T10:00:00.000Z", outcome: "win" });
    await addTrade({ entryAt: "2026-01-03T10:00:00.000Z", outcome: "loss" });
    await addTrade({ entryAt: "2026-01-04T10:00:00.000Z", outcome: "breakeven" });

    expect(await analytics.getWinRate()).toBeCloseTo(2 / 3);
  });

  it("excludes open trades even if they carry an outcome", async () => {
    await addTrade({ entryAt: "2026-01-01T10:00:00.000Z", outcome: "win" });
    await addTrade({ entryAt: "2026-01-02T10:00:00.000Z", outcome: "loss" });
    await addTrade({ entryAt: "2026-01-03T10:00:00.000Z", outcome: "win", status: "open" });

    expect(await analytics.getWinRate()).toBeCloseTo(0.5);
  });
});

describe("getAverageRiskReward", () => {
  it("returns null when every value is missing", async () => {
    await addTrade({ entryAt: "2026-01-01T10:00:00.000Z" });
    expect(await analytics.getAverageRiskReward("planned")).toBeNull();
    expect(await analytics.getAverageRiskReward("realized")).toBeNull();
  });

  it("averages only the trades that have a value for the requested kind", async () => {
    await addTrade({ entryAt: "2026-01-01T10:00:00.000Z", riskRewardPlanned: 2, riskRewardRealized: 1 });
    await addTrade({ entryAt: "2026-01-02T10:00:00.000Z", riskRewardPlanned: 4, riskRewardRealized: null });
    await addTrade({ entryAt: "2026-01-03T10:00:00.000Z", riskRewardPlanned: null, riskRewardRealized: 3 });

    expect(await analytics.getAverageRiskReward("planned")).toBeCloseTo(3);
    expect(await analytics.getAverageRiskReward("realized")).toBeCloseTo(2);
  });

  it("excludes open trades even if they carry a realized R", async () => {
    await addTrade({ entryAt: "2026-01-01T10:00:00.000Z", riskRewardRealized: 2 });
    await addTrade({ entryAt: "2026-01-02T10:00:00.000Z", riskRewardRealized: 10, status: "open" });

    expect(await analytics.getAverageRiskReward("realized")).toBeCloseTo(2);
  });
});

describe("getEquityCurve", () => {
  it("accumulates pnl and realized R in chronological order without a missing value resetting the total", async () => {
    await addTrade({ entryAt: "2026-01-01T10:00:00.000Z", pnl: 100, riskRewardRealized: 1 });
    await addTrade({ entryAt: "2026-01-02T10:00:00.000Z", pnl: null, riskRewardRealized: 2 });
    await addTrade({ entryAt: "2026-01-03T10:00:00.000Z", pnl: -50, riskRewardRealized: null });

    const curve = await analytics.getEquityCurve();
    expect(curve.map((p) => p.cumulativePnl)).toEqual([100, 100, 50]);
    expect(curve.map((p) => p.cumulativeR)).toEqual([1, 3, 3]);
  });

  it("excludes open trades from the curve entirely", async () => {
    await addTrade({ entryAt: "2026-01-01T10:00:00.000Z", pnl: 100, riskRewardRealized: 1 });
    await addTrade({
      entryAt: "2026-01-02T10:00:00.000Z",
      pnl: 9999,
      riskRewardRealized: 99,
      status: "open",
    });

    const curve = await analytics.getEquityCurve();
    expect(curve).toHaveLength(1);
    expect(curve[0]).toMatchObject({ cumulativePnl: 100, cumulativeR: 1 });
  });
});

describe("get30DayAdherence", () => {
  it("returns null when there is nothing in the window", async () => {
    expect(await analytics.get30DayAdherence()).toBeNull();
  });

  it("excludes trades older than 30 days and trades with no checklist coverage", async () => {
    const old = await addTrade({ entryAt: daysAgo(40) });
    await addCheck(old.id, ruleAId, "followed");

    await addTrade({ entryAt: daysAgo(2) });

    const recentFull = await addTrade({ entryAt: daysAgo(10) });
    await addCheck(recentFull.id, ruleAId, "followed");

    const recentHalf = await addTrade({ entryAt: daysAgo(5) });
    await addCheck(recentHalf.id, ruleAId, "followed");
    await addCheck(recentHalf.id, ruleBId, "not_followed");

    expect(await analytics.get30DayAdherence()).toBeCloseTo(0.75);
  });
});

describe("getAdherenceCorrelation", () => {
  it("summarizes win rate and average R separately for adherent vs non-adherent trades", async () => {
    const a1 = await addTrade({ entryAt: "2026-01-01T10:00:00.000Z", outcome: "win", riskRewardRealized: 2 });
    await addCheck(a1.id, ruleAId, "followed");
    const a2 = await addTrade({ entryAt: "2026-01-02T10:00:00.000Z", outcome: "loss", riskRewardRealized: -1 });
    await addCheck(a2.id, ruleAId, "followed");

    const b1 = await addTrade({ entryAt: "2026-01-03T10:00:00.000Z", outcome: "win", riskRewardRealized: 1 });
    await addCheck(b1.id, ruleAId, "not_followed");
    const b2 = await addTrade({ entryAt: "2026-01-04T10:00:00.000Z", outcome: null, riskRewardRealized: 0.5 });
    await addCheck(b2.id, ruleAId, "not_followed");

    const result = await analytics.getAdherenceCorrelation();

    expect(result.adherent).toEqual({ count: 2, winRate: 0.5, avgR: 0.5, totalPnl: 0, expectancy: null });
    expect(result.nonAdherent).toEqual({ count: 2, winRate: 1, avgR: 0.75, totalPnl: 0, expectancy: null });
  });

  it("returns a null winRate and avgR for an empty group instead of dividing by zero", async () => {
    const a1 = await addTrade({ entryAt: "2026-01-01T10:00:00.000Z", outcome: "win", riskRewardRealized: 2 });
    await addCheck(a1.id, ruleAId, "followed");

    const result = await analytics.getAdherenceCorrelation();

    expect(result.nonAdherent).toEqual({ count: 0, winRate: null, avgR: null, totalPnl: 0, expectancy: null });
  });
});

describe("getBreakdownBySetupTag", () => {
  it("groups by setup tag, sorted by trade count, and excludes untagged trades", async () => {
    const [tagA] = await db.insert(schema.setupTags).values({ name: "London breakout" }).returning();
    const [tagB] = await db.insert(schema.setupTags).values({ name: "NY reversal" }).returning();

    await addTrade({ entryAt: "2026-01-01T10:00:00.000Z", outcome: "win", riskRewardRealized: 2, pnl: 200, setupTagIds: [tagA.id] });
    await addTrade({ entryAt: "2026-01-02T10:00:00.000Z", outcome: "loss", riskRewardRealized: -1, pnl: -100, setupTagIds: [tagA.id] });
    await addTrade({ entryAt: "2026-01-03T10:00:00.000Z", outcome: "win", riskRewardRealized: 1, pnl: 150, setupTagIds: [tagB.id] });
    await addTrade({ entryAt: "2026-01-04T10:00:00.000Z", outcome: "win", riskRewardRealized: 1, pnl: 999 });

    const result = await analytics.getBreakdownBySetupTag();

    expect(result).toEqual([
      { key: tagA.id, label: "London breakout", count: 2, winRate: 0.5, avgR: 0.5, totalPnl: 100, expectancy: 50 },
      { key: tagB.id, label: "NY reversal", count: 1, winRate: 1, avgR: 1, totalPnl: 150, expectancy: 150 },
    ]);
  });

  it("counts a trade with multiple tags under every one of its tags", async () => {
    const [tagA] = await db.insert(schema.setupTags).values({ name: "London breakout" }).returning();
    const [tagB] = await db.insert(schema.setupTags).values({ name: "Trend continuation" }).returning();

    await addTrade({
      entryAt: "2026-01-01T10:00:00.000Z",
      outcome: "win",
      riskRewardRealized: 2,
      pnl: 300,
      setupTagIds: [tagA.id, tagB.id],
    });

    const result = await analytics.getBreakdownBySetupTag();

    expect(result).toEqual(
      expect.arrayContaining([
        { key: tagA.id, label: "London breakout", count: 1, winRate: 1, avgR: 2, totalPnl: 300, expectancy: 300 },
        { key: tagB.id, label: "Trend continuation", count: 1, winRate: 1, avgR: 2, totalPnl: 300, expectancy: 300 },
      ]),
    );
    expect(result).toHaveLength(2);
  });
});

describe("getBreakdownBySession", () => {
  it("groups trades by session", async () => {
    await addTrade({ entryAt: "2026-01-01T10:00:00.000Z", session: "london", outcome: "win", riskRewardRealized: 1 });
    await addTrade({ entryAt: "2026-01-02T10:00:00.000Z", session: "ny", outcome: "loss", riskRewardRealized: -1 });
    await addTrade({ entryAt: "2026-01-03T10:00:00.000Z", session: "ny", outcome: "win", riskRewardRealized: 2 });

    const result = await analytics.getBreakdownBySession();

    expect(result).toEqual([
      { key: "ny", label: "ny", count: 2, winRate: 0.5, avgR: 0.5, totalPnl: 0, expectancy: null },
      { key: "london", label: "london", count: 1, winRate: 1, avgR: 1, totalPnl: 0, expectancy: null },
    ]);
  });

  it("excludes open trades from group counts", async () => {
    await addTrade({ entryAt: "2026-01-01T10:00:00.000Z", session: "ny", outcome: "win", riskRewardRealized: 1 });
    await addTrade({
      entryAt: "2026-01-02T10:00:00.000Z",
      session: "ny",
      outcome: "win",
      riskRewardRealized: 1,
      status: "open",
    });

    const result = await analytics.getBreakdownBySession();

    expect(result).toEqual([
      { key: "ny", label: "ny", count: 1, winRate: 1, avgR: 1, totalPnl: 0, expectancy: null },
    ]);
  });
});

describe("getBreakdownByMoodBefore", () => {
  it("groups trades by mood-before tag and excludes trades with no mood set", async () => {
    const [calm] = await db.insert(schema.moodTags).values({ name: "Calm", category: "before" }).returning();
    const [fomo] = await db.insert(schema.moodTags).values({ name: "FOMO", category: "before" }).returning();

    await addTrade({ entryAt: "2026-01-01T10:00:00.000Z", outcome: "win", riskRewardRealized: 1, moodBeforeId: calm.id });
    await addTrade({ entryAt: "2026-01-02T10:00:00.000Z", outcome: "loss", riskRewardRealized: -1, moodBeforeId: fomo.id });
    await addTrade({ entryAt: "2026-01-03T10:00:00.000Z", outcome: "win", riskRewardRealized: 2 });

    const result = await analytics.getBreakdownByMoodBefore();

    expect(result).toEqual([
      { key: calm.id, label: "Calm", count: 1, winRate: 1, avgR: 1, totalPnl: 0, expectancy: null },
      { key: fomo.id, label: "FOMO", count: 1, winRate: 0, avgR: -1, totalPnl: 0, expectancy: null },
    ]);
  });
});

describe("getBreakdownByDayOfWeek", () => {
  it("labels each trade by its day of week and orders Sun through Sat", async () => {
    await addTrade({ entryAt: "2026-01-05T10:00:00.000Z", outcome: "win", riskRewardRealized: 1 }); // Monday
    await addTrade({ entryAt: "2026-01-04T10:00:00.000Z", outcome: "loss", riskRewardRealized: -1 }); // Sunday

    const result = await analytics.getBreakdownByDayOfWeek();

    expect(result.map((r) => r.label)).toEqual(["Sun", "Mon"]);
  });
});

describe("getDailyPnlForMonth", () => {
  it("groups trades within the month by local day and excludes adjacent months", async () => {
    await addTrade({ entryAt: "2026-07-01T10:00:00.000Z", outcome: "win", pnl: 100, riskRewardRealized: 2 });
    await addTrade({ entryAt: "2026-07-01T14:00:00.000Z", outcome: "loss", pnl: -30, riskRewardRealized: -1 });
    await addTrade({ entryAt: "2026-07-15T10:00:00.000Z", outcome: "win", pnl: 50, riskRewardRealized: 1 });
    await addTrade({ entryAt: "2026-06-15T12:00:00.000Z", outcome: "win", pnl: 999, riskRewardRealized: 9 });
    await addTrade({ entryAt: "2026-08-15T12:00:00.000Z", outcome: "loss", pnl: -999, riskRewardRealized: -9 });

    const result = await analytics.getDailyPnlForMonth(2026, 7);

    expect(result).toHaveLength(2);
    const jul1 = result.find((d) => d.date === "2026-07-01");
    expect(jul1).toMatchObject({ pnl: 70, r: 1, tradeCount: 2, wins: 1, losses: 1 });
    const jul15 = result.find((d) => d.date === "2026-07-15");
    expect(jul15).toMatchObject({ pnl: 50, r: 1, tradeCount: 1, wins: 1, losses: 0 });
  });

  it("returns an empty array for a month with no trades", async () => {
    expect(await analytics.getDailyPnlForMonth(2026, 7)).toEqual([]);
  });

  it("excludes open trades from daily aggregates", async () => {
    await addTrade({ entryAt: "2026-07-01T10:00:00.000Z", outcome: "win", pnl: 100, riskRewardRealized: 2 });
    await addTrade({
      entryAt: "2026-07-01T14:00:00.000Z",
      outcome: "win",
      pnl: 9999,
      riskRewardRealized: 99,
      status: "open",
    });

    const result = await analytics.getDailyPnlForMonth(2026, 7);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ pnl: 100, r: 2, tradeCount: 1, wins: 1, losses: 0 });
  });
});

describe("getMaxDrawdown", () => {
  it("returns null when there are no trades", async () => {
    expect(await analytics.getMaxDrawdown()).toBeNull();
  });

  it("computes the largest peak-to-trough decline in both pnl and R", async () => {
    await addTrade({ entryAt: "2026-01-01T10:00:00.000Z", pnl: 100, riskRewardRealized: 1 });
    await addTrade({ entryAt: "2026-01-02T10:00:00.000Z", pnl: 150, riskRewardRealized: 2 });
    await addTrade({ entryAt: "2026-01-03T10:00:00.000Z", pnl: -170, riskRewardRealized: -2 });
    await addTrade({ entryAt: "2026-01-04T10:00:00.000Z", pnl: 220, riskRewardRealized: 3 });

    const result = await analytics.getMaxDrawdown();
    expect(result).toEqual({ maxDrawdownPnl: 170, maxDrawdownR: 2 });
  });
});

describe("getRMultipleDistribution", () => {
  const bucketOf = (result: Awaited<ReturnType<typeof analytics.getRMultipleDistribution>>, bucket: string) =>
    result.find((b) => b.bucket === bucket);

  it("returns all buckets, zero-filled, when there are no closed trades", async () => {
    const result = await analytics.getRMultipleDistribution();
    expect(result).toEqual([
      { bucket: "< -2R", count: 0, totalR: 0 },
      { bucket: "-2R to -1R", count: 0, totalR: 0 },
      { bucket: "-1R to 0R", count: 0, totalR: 0 },
      { bucket: "0R to 1R", count: 0, totalR: 0 },
      { bucket: "1R to 2R", count: 0, totalR: 0 },
      { bucket: "2R to 3R", count: 0, totalR: 0 },
      { bucket: "3R+", count: 0, totalR: 0 },
    ]);
  });

  it("sorts trades into the correct bucket by riskRewardRealized", async () => {
    await addTrade({ entryAt: "2026-01-01T10:00:00.000Z", riskRewardRealized: -3 });
    await addTrade({ entryAt: "2026-01-02T10:00:00.000Z", riskRewardRealized: -1.5 });
    await addTrade({ entryAt: "2026-01-03T10:00:00.000Z", riskRewardRealized: 0.5 });
    await addTrade({ entryAt: "2026-01-04T10:00:00.000Z", riskRewardRealized: 4 });

    const result = await analytics.getRMultipleDistribution();
    expect(bucketOf(result, "< -2R")?.count).toBe(1);
    expect(bucketOf(result, "-2R to -1R")?.count).toBe(1);
    expect(bucketOf(result, "0R to 1R")?.count).toBe(1);
    expect(bucketOf(result, "3R+")?.count).toBe(1);
  });

  it("places boundary values in the greater-or-equal bucket (half-open ranges)", async () => {
    await addTrade({ entryAt: "2026-01-01T10:00:00.000Z", riskRewardRealized: -1 });
    await addTrade({ entryAt: "2026-01-02T10:00:00.000Z", riskRewardRealized: 0 });
    await addTrade({ entryAt: "2026-01-03T10:00:00.000Z", riskRewardRealized: 3 });

    const result = await analytics.getRMultipleDistribution();
    expect(bucketOf(result, "-1R to 0R")?.count).toBe(1);
    expect(bucketOf(result, "0R to 1R")?.count).toBe(1);
    expect(bucketOf(result, "3R+")?.count).toBe(1);
  });

  it("excludes open trades and trades with a null riskRewardRealized", async () => {
    await addTrade({ entryAt: "2026-01-01T10:00:00.000Z", riskRewardRealized: 1, status: "open" });
    await addTrade({ entryAt: "2026-01-02T10:00:00.000Z", riskRewardRealized: null });

    const result = await analytics.getRMultipleDistribution();
    expect(result.every((b) => b.count === 0)).toBe(true);
  });

  it("sums totalR within each bucket", async () => {
    await addTrade({ entryAt: "2026-01-01T10:00:00.000Z", riskRewardRealized: 1.5 });
    await addTrade({ entryAt: "2026-01-02T10:00:00.000Z", riskRewardRealized: 1.2 });

    const result = await analytics.getRMultipleDistribution();
    expect(bucketOf(result, "1R to 2R")).toEqual({ bucket: "1R to 2R", count: 2, totalR: 2.7 });
  });
});
