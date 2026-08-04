import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { badgeUnlocks, tradeRuleChecks, trades } from "@/server/db/schema";

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
  const allTrades = await db.select().from(trades).orderBy(asc(trades.entryAt));
  const allChecks = await db.select().from(tradeRuleChecks);

  const checksByTrade = new Map<string, typeof allChecks>();
  for (const c of allChecks) {
    const list = checksByTrade.get(c.tradeId) ?? [];
    list.push(c);
    checksByTrade.set(c.tradeId, list);
  }

  return allTrades.map((t) => {
    const checks = checksByTrade.get(t.id) ?? [];
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
  return db.select().from(badgeUnlocks).orderBy(asc(badgeUnlocks.unlockedAt));
}

export type TradeViolation = { tradeId: string; entryAt: string; violatedRules: string[] };

/** Rules broken on the most recently logged trade, or null if it's clean (or there are no trades).
 * Intentionally includes open trades — a violation should surface as soon as it's logged. */
export async function getMostRecentTradeViolations(): Promise<TradeViolation | null> {
  const [mostRecent] = await db.select().from(trades).orderBy(desc(trades.entryAt)).limit(1);
  if (!mostRecent) return null;

  const checks = await db
    .select()
    .from(tradeRuleChecks)
    .where(eq(tradeRuleChecks.tradeId, mostRecent.id));
  const violatedRules = checks
    .filter((c) => c.status === "not_followed")
    .map((c) => c.ruleTextSnapshot);

  if (violatedRules.length === 0) return null;
  return { tradeId: mostRecent.id, entryAt: mostRecent.entryAt, violatedRules };
}
