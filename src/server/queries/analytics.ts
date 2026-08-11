import { tradesCollection, type Trade } from "@/server/firebase/collections";
import { localDateKey } from "@/lib/dates";
import { listActiveMoodTags, listActiveSetupTags } from "@/server/queries/rules";
import { getTradeAdherenceHistory } from "./gamification";

async function closedTrades(): Promise<Trade[]> {
  const snapshot = await tradesCollection().orderBy("entryAt", "asc").get();
  return snapshot.docs.map((doc) => doc.data()).filter((t) => t.status === "closed");
}

export type GroupStats = {
  count: number;
  winRate: number | null;
  avgR: number | null;
  totalPnl: number;
  /** Average pnl per trade (of trades with a recorded pnl) — what this group actually earns per trade. */
  expectancy: number | null;
};

export function summarizeTrades(group: Trade[]): GroupStats {
  const decided = group.filter((t) => t.outcome === "win" || t.outcome === "loss");
  const winRate =
    decided.length > 0 ? decided.filter((t) => t.outcome === "win").length / decided.length : null;
  const rValues = group.map((t) => t.riskRewardRealized).filter((v): v is number => v != null);
  const avgR = rValues.length > 0 ? rValues.reduce((s, v) => s + v, 0) / rValues.length : null;
  const pnlValues = group.map((t) => t.pnl).filter((v): v is number => v != null);
  const totalPnl = pnlValues.reduce((s, v) => s + v, 0);
  const expectancy = pnlValues.length > 0 ? totalPnl / pnlValues.length : null;
  return { count: group.length, winRate, avgR, totalPnl, expectancy };
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

// A trade can carry more than one setup tag, so this can't use the generic
// breakdownBy helper (which assumes one bucket per trade) — a trade with two
// tags should land in both of their buckets. setupTagIds live directly on
// the trade doc, so this no longer needs a separate junction-collection read.
export async function getBreakdownBySetupTag(): Promise<BreakdownGroup[]> {
  const [allTrades, tags] = await Promise.all([closedTrades(), listActiveSetupTags()]);
  const nameById = new Map(tags.map((t) => [t.id, t.name]));

  const buckets = new Map<string, Trade[]>();
  for (const trade of allTrades) {
    for (const tagId of trade.setupTagIds) {
      if (!buckets.has(tagId)) buckets.set(tagId, []);
      buckets.get(tagId)!.push(trade);
    }
  }

  return [...buckets.entries()]
    .map(([tagId, group]) => ({
      key: tagId,
      label: nameById.get(tagId) ?? "Unknown",
      ...summarizeTrades(group),
    }))
    .sort((a, b) => b.count - a.count);
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

export async function getBreakdownByDxyBias(): Promise<BreakdownGroup[]> {
  return breakdownBy(
    (t) => t.dxyBias,
    (bias) => bias.charAt(0).toUpperCase() + bias.slice(1),
  );
}

export async function getBreakdownByNewsNearby(): Promise<BreakdownGroup[]> {
  return breakdownBy(
    (t) => (t.newsNearby ? "yes" : "no"),
    (key) => (key === "yes" ? "News nearby" : "No news nearby"),
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

export type RMultipleBucket = { bucket: string; count: number; totalR: number };

const R_BUCKET_RANGES: { bucket: string; min: number; max: number }[] = [
  { bucket: "< -2R", min: -Infinity, max: -2 },
  { bucket: "-2R to -1R", min: -2, max: -1 },
  { bucket: "-1R to 0R", min: -1, max: 0 },
  { bucket: "0R to 1R", min: 0, max: 1 },
  { bucket: "1R to 2R", min: 1, max: 2 },
  { bucket: "2R to 3R", min: 2, max: 3 },
  { bucket: "3R+", min: 3, max: Infinity },
];

// Fixed half-open numeric buckets — can't reuse the generic breakdownBy
// helper (string-equality buckets). Always returns all buckets, zero-filled,
// so the chart's x-axis is stable. Sorted by bucket order, not count.
export async function getRMultipleDistribution(): Promise<RMultipleBucket[]> {
  const all = await closedTrades();
  const rValues = all.map((t) => t.riskRewardRealized).filter((v): v is number => v != null);

  return R_BUCKET_RANGES.map(({ bucket, min, max }) => {
    const inBucket = rValues.filter((v) => v >= min && v < max);
    return {
      bucket,
      count: inBucket.length,
      totalR: inBucket.reduce((s, v) => s + v, 0),
    };
  });
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

export type DailyPnlPoint = {
  date: string;
  pnl: number;
  r: number;
  tradeCount: number;
  wins: number;
  losses: number;
};

/** month is 1-indexed. Only returns days that actually have trades — the
 * caller fills the rest of the month grid with zero/no-data. */
export async function getDailyPnlForMonth(year: number, month: number): Promise<DailyPnlPoint[]> {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const all = await closedTrades();
  const monthTrades = all.filter((t) => {
    const entry = new Date(t.entryAt);
    return entry >= start && entry < end;
  });

  const byDate = new Map<string, Trade[]>();
  for (const t of monthTrades) {
    const key = localDateKey(new Date(t.entryAt));
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(t);
  }

  return [...byDate.entries()].map(([date, group]) => ({
    date,
    pnl: group.reduce((s, t) => s + (t.pnl ?? 0), 0),
    r: group.reduce((s, t) => s + (t.riskRewardRealized ?? 0), 0),
    tradeCount: group.length,
    wins: group.filter((t) => t.outcome === "win").length,
    losses: group.filter((t) => t.outcome === "loss").length,
  }));
}
