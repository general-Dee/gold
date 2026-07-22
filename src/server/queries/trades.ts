import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { rules, tradeImages, tradeRuleChecks, trades } from "@/server/db/schema";
import { plannedRiskReward, realizedRiskReward } from "@/lib/calculations";
import type { TradeInput } from "@/lib/validation";

export async function listTrades() {
  return db.select().from(trades).orderBy(desc(trades.entryAt));
}

export async function getTradeById(id: string) {
  const [trade] = await db.select().from(trades).where(eq(trades.id, id));
  if (!trade) return null;

  const checks = await db
    .select()
    .from(tradeRuleChecks)
    .where(eq(tradeRuleChecks.tradeId, id));

  const images = await db.select().from(tradeImages).where(eq(tradeImages.tradeId, id));

  return { trade, checks, images };
}

async function snapshotRuleChecks(tradeId: string, ruleChecks: TradeInput["ruleChecks"]) {
  if (ruleChecks.length === 0) return;

  const ruleRows = await db.select().from(rules);
  const ruleTextById = new Map(ruleRows.map((r) => [r.id, r.text]));

  const values = ruleChecks
    .filter((c) => ruleTextById.has(c.ruleId))
    .map((c) => ({
      tradeId,
      ruleId: c.ruleId,
      ruleTextSnapshot: ruleTextById.get(c.ruleId)!,
      status: c.status,
    }));

  if (values.length > 0) {
    await db.insert(tradeRuleChecks).values(values);
  }
}

export async function createTrade(input: TradeInput) {
  const riskRewardPlanned = plannedRiskReward(input);
  const riskRewardRealized = realizedRiskReward({
    direction: input.direction,
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    exitPrice: input.exitPrice ?? null,
  });

  const [trade] = await db
    .insert(trades)
    .values({
      direction: input.direction,
      instrument: input.instrument,
      status: input.status,
      entryPrice: input.entryPrice,
      exitPrice: input.exitPrice ?? null,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit ?? null,
      positionSize: input.positionSize,
      riskRewardPlanned,
      riskRewardRealized,
      outcome: input.outcome ?? null,
      pnl: input.pnl ?? null,
      setupTagId: input.setupTagId ?? null,
      session: input.session,
      dxyBias: input.dxyBias ?? null,
      newsNearby: input.newsNearby,
      newsNote: input.newsNote ?? null,
      moodBeforeId: input.moodBeforeId ?? null,
      moodAfterId: input.moodAfterId ?? null,
      reasoning: input.reasoning ?? null,
      notesAfter: input.notesAfter ?? null,
      entryAt: input.entryAt,
      exitAt: input.exitAt ?? null,
    })
    .returning();

  await snapshotRuleChecks(trade.id, input.ruleChecks);

  return trade;
}

export async function updateTrade(id: string, input: TradeInput) {
  const riskRewardPlanned = plannedRiskReward(input);
  const riskRewardRealized = realizedRiskReward({
    direction: input.direction,
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    exitPrice: input.exitPrice ?? null,
  });

  const [trade] = await db
    .update(trades)
    .set({
      direction: input.direction,
      instrument: input.instrument,
      status: input.status,
      entryPrice: input.entryPrice,
      exitPrice: input.exitPrice ?? null,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit ?? null,
      positionSize: input.positionSize,
      riskRewardPlanned,
      riskRewardRealized,
      outcome: input.outcome ?? null,
      pnl: input.pnl ?? null,
      setupTagId: input.setupTagId ?? null,
      session: input.session,
      dxyBias: input.dxyBias ?? null,
      newsNearby: input.newsNearby,
      newsNote: input.newsNote ?? null,
      moodBeforeId: input.moodBeforeId ?? null,
      moodAfterId: input.moodAfterId ?? null,
      reasoning: input.reasoning ?? null,
      notesAfter: input.notesAfter ?? null,
      entryAt: input.entryAt,
      exitAt: input.exitAt ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(trades.id, id))
    .returning();

  // Replace checklist responses wholesale on edit — simpler and correct
  // since a trade edit re-snapshots against current rule text anyway.
  await db.delete(tradeRuleChecks).where(eq(tradeRuleChecks.tradeId, id));
  await snapshotRuleChecks(id, input.ruleChecks);

  return trade;
}
