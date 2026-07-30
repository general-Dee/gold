import { describe, it, expect } from "vitest";
import { computeChecklistStreaks } from "@/server/queries/checklist";

describe("computeChecklistStreaks", () => {
  it("returns zeros for an empty history", () => {
    expect(computeChecklistStreaks([])).toEqual({
      streakAtDay: [],
      currentStreak: 0,
      longestStreak: 0,
    });
  });

  it("counts an unbroken run of fully-completed days", () => {
    const history = [{ allDone: true }, { allDone: true }, { allDone: true }];
    expect(computeChecklistStreaks(history)).toEqual({
      streakAtDay: [1, 2, 3],
      currentStreak: 3,
      longestStreak: 3,
    });
  });

  it("resets the streak on an incomplete day", () => {
    const history = [{ allDone: true }, { allDone: false }, { allDone: true }];
    const result = computeChecklistStreaks(history);
    expect(result.streakAtDay).toEqual([1, 0, 1]);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });
});
