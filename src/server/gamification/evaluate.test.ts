import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrapTestFirestore } from "@/server/testUtils/testFirestore";
import { tradeSchema } from "@/lib/validation";

let wipe: Awaited<ReturnType<typeof bootstrapTestFirestore>>["wipe"];
let badgeUnlocksCollection: typeof import("@/server/firebase/collections").badgeUnlocksCollection;
let tradesCollection: typeof import("@/server/firebase/collections").tradesCollection;
let evaluateBadgesForTrade: typeof import("./evaluate").evaluateBadgesForTrade;
let createRule: typeof import("@/server/queries/rules").createRule;
let createTrade: typeof import("@/server/queries/trades").createTrade;

beforeAll(async () => {
  ({ wipe } = await bootstrapTestFirestore());
  ({ badgeUnlocksCollection, tradesCollection } = await import("@/server/firebase/collections"));
  ({ evaluateBadgesForTrade } = await import("./evaluate"));
  ({ createRule } = await import("@/server/queries/rules"));
  ({ createTrade } = await import("@/server/queries/trades"));
});

let ruleId: string;

beforeEach(async () => {
  await wipe();
  const rule = await createRule("Wait for confirmation");
  ruleId = rule.id;
});

/**
 * `followed` left undefined logs no checklist item at all for the trade — it still
 * counts as adherent (no broken rules) for streak purposes, but is excluded from
 * monthly-adherence-ratio math (which only looks at trades with checklist coverage).
 * Pass `followed: true/false` when a test cares about the ratio itself.
 */
async function addTrade(opts: {
  entryAt: string;
  followed?: boolean;
  outcome?: "win" | "loss" | "breakeven" | null;
  riskRewardRealized?: number | null;
}) {
  const trade = await createTrade(
    tradeSchema.parse({
      direction: "long",
      entryPrice: 100,
      stopLoss: 95,
      positionSize: 1,
      session: "ny",
      entryAt: opts.entryAt,
      outcome: opts.outcome ?? null,
      riskRewardRealized: opts.riskRewardRealized ?? null,
      ruleChecks:
        opts.followed !== undefined
          ? [{ ruleId, status: opts.followed ? "followed" : "not_followed" }]
          : [],
    }),
  );

  // createTrade() always recomputes riskRewardRealized from
  // entryPrice/stopLoss/exitPrice (unchanged from the pre-migration Drizzle
  // behavior) — these fixtures fabricate an R-multiple directly to test
  // badge thresholds in isolation from price data, so patch it onto the doc
  // afterward rather than deriving a realistic exitPrice for every case.
  if (opts.riskRewardRealized !== undefined) {
    await tradesCollection().doc(trade.id).update({ riskRewardRealized: opts.riskRewardRealized });
    return { ...trade, riskRewardRealized: opts.riskRewardRealized };
  }

  return trade;
}

async function allBadgeUnlockRows() {
  return (await badgeUnlocksCollection().get()).docs.map((d) => d.data());
}

