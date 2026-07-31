import { describe, it, expect } from "vitest";
import {
  STREAK_MILESTONES,
  COMEBACK_LENGTH,
  MONTHLY_ADHERENCE_THRESHOLD,
  PROFIT_R_MILESTONES,
  WIN_STREAK_MILESTONES,
  BIG_WIN_R_MILESTONES,
  streakMilestoneBadge,
  monthlyAdherenceBadge,
  profitMilestoneBadge,
  winStreakBadge,
  bigWinBadge,
  resolveBadge,
  isPerformanceBadgeKey,
  STATIC_BADGE_CATALOG,
  PERFORMANCE_BADGE_CATALOG,
} from "@/server/gamification/badgeDefinitions";

describe("streakMilestoneBadge", () => {
  it("builds a badge keyed and worded for the given streak length", () => {
    expect(streakMilestoneBadge(3)).toEqual({
      key: "streak_3",
      label: "3-Trade Discipline Streak",
      description: "Followed your rules on 3 trades in a row.",
    });
  });
});

describe("monthlyAdherenceBadge", () => {
  it("embeds the year-month in the key and the rounded threshold in the description", () => {
    const badge = monthlyAdherenceBadge("2026-07");
    expect(badge.key).toBe("monthly_adherence:2026-07");
    expect(badge.label).toBe("Disciplined Month");
    expect(badge.description).toBe(
      `Averaged ${Math.round(MONTHLY_ADHERENCE_THRESHOLD * 100)}%+ rule adherence across 2026-07.`,
    );
  });
});

describe("resolveBadge", () => {
  it("dispatches monthly_adherence:* keys to monthlyAdherenceBadge regardless of catalog contents", () => {
    expect(resolveBadge("monthly_adherence:2026-01")).toEqual(
      monthlyAdherenceBadge("2026-01"),
    );
  });

  it("resolves a static streak-milestone key from the catalog", () => {
    expect(resolveBadge("streak_10")).toEqual(streakMilestoneBadge(10));
  });

  it("resolves a non-streak static key from the catalog", () => {
    const badge = resolveBadge("disciplined_loss");
    expect(badge.label).toBe("Disciplined Loss");
  });

  it("falls back to an empty-description badge for an unknown key", () => {
    expect(resolveBadge("totally_made_up_key")).toEqual({
      key: "totally_made_up_key",
      label: "totally_made_up_key",
      description: "",
    });
  });
});

describe("STATIC_BADGE_CATALOG", () => {
  it("contains one entry per streak milestone plus disciplined_loss and comeback", () => {
    expect(STATIC_BADGE_CATALOG).toHaveLength(STREAK_MILESTONES.length + 2);
  });

  it("embeds COMEBACK_LENGTH in the comeback badge description", () => {
    const comeback = STATIC_BADGE_CATALOG.find((b) => b.key === "comeback");
    expect(comeback?.description).toContain(String(COMEBACK_LENGTH));
  });
});

describe("profitMilestoneBadge", () => {
  it("builds a badge keyed and worded for the given R milestone", () => {
    expect(profitMilestoneBadge(25)).toEqual({
      key: "profit_25r",
      label: "25R Total Profit",
      description: "Reached 25R in cumulative realized profit across all trades.",
    });
  });
});

describe("winStreakBadge", () => {
  it("builds a badge keyed and worded for the given win-streak length", () => {
    expect(winStreakBadge(5)).toEqual({
      key: "win_streak_5",
      label: "5-Win Streak",
      description: "Won 5 trades in a row.",
    });
  });
});

describe("bigWinBadge", () => {
  it("builds a badge keyed and worded for the given single-trade R threshold", () => {
    expect(bigWinBadge(3)).toEqual({
      key: "big_win_3r",
      label: "3R Trade",
      description: "Hit 3R or more of realized profit on a single trade.",
    });
  });
});

describe("PERFORMANCE_BADGE_CATALOG", () => {
  it("contains one entry per profit, win-streak, and big-win milestone", () => {
    expect(PERFORMANCE_BADGE_CATALOG).toHaveLength(
      PROFIT_R_MILESTONES.length + WIN_STREAK_MILESTONES.length + BIG_WIN_R_MILESTONES.length,
    );
  });
});

describe("isPerformanceBadgeKey", () => {
  it("returns true for profit, win-streak, and big-win keys", () => {
    expect(isPerformanceBadgeKey("profit_25r")).toBe(true);
    expect(isPerformanceBadgeKey("win_streak_5")).toBe(true);
    expect(isPerformanceBadgeKey("big_win_3r")).toBe(true);
  });

  it("returns false for adherence badge keys", () => {
    expect(isPerformanceBadgeKey("streak_3")).toBe(false);
    expect(isPerformanceBadgeKey("disciplined_loss")).toBe(false);
    expect(isPerformanceBadgeKey("comeback")).toBe(false);
    expect(isPerformanceBadgeKey("monthly_adherence:2026-01")).toBe(false);
  });
});

describe("resolveBadge (performance keys)", () => {
  it("resolves a performance badge key from PERFORMANCE_BADGE_CATALOG", () => {
    expect(resolveBadge("profit_10r")).toEqual(profitMilestoneBadge(10));
  });
});
