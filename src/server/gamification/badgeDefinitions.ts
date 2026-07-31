export const STREAK_MILESTONES = [3, 10, 25, 50] as const;
export const COMEBACK_LENGTH = 5;
export const MONTHLY_ADHERENCE_THRESHOLD = 0.9;

export type BadgeCatalogEntry = {
  key: string;
  label: string;
  description: string;
};

export function streakMilestoneBadge(n: number): BadgeCatalogEntry {
  return {
    key: `streak_${n}`,
    label: `${n}-Trade Discipline Streak`,
    description: `Followed your rules on ${n} trades in a row.`,
  };
}

export function monthlyAdherenceBadge(yearMonth: string): BadgeCatalogEntry {
  return {
    key: `monthly_adherence:${yearMonth}`,
    label: "Disciplined Month",
    description: `Averaged ${Math.round(
      MONTHLY_ADHERENCE_THRESHOLD * 100,
    )}%+ rule adherence across ${yearMonth}.`,
  };
}

export function resolveBadge(key: string): BadgeCatalogEntry {
  if (key.startsWith("monthly_adherence:")) {
    return monthlyAdherenceBadge(key.slice("monthly_adherence:".length));
  }
  return (
    STATIC_BADGE_CATALOG.find((b) => b.key === key) ??
    PERFORMANCE_BADGE_CATALOG.find((b) => b.key === key) ?? {
      key,
      label: key,
      description: "",
    }
  );
}

export const STATIC_BADGE_CATALOG: BadgeCatalogEntry[] = [
  ...STREAK_MILESTONES.map(streakMilestoneBadge),
  {
    key: "disciplined_loss",
    label: "Disciplined Loss",
    description: "Followed every rule on a trade that still lost — good process, bad outcome.",
  },
  {
    key: "comeback",
    label: "Comeback",
    description: `Rebuilt a fresh ${COMEBACK_LENGTH}-trade discipline streak after a break.`,
  },
];

// Performance badges — based on realized P&L, not rule-adherence. Kept in a
// separate catalog (and surfaced in their own UI section) so they never mix
// with the adherence badges' "never by profit" framing.
export const PROFIT_R_MILESTONES = [10, 25, 50, 100] as const;
export const WIN_STREAK_MILESTONES = [3, 5, 10] as const;
export const BIG_WIN_R_MILESTONES = [3, 5, 10] as const;

export function profitMilestoneBadge(n: number): BadgeCatalogEntry {
  return {
    key: `profit_${n}r`,
    label: `${n}R Total Profit`,
    description: `Reached ${n}R in cumulative realized profit across all trades.`,
  };
}

export function winStreakBadge(n: number): BadgeCatalogEntry {
  return {
    key: `win_streak_${n}`,
    label: `${n}-Win Streak`,
    description: `Won ${n} trades in a row.`,
  };
}

export function bigWinBadge(n: number): BadgeCatalogEntry {
  return {
    key: `big_win_${n}r`,
    label: `${n}R Trade`,
    description: `Hit ${n}R or more of realized profit on a single trade.`,
  };
}

export const PERFORMANCE_BADGE_CATALOG: BadgeCatalogEntry[] = [
  ...PROFIT_R_MILESTONES.map(profitMilestoneBadge),
  ...WIN_STREAK_MILESTONES.map(winStreakBadge),
  ...BIG_WIN_R_MILESTONES.map(bigWinBadge),
];

export function isPerformanceBadgeKey(key: string): boolean {
  return key.startsWith("profit_") || key.startsWith("win_streak_") || key.startsWith("big_win_");
}
