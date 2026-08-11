import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrapTestFirestore } from "@/server/testUtils/testFirestore";
import { tradeSchema } from "@/lib/validation";

// Every app module under test here transitively imports
// "@/server/firebase/client", which binds to the emulator project as a
// module-load side effect. A static top-level import would run before
// bootstrapTestFirestore() sets FIREBASE_PROJECT_ID, so everything is
// imported dynamically inside beforeAll instead. tradeSchema itself has no
// db dependency, so it's safe to import statically above.
let wipe: Awaited<ReturnType<typeof bootstrapTestFirestore>>["wipe"];
let computeStreaks: typeof import("@/server/queries/gamification").computeStreaks;
let getTradeAdherenceHistory: typeof import("@/server/queries/gamification").getTradeAdherenceHistory;
let getMonthlyAverageAdherence: typeof import("@/server/queries/gamification").getMonthlyAverageAdherence;
let getMostRecentTradeViolations: typeof import("@/server/queries/gamification").getMostRecentTradeViolations;
let computeOutcomeStreaks: typeof import("@/server/queries/gamification").computeOutcomeStreaks;
let getTradeOutcomeHistory: typeof import("@/server/queries/gamification").getTradeOutcomeHistory;
let createRule: typeof import("@/server/queries/rules").createRule;
let createTrade: typeof import("@/server/queries/trades").createTrade;

type TradeAdherence = Awaited<ReturnType<typeof getTradeAdherenceHistory>>[number];
type TradeOutcomePoint = Awaited<ReturnType<typeof getTradeOutcomeHistory>>[number];
type CheckStatus = "followed" | "not_followed" | "not_applicable";

beforeAll(async () => {
  ({ wipe } = await bootstrapTestFirestore());
  ({
    computeStreaks,
    getTradeAdherenceHistory,
    getMonthlyAverageAdherence,
    getMostRecentTradeViolations,
    computeOutcomeStreaks,
    getTradeOutcomeHistory,
  } = await import("@/server/queries/gamification"));
  ({ createRule } = await import("@/server/queries/rules"));
  ({ createTrade } = await import("@/server/queries/trades"));
});

const makeAdherence = (isAdherent: boolean): TradeAdherence => ({
  tradeId: "t",
  entryAt: "2026-07-30T00:00:00.000Z",
  followed: isAdherent ? 1 : 0,
  notFollowed: isAdherent ? 0 : 1,
  notApplicable: 0,
  isAdherent,
  adherenceRatio: isAdherent ? 1 : 0,
  outcome: null,
  riskRewardRealized: null,
});

