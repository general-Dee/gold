export const DIRECTIONS = ["long", "short"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const TRADE_STATUSES = ["open", "closed"] as const;
export type TradeStatus = (typeof TRADE_STATUSES)[number];

export const OUTCOMES = ["win", "loss", "breakeven"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const SESSIONS = ["asian", "london", "ny", "overlap", "other"] as const;
export type Session = (typeof SESSIONS)[number];

export const DXY_BIASES = ["up", "down", "flat"] as const;
export type DxyBias = (typeof DXY_BIASES)[number];

export const CHECK_STATUSES = ["followed", "not_followed", "not_applicable"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

export const DEFAULT_RULES = [
  "Waited for session open (no pre-market impulse entries)",
  "Risk sized at or below 1% of account",
  "Checked DXY correlation before entry",
  "No trading within 15 minutes of high-impact news",
  "Stop loss placed before entering the trade",
  "Max 2 trades today",
];

export const DEFAULT_SETUP_TAGS = [
  "London breakout",
  "NY reversal",
  "Asian range fade",
  "Trend continuation",
  "News spike fade",
];

export const DEFAULT_MOOD_TAGS: { name: string; category: "before" | "after" | "both" }[] = [
  { name: "Calm", category: "both" },
  { name: "Confident", category: "both" },
  { name: "Anxious", category: "both" },
  { name: "FOMO", category: "before" },
  { name: "Tilted", category: "after" },
  { name: "Relieved", category: "after" },
];

/** UTC hour ranges used to suggest a session from a trade's entry time. */
export function sessionFromEntryTime(entryAt: Date): Session {
  const hour = entryAt.getUTCHours();
  const inAsian = hour >= 0 && hour < 8;
  const inLondon = hour >= 7 && hour < 16;
  const inNy = hour >= 12 && hour < 21;

  if (inLondon && inNy) return "overlap";
  if (inLondon) return "london";
  if (inNy) return "ny";
  if (inAsian) return "asian";
  return "other";
}
