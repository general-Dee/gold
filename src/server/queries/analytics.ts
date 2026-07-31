import { asc } from "drizzle-orm";
import { db } from "@/server/db/client";
import { trades } from "@/server/db/schema";
import { listActiveMoodTags, listActiveSetupTags } from "@/server/queries/rules";
import { getTradeAdherenceHistory } from "./gamification";

type Trade = typeof trades.$inferSelect;

async function closedTrades() {
  return db.select().from(trades).orderBy(asc(trades.entryAt));
}

export type GroupStats = { count: number; winRate: number | null; avgR: number | null };

function summarizeTrades(group: Trade[]): GroupStats {
  const decided = group.filter((t) => t.outcome === "win" || t.outcome === "loss");
  const winRate =
    decided.length > 0 ? decided.filter((t) => t.outcome === "win").length / decided.length : null;
  const rValues = group.map((t) => t.riskRewardRealized).filter((v): v is number => v != null);
  const avgR = rValues.length > 0 ? rValues.reduce((s, v) => s + v, 0) / rValues.length : null;
  return { count: group.length, winRate, avgR };
}

export type BreakdownGroup = { key: string; label: string } & GroupStats;

async function breakdownBy(
  keyFn: (t: Trade) => string | null,
  labelFor: (key: string) => string,
): Promise<BreakdownGroup[]> {
  const all = await closedTrades();
  const buckets = new Map<string, Trade[]>();
  for (const t of all) {
    const key = keyFn(t);
    if (key == null) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(t);
  }
  return [...buckets.entries()]
    .map(([key, group]) => ({ key, label: labelFor(key), ...summarizeTrades(group) }))
    .sort((a, b) => b.count - a.count);
}

export async function getBreakdownBySetupTag(): Promise<BreakdownGroup[]> {
  const tags = await listActiveSetupTags();
  const nameById = new Map(tags.map((t) => [t.id, t.name]));
  return breakdownBy(
    (t) => t.setupTagId,
    (id) => nameById.get(id) ?? "Unknown",
  );
}

export async function getBreakdownBySession(): Promise<BreakdownGroup[]> {
  return breakdownBy(
    (t) => t.session,
    (s) => s,
  );
}

export async function getBreakdownByMoodBefore(): Promise<BreakdownGroup[]> {
  const moods = await listActiveMoodTags();
  const nameById = new Map(moods.map((m) => [m.id, m.name]));
  return breakdownBy(
    (t) => t.moodBeforeId,
    (id) => nameById.get(id) ?? "Unknown",
  );
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function getBreakdownByDayOfWeek(): Promise<BreakdownGroup[]> {
  const result = await breakdownBy(
    (t) => String(new Date(t.entryAt).getDay()),
    (key) => DAY_LABELS[Number(key)],
  );
  return result.sort((a, b) => Number(a.key) - Number(b.key));
}

export async function getMaxDrawdown(): Promise<{ maxDrawdownPnl: number; maxDrawdownR: number } | null> {
  const curve = await getEquityCurve();
  if (curve.length === 0) return null;

  const drawdown = (values: number[]) => {
    let peak = -Infinity;
    let maxDd = 0;
    for (const v of values) {
      peak = Math.max(peak, v);
      maxDd = Math.max(maxDd, peak - v);
    }
    return maxDd;
  };

  return {
    maxDrawdownPnl: drawdown(curve.map((p) => p.cumulativePnl)),
    maxDrawdownR: drawdown(curve.map((p) => p.cumulativeR)),
  };
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
  const tradeById = new Map(all.map((t) => [t.id, t]));

  const tradesFor = (group: typeof history) =>
    group.map((h) => tradeById.get(h.tradeId)).filter((t): t is Trade => t != null);

  return {
    adherent: summarizeTrades(tradesFor(history.filter((h) => h.isAdherent))),
    nonAdherent: summarizeTrades(tradesFor(history.filter((h) => !h.isAdherent))),
  };
}
