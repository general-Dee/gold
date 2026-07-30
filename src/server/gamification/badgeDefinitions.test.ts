import { describe, it, expect } from "vitest";
import {
  STREAK_MILESTONES,
  COMEBACK_LENGTH,
  MONTHLY_ADHERENCE_THRESHOLD,
  streakMilestoneBadge,
  monthlyAdherenceBadge,
  resolveBadge,
  STATIC_BADGE_CATALOG,
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
