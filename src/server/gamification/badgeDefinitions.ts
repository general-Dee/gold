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
    STATIC_BADGE_CATALOG.find((b) => b.key === key) ?? {
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
