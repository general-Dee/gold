import { describe, it, expect } from "vitest";
import { computeStreaks, type TradeAdherence } from "@/server/queries/gamification";

const makeAdherence = (isAdherent: boolean): TradeAdherence => ({
  tradeId: "t",
  entryAt: "2026-07-30T00:00:00.000Z",
  followed: isAdherent ? 1 : 0,
  notFollowed: isAdherent ? 0 : 1,
  notApplicable: 0,
  isAdherent,
  adherenceRatio: isAdherent ? 1 : 0,
  outcome: null,
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