describe("evaluateBadgesForTrade", () => {
  it("unlocks a streak milestone only once the run is long enough, on the trade that completes it", async () => {
    const t1 = await addTrade({ entryAt: "2026-01-01T10:00:00.000Z" });
    expect(await evaluateBadgesForTrade(t1.id)).toEqual([]);

    const t2 = await addTrade({ entryAt: "2026-01-02T10:00:00.000Z" });
    expect(await evaluateBadgesForTrade(t2.id)).toEqual([]);

    const t3 = await addTrade({ entryAt: "2026-01-03T10:00:00.000Z" });
    expect(await evaluateBadgesForTrade(t3.id)).toEqual([{ badgeKey: "streak_3", tradeId: t3.id }]);
  });

  it("does not re-unlock a streak milestone already on record", async () => {
    const t1 = await addTrade({ entryAt: "2026-01-01T10:00:00.000Z" });
    await evaluateBadgesForTrade(t1.id);
    const t2 = await addTrade({ entryAt: "2026-01-02T10:00:00.000Z" });
    await evaluateBadgesForTrade(t2.id);
    const t3 = await addTrade({ entryAt: "2026-01-03T10:00:00.000Z" });
    await evaluateBadgesForTrade(t3.id);

    const t4 = await addTrade({ entryAt: "2026-01-04T10:00:00.000Z" });
    expect(await evaluateBadgesForTrade(t4.id)).toEqual([]);

    const rows = await allBadgeUnlockRows();
    expect(rows.filter((r) => r.badgeKey === "streak_3")).toHaveLength(1);
  });

  it("resets the streak on a broken rule, so a later milestone counts from the break", async () => {
    const t1 = await addTrade({ entryAt: "2026-01-01T10:00:00.000Z" });
    await evaluateBadgesForTrade(t1.id);
    const t2 = await addTrade({ entryAt: "2026-01-02T10:00:00.000Z" });
    await evaluateBadgesForTrade(t2.id);
    const broken = await addTrade({ entryAt: "2026-01-03T10:00:00.000Z", followed: false });
    expect(await evaluateBadgesForTrade(broken.id)).toEqual([]);
    const t4 = await addTrade({ entryAt: "2026-01-04T10:00:00.000Z" });
    await evaluateBadgesForTrade(t4.id);
    const t5 = await addTrade({ entryAt: "2026-01-05T10:00:00.000Z" });
    await evaluateBadgesForTrade(t5.id);
    const t6 = await addTrade({ entryAt: "2026-01-06T10:00:00.000Z" });

    expect(await evaluateBadgesForTrade(t6.id)).toEqual([{ badgeKey: "streak_3", tradeId: t6.id }]);
  });

  it("unlocks disciplined_loss for a losing trade where every checked rule was followed", async () => {
    // A separate, already-adherent trade earlier in the month claims the monthly
    // adherence badge first, so it doesn't also show up tied to the loss trade below.
    const t0 = await addTrade({ entryAt: "2026-01-01T10:00:00.000Z", followed: true });
    await evaluateBadgesForTrade(t0.id);

    const t = await addTrade({ entryAt: "2026-01-02T10:00:00.000Z", outcome: "loss", followed: true });
    expect(await evaluateBadgesForTrade(t.id)).toEqual([{ badgeKey: "disciplined_loss", tradeId: t.id }]);
  });

  it("does not unlock disciplined_loss for a losing trade where a rule was broken", async () => {
    const t = await addTrade({ entryAt: "2026-01-01T10:00:00.000Z", outcome: "loss", followed: false });
    expect(await evaluateBadgesForTrade(t.id)).toEqual([]);
  });

  it("unlocks comeback when a fresh streak rebuilds to the comeback length after a break", async () => {
    await addTrade({ entryAt: "2026-01-01T10:00:00.000Z" });
    await addTrade({ entryAt: "2026-01-02T10:00:00.000Z", followed: false });
    for (const day of ["03", "04", "05", "06"]) {
      await addTrade({ entryAt: `2026-01-${day}T10:00:00.000Z` });
    }
    const t7 = await addTrade({ entryAt: "2026-01-07T10:00:00.000Z" });

    const unlocks = await evaluateBadgesForTrade(t7.id);
    expect(unlocks).toContainEqual({ badgeKey: "comeback", tradeId: t7.id });
  });

  it("does not unlock comeback the first time a streak reaches the comeback length", async () => {
    for (const day of ["01", "02", "03", "04"]) {
      await addTrade({ entryAt: `2026-01-${day}T10:00:00.000Z` });
    }
    const t5 = await addTrade({ entryAt: "2026-01-05T10:00:00.000Z" });

    const unlocks = await evaluateBadgesForTrade(t5.id);
    expect(unlocks.map((u) => u.badgeKey)).not.toContain("comeback");
  });

  it("unlocks a monthly adherence badge on the trade where the month's average first crosses the threshold", async () => {
    // One broken trade, then nine perfectly-followed ones: the running average only
    // reaches the 0.9 threshold on the tenth trade, which is where the badge should land.
    const days = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"];
    let lastUnlocks: Awaited<ReturnType<typeof evaluateBadgesForTrade>> = [];
    let lastTrade!: Awaited<ReturnType<typeof addTrade>>;
    for (let i = 0; i < days.length; i++) {
      lastTrade = await addTrade({
        entryAt: `2026-02-${days[i]}T10:00:00.000Z`,
        followed: i > 0,
      });
      lastUnlocks = await evaluateBadgesForTrade(lastTrade.id);
    }

    expect(lastUnlocks).toEqual([
      { badgeKey: "monthly_adherence:2026-02", tradeId: lastTrade.id },
    ]);
  });

  it("does not unlock a monthly adherence badge when the month averages below the threshold", async () => {
    await addTrade({ entryAt: "2026-03-01T10:00:00.000Z", followed: false });
    const t2 = await addTrade({ entryAt: "2026-03-02T10:00:00.000Z", followed: false });
    const unlocks = await evaluateBadgesForTrade(t2.id);
    expect(unlocks).toEqual([]);

    const rows = await allBadgeUnlockRows();
    expect(rows.some((r) => r.badgeKey.startsWith("monthly_adherence:"))).toBe(false);
  });

  it("ignores trades with no checklist coverage when computing monthly adherence", async () => {
    await addTrade({ entryAt: "2026-04-01T10:00:00.000Z" });
    const t2 = await addTrade({ entryAt: "2026-04-02T10:00:00.000Z", followed: true });

    const unlocks = await evaluateBadgesForTrade(t2.id);
    expect(unlocks).toContainEqual({ badgeKey: "monthly_adherence:2026-04", tradeId: t2.id });
  });

  it("unlocks a profit-R milestone only once cumulative realized R crosses it", async () => {
    const t1 = await addTrade({ entryAt: "2026-05-01T10:00:00.000Z", riskRewardRealized: 4 });
    expect((await evaluateBadgesForTrade(t1.id)).map((u) => u.badgeKey)).not.toContain("profit_10r");

    const t2 = await addTrade({ entryAt: "2026-05-02T10:00:00.000Z", riskRewardRealized: 5 });
    expect((await evaluateBadgesForTrade(t2.id)).map((u) => u.badgeKey)).not.toContain("profit_10r");

    const t3 = await addTrade({ entryAt: "2026-05-03T10:00:00.000Z", riskRewardRealized: 2 });
    expect(await evaluateBadgesForTrade(t3.id)).toContainEqual({
      badgeKey: "profit_10r",
      tradeId: t3.id,
    });
  });

  it("unlocks a win-streak milestone and resets it after a loss", async () => {
    const t1 = await addTrade({ entryAt: "2026-06-01T10:00:00.000Z", outcome: "win" });
    await evaluateBadgesForTrade(t1.id);
    const t2 = await addTrade({ entryAt: "2026-06-02T10:00:00.000Z", outcome: "win" });
    expect(await evaluateBadgesForTrade(t2.id)).toEqual([]);
    const t3 = await addTrade({ entryAt: "2026-06-03T10:00:00.000Z", outcome: "win" });
    expect(await evaluateBadgesForTrade(t3.id)).toContainEqual({
      badgeKey: "win_streak_3",
      tradeId: t3.id,
    });

    const broken = await addTrade({ entryAt: "2026-06-04T10:00:00.000Z", outcome: "loss" });
    await evaluateBadgesForTrade(broken.id);
    await addTrade({ entryAt: "2026-06-05T10:00:00.000Z", outcome: "win" });
    const t6 = await addTrade({ entryAt: "2026-06-06T10:00:00.000Z", outcome: "win" });
    expect(await evaluateBadgesForTrade(t6.id)).toEqual([]);
  });

  it("unlocks a loss-streak milestone and resets it after a win", async () => {
    const t1 = await addTrade({ entryAt: "2026-08-01T10:00:00.000Z", outcome: "loss" });
    await evaluateBadgesForTrade(t1.id);
    const t2 = await addTrade({ entryAt: "2026-08-02T10:00:00.000Z", outcome: "loss" });
    expect(await evaluateBadgesForTrade(t2.id)).toEqual([]);
    const t3 = await addTrade({ entryAt: "2026-08-03T10:00:00.000Z", outcome: "loss" });
    expect(await evaluateBadgesForTrade(t3.id)).toContainEqual({
      badgeKey: "loss_streak_3",
      tradeId: t3.id,
    });

    const broken = await addTrade({ entryAt: "2026-08-04T10:00:00.000Z", outcome: "win" });
    await evaluateBadgesForTrade(broken.id);
    await addTrade({ entryAt: "2026-08-05T10:00:00.000Z", outcome: "loss" });
    const t6 = await addTrade({ entryAt: "2026-08-06T10:00:00.000Z", outcome: "loss" });
    expect(await evaluateBadgesForTrade(t6.id)).toEqual([]);
  });

  it("unlocks a big-win badge independently for two different qualifying trades", async () => {
    const t1 = await addTrade({ entryAt: "2026-07-01T10:00:00.000Z", riskRewardRealized: 3 });
    expect(await evaluateBadgesForTrade(t1.id)).toContainEqual({
      badgeKey: "big_win_3r",
      tradeId: t1.id,
    });

    const t2 = await addTrade({ entryAt: "2026-07-02T10:00:00.000Z", riskRewardRealized: 4 });
    expect(await evaluateBadgesForTrade(t2.id)).toContainEqual({
      badgeKey: "big_win_3r",
      tradeId: t2.id,
    });

    const rows = await allBadgeUnlockRows();
    expect(rows.filter((r) => r.badgeKey === "big_win_3r")).toHaveLength(2);
  });

  it("does not re-unlock big_win for the same trade on a later evaluation", async () => {
    const t1 = await addTrade({ entryAt: "2026-08-01T10:00:00.000Z", riskRewardRealized: 3 });
    await evaluateBadgesForTrade(t1.id);
    const t2 = await addTrade({ entryAt: "2026-08-02T10:00:00.000Z" });
    expect(await evaluateBadgesForTrade(t2.id)).toEqual([]);

    const rows = await allBadgeUnlockRows();
    expect(rows.filter((r) => r.badgeKey === "big_win_3r")).toHaveLength(1);
  });

  it("unlocks every big-win threshold a single trade crosses at once", async () => {
    const t1 = await addTrade({ entryAt: "2026-09-01T10:00:00.000Z", riskRewardRealized: 12 });
    const unlocks = await evaluateBadgesForTrade(t1.id);
    expect(unlocks.map((u) => u.badgeKey)).toEqual(
      expect.arrayContaining(["big_win_10r", "big_win_3r", "big_win_5r"]),
    );
  });
});
