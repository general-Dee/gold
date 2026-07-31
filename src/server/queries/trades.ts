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
import { rowsFromCsv } from "@/lib/csv";
import type { Direction, Outcome, Session } from "@/lib/constants";
import { tradeImportRowSchema, type TradeInput } from "@/lib/validation";
import {
  createMoodTag,
  createSetupTag,
  listActiveMoodTags,
  listActiveSetupTags,
} from "@/server/queries/rules";
import { evaluateBadgesForTrade } from "@/server/gamification/evaluate";

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

export type ImportResult = {
  importedCount: number;
  skipped: { row: number; reason: string }[];
  createdSetupTags: string[];
  createdMoodTags: string[];
};

const IMPORT_REQUIRED_HEADERS = [
  "entryAt",
  "direction",
  "entryPrice",
  "stopLoss",
  "positionSize",
  "session",
];

function normalizeTagName(name: string) {
  return name.trim().toLowerCase();
}

/** Resolves a tag/mood name to an id against a case-insensitive name map,
 * auto-creating it (and recording the creation) if it isn't already known. */
async function resolveOrCreateTag(
  rawName: string,
  byName: Map<string, string>,
  created: string[],
  create: (name: string) => Promise<{ id: string }>,
): Promise<string> {
  const key = normalizeTagName(rawName);
  const existing = byName.get(key);
  if (existing) return existing;

  const row = await create(rawName.trim());
  byName.set(key, row.id);
  created.push(rawName.trim());
  return row.id;
}

/**
 * Parses a CSV export back into trades. Row-level validation: invalid rows
 * are reported in `skipped` rather than aborting the whole file, since the
 * likely failure mode is one typo in an otherwise-good hand-edited export.
 * Unknown setup/mood tag names are auto-created rather than rejected.
 */
export async function importTradesFromCsv(text: string): Promise<ImportResult> {
  const { headers, rows } = rowsFromCsv(text);

  const missingHeaders = IMPORT_REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    throw new Error(
      `This doesn't look like a trades export — missing column(s): ${missingHeaders.join(", ")}.`,
    );
  }

  const skipped: ImportResult["skipped"] = [];
  const parsedRows: { row: number; data: ReturnType<typeof tradeImportRowSchema.parse> }[] = [];

  rows.forEach((cells, i) => {
    const record: Record<string, string | undefined> = {};
    headers.forEach((header, col) => {
      const value = cells[col];
      record[header] = value === "" || value === undefined ? undefined : value;
    });

    const rowNumber = i + 2; // +1 for 0-index, +1 for the header line
    const result = tradeImportRowSchema.safeParse(record);
    if (!result.success) {
      const reason = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      skipped.push({ row: rowNumber, reason });
      return;
    }
    parsedRows.push({ row: rowNumber, data: result.data });
  });

  const [existingSetupTags, existingMoodTags] = await Promise.all([
    listActiveSetupTags(),
    listActiveMoodTags(),
  ]);
  const setupTagsByName = new Map(existingSetupTags.map((t) => [normalizeTagName(t.name), t.id]));
  const moodTagsByName = new Map(existingMoodTags.map((t) => [normalizeTagName(t.name), t.id]));
  const createdSetupTags: string[] = [];
  const createdMoodTags: string[] = [];

  let importedCount = 0;
  let lastTradeId: string | null = null;

  for (const { row, data } of parsedRows) {
    try {
      const setupTagIds = await Promise.all(
        (data.setupTag ?? "")
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name.length > 0)
          .map((name) =>
            resolveOrCreateTag(name, setupTagsByName, createdSetupTags, createSetupTag),
          ),
      );

      const moodBeforeId = data.moodBefore
        ? await resolveOrCreateTag(data.moodBefore, moodTagsByName, createdMoodTags, (name) =>
            createMoodTag(name, "both"),
          )
        : null;
      const moodAfterId = data.moodAfter
        ? await resolveOrCreateTag(data.moodAfter, moodTagsByName, createdMoodTags, (name) =>
            createMoodTag(name, "both"),
          )
        : null;

      const tradeInput: TradeInput = {
        direction: data.direction,
        instrument: data.instrument,
        status: data.status,
        entryPrice: data.entryPrice,
        exitPrice: data.exitPrice ?? null,
        stopLoss: data.stopLoss,
        takeProfit: data.takeProfit ?? null,
        positionSize: data.positionSize,
        outcome: data.outcome ?? null,
        pnl: data.pnl ?? null,
        setupTagIds,
        session: data.session,
        dxyBias: data.dxyBias ?? null,
        newsNearby: data.newsNearby,
        newsNote: data.newsNote ?? null,
        moodBeforeId,
        moodAfterId,
        reasoning: data.reasoning ?? null,
        notesAfter: data.notesAfter ?? null,
        entryAt: data.entryAt,
        exitAt: data.exitAt ?? null,
        ruleChecks: [],
      };

      const trade = await createTrade(tradeInput);
      lastTradeId = trade.id;
      importedCount += 1;
    } catch (err) {
      skipped.push({ row, reason: err instanceof Error ? err.message : "Failed to save trade." });
    }
  }

  // Full recompute regardless of which trade id is passed (see
  // evaluateBadgesForTrade's docstring) — one call after the loop is both
  // correct and far cheaper than evaluating per row.
  if (lastTradeId) {
    await evaluateBadgesForTrade(lastTradeId);
  }

  return { importedCount, skipped, createdSetupTags, createdMoodTags };
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
