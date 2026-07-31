import { unlink } from "node:fs/promises";
import path from "node:path";
import { and, desc, eq, gte, inArray, like, lte, or } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
  badgeUnlocks,
  rules,
  tradeImages,
  tradeRuleChecks,
  tradeSetupTags,
  trades,
} from "@/server/db/schema";
import { plannedRiskReward, realizedRiskReward } from "@/lib/calculations";
import type { Direction, Outcome, Session } from "@/lib/constants";
import type { TradeInput } from "@/lib/validation";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

export type TradeFilters = {
  from?: string;
  to?: string;
  direction?: Direction;
  outcome?: Outcome;
  session?: Session;
  setupTagId?: string;
  q?: string;
};

export async function listTrades(filters: TradeFilters = {}) {
  const conditions = [];
  if (filters.from) conditions.push(gte(trades.entryAt, filters.from));
  if (filters.to) conditions.push(lte(trades.entryAt, filters.to));
  if (filters.direction) conditions.push(eq(trades.direction, filters.direction));
  if (filters.outcome) conditions.push(eq(trades.outcome, filters.outcome));
  if (filters.session) conditions.push(eq(trades.session, filters.session));
  if (filters.setupTagId) {
    const links = await db
      .select({ tradeId: tradeSetupTags.tradeId })
      .from(tradeSetupTags)
      .where(eq(tradeSetupTags.setupTagId, filters.setupTagId));
    if (links.length === 0) return [];
    conditions.push(
      inArray(
        trades.id,
        links.map((l) => l.tradeId),
      ),
    );
  }
  if (filters.q) {
    const pattern = `%${filters.q}%`;
    conditions.push(
      or(
        like(trades.reasoning, pattern),
        like(trades.notesAfter, pattern),
        like(trades.newsNote, pattern),
      ),
    );
  }

  return db
    .select()
    .from(trades)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(trades.entryAt));
}

/** All trade -> setup tag id associations, grouped by trade id — used by
 * bulk views (e.g. the CSV export) that need every trade's tags at once. */
export async function listSetupTagIdsByTradeId(): Promise<Map<string, string[]>> {
  const links = await db.select().from(tradeSetupTags);
  const map = new Map<string, string[]>();
  for (const link of links) {
    if (!map.has(link.tradeId)) map.set(link.tradeId, []);
    map.get(link.tradeId)!.push(link.setupTagId);
  }
  return map;
}

export async function getTradeById(id: string) {
  const [trade] = await db.select().from(trades).where(eq(trades.id, id));
  if (!trade) return null;

  const checks = await db
    .select()
    .from(tradeRuleChecks)
    .where(eq(tradeRuleChecks.tradeId, id));

  const images = await db.select().from(tradeImages).where(eq(tradeImages.tradeId, id));

  const setupTagLinks = await db
    .select()
    .from(tradeSetupTags)
    .where(eq(tradeSetupTags.tradeId, id));

  return { trade, checks, images, setupTagIds: setupTagLinks.map((l) => l.setupTagId) };
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

async function linkSetupTags(tradeId: string, setupTagIds: string[]) {
  const uniqueIds = [...new Set(setupTagIds)];
  if (uniqueIds.length === 0) return;
  await db.insert(tradeSetupTags).values(uniqueIds.map((setupTagId) => ({ tradeId, setupTagId })));
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
  await linkSetupTags(trade.id, input.setupTagIds);

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

  await db.delete(tradeSetupTags).where(eq(tradeSetupTags.tradeId, id));
  await linkSetupTags(id, input.setupTagIds);

  return trade;
}

export async function deleteTrade(id: string) {
  const images = await db.select().from(tradeImages).where(eq(tradeImages.tradeId, id));

  // badgeUnlocks.tradeId is ON DELETE no action, so it must be detached before
  // the trade row goes away — nullify rather than delete, since an earned badge
  // shouldn't be revoked just because its trade record was removed.
  await db.update(badgeUnlocks).set({ tradeId: null }).where(eq(badgeUnlocks.tradeId, id));

  // tradeRuleChecks and tradeImages cascade-delete with the trade.
  await db.delete(trades).where(eq(trades.id, id));

  await Promise.all(
    images.map(async (img) => {
      try {
        await unlink(path.join(UPLOADS_DIR, img.filePath));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
    }),
  );
}