describe("computeStreaks", () => {
  it("returns zeros for an empty history", () => {
    expect(computeStreaks([])).toEqual({
      streakAtTrade: [],
      currentStreak: 0,
      longestStreak: 0,
    });
  });

  it("counts an unbroken run of adherent trades", () => {
    const history = [true, true, true].map(makeAdherence);
    expect(computeStreaks(history)).toEqual({
      streakAtTrade: [1, 2, 3],
      currentStreak: 3,
      longestStreak: 3,
    });
  });

  it("resets the streak to 0 on a non-adherent trade", () => {
    const history = [true, true, false, true].map(makeAdherence);
    const result = computeStreaks(history);
    expect(result.streakAtTrade).toEqual([1, 2, 0, 1]);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(2);
  });

  it("tracks the longest streak even after it's later broken", () => {
    const history = [true, true, false, true, true, true].map(makeAdherence);
    const result = computeStreaks(history);
    expect(result.streakAtTrade).toEqual([1, 2, 0, 1, 2, 3]);
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it("stays at 0 when no trade is adherent", () => {
    const history = [false, false].map(makeAdherence);
    expect(computeStreaks(history)).toEqual({
      streakAtTrade: [0, 0],
      currentStreak: 0,
      longestStreak: 0,
    });
  });
});

describe("computeOutcomeStreaks", () => {
  const makeOutcome = (outcome: "win" | "loss" | "breakeven"): TradeOutcomePoint => ({
    tradeId: "t",
    entryAt: "2026-07-30T00:00:00.000Z",
    outcome,
  });

  it("returns zeros/null for an empty history", () => {
    expect(computeOutcomeStreaks([])).toEqual({
      currentStreak: 0,
      currentStreakType: null,
      longestWinStreak: 0,
      longestLossStreak: 0,
    });
  });

  it("counts an unbroken run of wins", () => {
    const history = ["win", "win", "win"].map((o) => makeOutcome(o as "win"));
    expect(computeOutcomeStreaks(history)).toEqual({
      currentStreak: 3,
      currentStreakType: "win",
      longestWinStreak: 3,
      longestLossStreak: 0,
    });
  });

  it("counts an unbroken run of losses", () => {
    const history = ["loss", "loss"].map((o) => makeOutcome(o as "loss"));
    expect(computeOutcomeStreaks(history)).toEqual({
      currentStreak: 2,
      currentStreakType: "loss",
      longestWinStreak: 0,
      longestLossStreak: 2,
    });
  });

  it("tracks win and loss streaks independently through alternating outcomes", () => {
    const history = (["win", "win", "loss", "win", "loss", "loss", "loss"] as const).map(makeOutcome);
    const result = computeOutcomeStreaks(history);
    expect(result.currentStreak).toBe(3);
    expect(result.currentStreakType).toBe("loss");
    expect(result.longestWinStreak).toBe(2);
    expect(result.longestLossStreak).toBe(3);
  });

  it("resets both counters on a breakeven trade", () => {
    const history = (["win", "win", "breakeven", "loss"] as const).map(makeOutcome);
    const result = computeOutcomeStreaks(history);
    expect(result.currentStreak).toBe(1);
    expect(result.currentStreakType).toBe("loss");
    expect(result.longestWinStreak).toBe(2);
    expect(result.longestLossStreak).toBe(1);
  });
});

describe("db-backed gamification queries", () => {
  let ruleAId: string;
  let ruleBId: string;

  beforeEach(async () => {
    await wipe();
    const ruleA = await createRule("Rule A");
    const ruleB = await createRule("Rule B");
    ruleAId = ruleA.id;
    ruleBId = ruleB.id;
  });

  async function addTrade(
    entryAt: string,
    outcome: "win" | "loss" | "breakeven" | null = null,
    status: "open" | "closed" = "closed",
    ruleChecks: { ruleId: string; status: CheckStatus }[] = [],
  ) {
    return createTrade(
      tradeSchema.parse({
        direction: "long",
        entryPrice: 100,
        stopLoss: 95,
        positionSize: 1,
        session: "ny",
        entryAt,
        outcome,
        status,
        ruleChecks,
      }),
    );
  }

  describe("getTradeAdherenceHistory", () => {
    it("treats a trade with no logged checks as adherent with a null ratio", async () => {
      const t = await addTrade("2026-01-01T10:00:00.000Z");
      const [entry] = await getTradeAdherenceHistory();
      expect(entry).toMatchObject({
        tradeId: t.id,
        followed: 0,
        notFollowed: 0,
        notApplicable: 0,
        isAdherent: true,
        adherenceRatio: null,
      });
    });

    it("computes a full adherence ratio when every checked rule was followed", async () => {
      const t = await addTrade("2026-01-01T10:00:00.000Z", null, "closed", [
        { ruleId: ruleAId, status: "followed" },
        { ruleId: ruleBId, status: "followed" },
      ]);

      const [entry] = await getTradeAdherenceHistory();
      expect(entry).toMatchObject({
        tradeId: t.id,
        followed: 2,
        notFollowed: 0,
        notApplicable: 0,
        isAdherent: true,
        adherenceRatio: 1,
      });
    });

    it("excludes not_applicable checks from the adherence ratio denominator", async () => {
      await addTrade("2026-01-01T10:00:00.000Z", null, "closed", [
        { ruleId: ruleAId, status: "followed" },
        { ruleId: ruleBId, status: "not_applicable" },
      ]);

      const [entry] = await getTradeAdherenceHistory();
      expect(entry).toMatchObject({
        followed: 1,
        notFollowed: 0,
        notApplicable: 1,
        isAdherent: true,
        adherenceRatio: 1,
      });
    });

    it("marks a trade with any broken rule as not adherent and lowers its ratio", async () => {
      await addTrade("2026-01-01T10:00:00.000Z", null, "closed", [
        { ruleId: ruleAId, status: "followed" },
        { ruleId: ruleBId, status: "not_followed" },
      ]);

      const [entry] = await getTradeAdherenceHistory();
      expect(entry).toMatchObject({
        followed: 1,
        notFollowed: 1,
        isAdherent: false,
        adherenceRatio: 0.5,
      });
    });

    it("orders trades chronologically by entryAt", async () => {
      const t2 = await addTrade("2026-01-05T10:00:00.000Z");
      const t1 = await addTrade("2026-01-01T10:00:00.000Z");
      const history = await getTradeAdherenceHistory();
      expect(history.map((h) => h.tradeId)).toEqual([t1.id, t2.id]);
    });

    it("still includes open trades — adherence is knowable at entry, before the trade closes", async () => {
      const t = await addTrade("2026-01-01T10:00:00.000Z", null, "open", [
        { ruleId: ruleAId, status: "not_followed" },
      ]);

      const [entry] = await getTradeAdherenceHistory();
      expect(entry).toMatchObject({ tradeId: t.id, isAdherent: false });
    });
  });

  describe("getTradeOutcomeHistory", () => {
    it("excludes open trades (null outcome)", async () => {
      await addTrade("2026-01-01T10:00:00.000Z", null, "open");
      const closed = await addTrade("2026-01-02T10:00:00.000Z", "win", "closed");

      const history = await getTradeOutcomeHistory();
      expect(history.map((h) => h.tradeId)).toEqual([closed.id]);
    });

    it("orders trades chronologically by entryAt", async () => {
      const t2 = await addTrade("2026-01-05T10:00:00.000Z", "win");
      const t1 = await addTrade("2026-01-01T10:00:00.000Z", "loss");
      const history = await getTradeOutcomeHistory();
      expect(history.map((h) => h.tradeId)).toEqual([t1.id, t2.id]);
    });
  });

  describe("getMonthlyAverageAdherence", () => {
    it("returns null when no trades exist for the given month", async () => {
      expect(await getMonthlyAverageAdherence("2026-01")).toBeNull();
    });

    it("returns null when the month's trades have no checklist coverage", async () => {
      await addTrade("2026-01-01T10:00:00.000Z");
      expect(await getMonthlyAverageAdherence("2026-01")).toBeNull();
    });

    it("averages adherence ratios only across trades within the given month", async () => {
      await addTrade("2026-01-01T10:00:00.000Z", null, "closed", [
        { ruleId: ruleAId, status: "followed" },
      ]);
      await addTrade("2026-01-15T10:00:00.000Z", null, "closed", [
        { ruleId: ruleAId, status: "followed" },
        { ruleId: ruleBId, status: "not_followed" },
      ]);
      await addTrade("2026-02-01T10:00:00.000Z", null, "closed", [
        { ruleId: ruleAId, status: "not_followed" },
      ]);

      expect(await getMonthlyAverageAdherence("2026-01")).toBeCloseTo(0.75);
      expect(await getMonthlyAverageAdherence("2026-02")).toBeCloseTo(0);
    });
  });

  describe("getMostRecentTradeViolations", () => {
    it("returns null when there are no trades", async () => {
      expect(await getMostRecentTradeViolations()).toBeNull();
    });

    it("returns null when the most recent trade has no broken rules", async () => {
      await addTrade("2026-01-01T10:00:00.000Z", null, "closed", [
        { ruleId: ruleAId, status: "followed" },
      ]);
      expect(await getMostRecentTradeViolations()).toBeNull();
    });

    it("returns the broken rules' text for the most recent trade", async () => {
      const t = await addTrade("2026-01-01T10:00:00.000Z", null, "closed", [
        { ruleId: ruleAId, status: "not_followed" },
        { ruleId: ruleBId, status: "followed" },
      ]);

      const result = await getMostRecentTradeViolations();
      expect(result).toEqual({
        tradeId: t.id,
        entryAt: t.entryAt,
        violatedRules: ["Rule A"],
      });
    });

    it("looks at the most recent trade by entryAt, not the last-inserted row", async () => {
      // Inserted first, but chronologically the most recent trade — clean.
      await addTrade("2026-01-20T10:00:00.000Z", null, "closed", [
        { ruleId: ruleAId, status: "followed" },
      ]);

      // Inserted last (would win under "last inserted row" logic), but its
      // entryAt is earlier — should NOT surface even though it has a violation.
      await addTrade("2026-01-01T10:00:00.000Z", null, "closed", [
        { ruleId: ruleAId, status: "not_followed" },
      ]);

      expect(await getMostRecentTradeViolations()).toBeNull();
    });

    it("surfaces a violation on the most recent trade even while it's still open", async () => {
      const t = await addTrade("2026-01-01T10:00:00.000Z", null, "open", [
        { ruleId: ruleAId, status: "not_followed" },
      ]);

      const result = await getMostRecentTradeViolations();
      expect(result).toEqual({
        tradeId: t.id,
        entryAt: t.entryAt,
        violatedRules: ["Rule A"],
      });
    });
  });
});
