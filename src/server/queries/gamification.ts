import { badgeUnlocksCollection, tradesCollection } from "@/server/firebase/collections";

export type TradeAdherence = {
  tradeId: string;
  entryAt: string;
  followed: number;
  notFollowed: number;
  notApplicable: number;
  /** Adherent means zero broken rules on this trade — checklist coverage is not required. */
  isAdherent: boolean;
  /** followed / (followed + notFollowed); null when no applicable checklist items exist. */
  adherenceRatio: number | null;
  outcome: string | null;
  riskRewardRealized: number | null;
};

// Intentionally includes open trades — rule adherence is knowable at entry
// time, independent of whether the trade has closed yet.
export async function getTradeAdherenceHistory(): Promise<TradeAdherence[]> {
  const snapshot = await tradesCollection().orderBy("entryAt", "asc").get();

  return snapshot.docs.map((doc) => {
    const t = doc.data();
    const checks = t.ruleChecks;
    const followed = checks.filter((c) => c.status === "followed").length;
    const notFollowed = checks.filter((c) => c.status === "not_followed").length;
    const notApplicable = checks.filter((c) => c.status === "not_applicable").length;
    const applicable = followed + notFollowed;
    return {
      tradeId: t.id,
      entryAt: t.entryAt,
      followed,
      notFollowed,
      notApplicable,
      isAdherent: notFollowed === 0,
      adherenceRatio: applicable > 0 ? followed / applicable : null,
      outcome: t.outcome,
      riskRewardRealized: t.riskRewardRealized,
    };
  });
}

/** Streak = consecutive adherent trades in chronological order; one broken rule resets it to 0. */
export function computeStreaks(history: TradeAdherence[]) {
  let streak = 0;
  let longest = 0;
  const streakAtTrade: number[] = [];
  for (const t of history) {
    streak = t.isAdherent ? streak + 1 : 0;
    longest = Math.max(longest, streak);
    streakAtTrade.push(streak);
  }
  return { streakAtTrade, currentStreak: streak, longestStreak: longest };
}

export async function getCurrentStreak() {
  const history = await getTradeAdherenceHistory();
  return computeStreaks(history).currentStreak;
}

export async function getLongestStreak() {
  const history = await getTradeAdherenceHistory();
  return computeStreaks(history).longestStreak;
}

export type TradeOutcomePoint = { tradeId: string; entryAt: string; outcome: "win" | "loss" | "breakeven" };

// Chronological (entryAt asc), excludes open trades (outcome null) — unlike
// getTradeAdherenceHistory, which intentionally includes them. Win/loss
// streaks are only meaningful once a trade has resolved.
export async function getTradeOutcomeHistory(): Promise<TradeOutcomePoint[]> {
  const snapshot = await tradesCollection().orderBy("entryAt", "asc").get();
  return snapshot.docs
    .map((doc) => doc.data())
    .filter((t): t is typeof t & { outcome: "win" | "loss" | "breakeven" } => t.outcome != null)
    .map((t) => ({ tradeId: t.id, entryAt: t.entryAt, outcome: t.outcome }));
}

export type TradeOutcomeStreaks = {
  currentStreak: number;
  currentStreakType: "win" | "loss" | null;
  longestWinStreak: number;
  longestLossStreak: number;
};

// Two independent forward-loop counters (win/loss), each reset by the other
// outcome AND by breakeven. Kept as its own loop rather than reusing
// computeStreaks — mirrors this file's existing convention of duplicating
// streak logic per system rather than coupling them (see checklist.ts).
export function computeOutcomeStreaks(history: TradeOutcomePoint[]): TradeOutcomeStreaks {
  let winStreak = 0;
  let lossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;

  for (const t of history) {
    winStreak = t.outcome === "win" ? winStreak + 1 : 0;
    lossStreak = t.outcome === "loss" ? lossStreak + 1 : 0;
    longestWinStreak = Math.max(longestWinStreak, winStreak);
    longestLossStreak = Math.max(longestLossStreak, lossStreak);
  }

  const currentStreakType = winStreak > 0 ? "win" : lossStreak > 0 ? "loss" : null;
  const currentStreak = winStreak > 0 ? winStreak : lossStreak;

  return { currentStreak, currentStreakType, longestWinStreak, longestLossStreak };
}

export async function getTradeOutcomeStreaks(): Promise<TradeOutcomeStreaks> {
  const history = await getTradeOutcomeHistory();
  return computeOutcomeStreaks(history);
}

export async function getMonthlyAverageAdherence(yearMonth: string) {
  const history = await getTradeAdherenceHistory();
  const monthTrades = history.filter(
    (t) => t.entryAt.startsWith(yearMonth) && t.adherenceRatio !== null,
  );
  if (monthTrades.length === 0) return null;
  const sum = monthTrades.reduce((s, t) => s + (t.adherenceRatio ?? 0), 0);
  return sum / monthTrades.length;
}

export async function getBadgeUnlocks() {
  const snapshot = await badgeUnlocksCollection().orderBy("unlockedAt", "asc").get();
  return snapshot.docs.map((doc) => doc.data());
}

export type TradeViolation = { tradeId: string; entryAt: string; violatedRules: string[] };

/** Rules broken on the most recently logged trade, or null if it's clean (or there are no trades).
 * Intentionally includes open trades — a violation should surface as soon as it's logged. */
export async function getMostRecentTradeViolations(): Promise<TradeViolation | null> {
  const snapshot = await tradesCollection().orderBy("entryAt", "desc").limit(1).get();
  if (snapshot.empty) return null;
  const mostRecent = snapshot.docs[0]!.data();

  const violatedRules = mostRecent.ruleChecks
    .filter((c) => c.status === "not_followed")
    .map((c) => c.ruleTextSnapshot);

  if (violatedRules.length === 0) return null;
  return { tradeId: mostRecent.id, entryAt: mostRecent.entryAt, violatedRules };
}
