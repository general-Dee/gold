import { asc } from "drizzle-orm";
import { db } from "@/server/db/client";
import { trades } from "@/server/db/schema";
import { getTradeAdherenceHistory } from "./gamification";

async function closedTrades() {
  return db.select().from(trades).orderBy(asc(trades.entryAt));
}

export async function getWinRate() {
  const all = await closedTrades();
  const withOutcome = all.filter((t) => t.outcome === "win" || t.outcome === "loss");
  if (withOutcome.length === 0) return null;
  const wins = withOutcome.filter((t) => t.outcome === "win").length;
  return wins / withOutcome.length;
}

export async function getAverageRiskReward(kind: "planned" | "realized") {
  const all = await closedTrades();
  const key = kind === "planned" ? "riskRewardPlanned" : "riskRewardRealized";
  const values = all.map((t) => t[key]).filter((v): v is number => v != null);
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export type EquityPoint = {
  tradeId: string;
  entryAt: string;
  cumulativePnl: number;
  cumulativeR: number;
};

export async function getEquityCurve(): Promise<EquityPoint[]> {
  const all = await closedTrades();
  let pnl = 0;
  let r = 0;
  return all.map((t) => {
    pnl += t.pnl ?? 0;
    r += t.riskRewardRealized ?? 0;
    return { tradeId: t.id, entryAt: t.entryAt, cumulativePnl: pnl, cumulativeR: r };
  });
}

export type AdherencePoint = { tradeId: string; entryAt: string; adherenceRatio: number | null };

export async function getAdherenceTrend(): Promise<AdherencePoint[]> {
  const history = await getTradeAdherenceHistory();
  return history.map((h) => ({
    tradeId: h.tradeId,
    entryAt: h.entryAt,
    adherenceRatio: h.adherenceRatio,
  }));
}

export async function get30DayAdherence() {
  const history = await getTradeAdherenceHistory();
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = history.filter(
    (h) => new Date(h.entryAt).getTime() >= cutoff && h.adherenceRatio !== null,
  );
  if (recent.length === 0) return null;
  return recent.reduce((s, h) => s + (h.adherenceRatio ?? 0), 0) / recent.length;
}

/** The "aha" view: does following your rules actually correlate with better outcomes? */
export async function getAdherenceCorrelation() {
  const history = await getTradeAdherenceHistory();
  const all = await closedTrades();
  const outcomeByTrade = new Map(all.map((t) => [t.id, { outcome: t.outcome, r: t.riskRewardRealized }]));

  const adherent = history.filter((h) => h.isAdherent);
  const nonAdherent = history.filter((h) => !h.isAdherent);

  const summarize = (group: typeof history) => {
    const withOutcome = group
      .map((h) => outcomeByTrade.get(h.tradeId))
      .filter((o): o is { outcome: string | null; r: number | null } => !!o);
    const decided = withOutcome.filter((o) => o.outcome === "win" || o.outcome === "loss");
    const winRate = decided.length > 0 ? decided.filter((o) => o.outcome === "win").length / decided.length : null;
    const rValues = withOutcome.map((o) => o.r).filter((v): v is number => v != null);
    const avgR = rValues.length > 0 ? rValues.reduce((s, v) => s + v, 0) / rValues.length : null;
    return { count: group.length, winRate, avgR };
  };

  return {
    adherent: summarize(adherent),
    nonAdherent: summarize(nonAdherent),
  };
}
