import { nanoid } from "@/server/firebase/ids";
import { runBatch } from "@/server/firebase/batch";
import { badgeUnlocksCollection, type BadgeUnlock } from "@/server/firebase/collections";
import {
  computeStreaks,
  getTradeAdherenceHistory,
  type TradeAdherence,
} from "@/server/queries/gamification";
import {
  BIG_WIN_R_MILESTONES,
  COMEBACK_LENGTH,
  LOSS_STREAK_MILESTONES,
  MONTHLY_ADHERENCE_THRESHOLD,
  PROFIT_R_MILESTONES,
  STREAK_MILESTONES,
  WIN_STREAK_MILESTONES,
  bigWinBadge,
  lossStreakBadge,
  monthlyAdherenceBadge,
  profitMilestoneBadge,
  streakMilestoneBadge,
  winStreakBadge,
} from "./badgeDefinitions";

type NewUnlock = { badgeKey: string; tradeId: string | null };

/**
 * Recomputes badge state from the full trade history and inserts any newly
 * earned unlocks. Full recompute (rather than incremental) keeps edits to
 * past trades correct — the engine never touches pnl/outcome/trade-count,
 * only rule-adherence, per the anti-overtrading design in the project plan.
 */
export async function evaluateBadgesForTrade(tradeId: string) {
  const history = await getTradeAdherenceHistory();
  const { streakAtTrade } = computeStreaks(history);

  const existing = (await badgeUnlocksCollection().get()).docs.map((doc) => doc.data());
  const existingByKey = new Map<string, typeof existing>();
  for (const u of existing) {
    const list = existingByKey.get(u.badgeKey) ?? [];
    list.push(u);
    existingByKey.set(u.badgeKey, list);
  }
  const hasKey = (key: string) => existingByKey.has(key);
  const hasKeyForTrade = (key: string, tid: string) =>
    (existingByKey.get(key) ?? []).some((u) => u.tradeId === tid);

  const toInsert: NewUnlock[] = [];

  for (const n of STREAK_MILESTONES) {
    const badge = streakMilestoneBadge(n);
    if (hasKey(badge.key)) continue;
    const idx = streakAtTrade.findIndex((s) => s >= n);
    if (idx !== -1) {
      toInsert.push({ badgeKey: badge.key, tradeId: history[idx].tradeId });
    }
  }

  for (const t of history) {
    if (t.outcome === "loss" && t.followed > 0 && t.notFollowed === 0) {
      if (!hasKeyForTrade("disciplined_loss", t.tradeId)) {
        toInsert.push({ badgeKey: "disciplined_loss", tradeId: t.tradeId });
      }
    }
  }

  let sawBreakBefore = false;
  for (let i = 0; i < history.length; i++) {
    const t = history[i];
    if (streakAtTrade[i] === COMEBACK_LENGTH && sawBreakBefore) {
      if (!hasKeyForTrade("comeback", t.tradeId)) {
        toInsert.push({ badgeKey: "comeback", tradeId: t.tradeId });
      }
    }
    if (!t.isAdherent) sawBreakBefore = true;
  }

  const months = new Set(history.map((t) => t.entryAt.slice(0, 7)));
  for (const month of months) {
    const monthTrades = history.filter(
      (t) => t.entryAt.startsWith(month) && t.adherenceRatio !== null,
    );
    if (monthTrades.length === 0) continue;
    const avg = monthTrades.reduce((s, t) => s + (t.adherenceRatio ?? 0), 0) / monthTrades.length;
    if (avg >= MONTHLY_ADHERENCE_THRESHOLD) {
      const badge = monthlyAdherenceBadge(month);
      if (!hasKey(badge.key)) {
        const lastTradeOfMonth = monthTrades[monthTrades.length - 1];
        toInsert.push({ badgeKey: badge.key, tradeId: lastTradeOfMonth.tradeId });
      }
    }
  }

  // Performance badges — based on realized R, not rule-adherence (see
  // badgeDefinitions.ts). Kept separate from the discipline badges above.

  const cumulativeRAtTrade: number[] = [];
  let runningR = 0;
  for (const t of history) {
    runningR += t.riskRewardRealized ?? 0;
    cumulativeRAtTrade.push(runningR);
  }
  for (const n of PROFIT_R_MILESTONES) {
    const badge = profitMilestoneBadge(n);
    if (hasKey(badge.key)) continue;
    const idx = cumulativeRAtTrade.findIndex((r) => r >= n);
    if (idx !== -1) toInsert.push({ badgeKey: badge.key, tradeId: history[idx].tradeId });
  }

  const streakArray = (predicate: (t: TradeAdherence) => boolean): number[] => {
    let streak = 0;
    return history.map((t) => (streak = predicate(t) ? streak + 1 : 0));
  };
  const winStreakAtTrade = streakArray((t) => t.outcome === "win");
  for (const n of WIN_STREAK_MILESTONES) {
    const badge = winStreakBadge(n);
    if (hasKey(badge.key)) continue;
    const idx = winStreakAtTrade.findIndex((s) => s >= n);
    if (idx !== -1) toInsert.push({ badgeKey: badge.key, tradeId: history[idx].tradeId });
  }

  const lossStreakAtTrade = streakArray((t) => t.outcome === "loss");
  for (const n of LOSS_STREAK_MILESTONES) {
    const badge = lossStreakBadge(n);
    if (hasKey(badge.key)) continue;
    const idx = lossStreakAtTrade.findIndex((s) => s >= n);
    if (idx !== -1) toInsert.push({ badgeKey: badge.key, tradeId: history[idx].tradeId });
  }

  for (const t of history) {
    if (t.riskRewardRealized == null) continue;
    for (const n of BIG_WIN_R_MILESTONES) {
      const badge = bigWinBadge(n);
      if (t.riskRewardRealized >= n && !hasKeyForTrade(badge.key, t.tradeId)) {
        toInsert.push({ badgeKey: badge.key, tradeId: t.tradeId });
      }
    }
  }

  if (toInsert.length > 0) {
    const now = new Date().toISOString();
    await runBatch((batch) => {
      for (const u of toInsert) {
        const row: BadgeUnlock = { id: nanoid(), badgeKey: u.badgeKey, tradeId: u.tradeId, unlockedAt: now };
        batch.set(badgeUnlocksCollection().doc(row.id), row);
      }
    });
  }

  return toInsert.filter((u) => u.tradeId === tradeId);
}
