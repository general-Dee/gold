import { unlink } from "node:fs/promises";
import path from "node:path";
import {
  badgeUnlocksCollection,
  rulesCollection,
  tradeImagesCollection,
  tradesCollection,
  type Trade,
  type TradeRuleCheck,
} from "@/server/firebase/collections";
import { nanoid } from "@/server/firebase/ids";
import { runBatch } from "@/server/firebase/batch";
import { plannedRiskReward, realizedRiskReward } from "@/lib/calculations";
import { rowsFromCsv } from "@/lib/csv";
import type { Direction, Outcome, Session, SortDirection, TradeSortField, TradeStatus } from "@/lib/constants";
import { tradeImportRowSchema, type TradeInput } from "@/lib/validation";
import {
  createMoodTag,
  createSetupTag,
  listActiveMoodTags,
  listActiveSetupTags,
} from "@/server/queries/rules";
import { evaluateBadgesForTrade } from "@/server/gamification/evaluate";
import { UPLOADS_DIR } from "@/server/uploadsDir";

export type TradeFilters = {
  from?: string;
  to?: string;
  direction?: Direction;
  outcome?: Outcome;
  session?: Session;
  status?: TradeStatus;
  setupTagId?: string;
  moodTagId?: string;
  q?: string;
};

export type TradeSort = { sortBy: TradeSortField; sortDir: SortDirection };

export async function listTrades(filters: TradeFilters = {}, sort?: TradeSort) {
  const sortBy = sort?.sortBy ?? "entryAt";
  const sortDir = sort?.sortDir ?? "desc";

  // Firestore-level: order by entryAt (+ an optional same-field range
  // filter), which needs no composite index. Every other condition —
  // including sorting by a field other than entryAt — is applied in JS
  // over the fetched set, consistent with how analytics.ts/gamification.ts
  // already aggregate over full result sets for this personal, low-volume app.
  let query = tradesCollection().orderBy("entryAt", sortDir === "asc" ? "asc" : "desc");
  if (filters.from) query = query.where("entryAt", ">=", filters.from);
  if (filters.to) query = query.where("entryAt", "<=", filters.to);

  const snapshot = await query.get();
  let rows = snapshot.docs.map((doc) => doc.data());

  if (filters.direction) rows = rows.filter((t) => t.direction === filters.direction);
  if (filters.outcome) rows = rows.filter((t) => t.outcome === filters.outcome);
  if (filters.session) rows = rows.filter((t) => t.session === filters.session);
  if (filters.status) rows = rows.filter((t) => t.status === filters.status);
  if (filters.setupTagId) {
    const setupTagId = filters.setupTagId;
    rows = rows.filter((t) => t.setupTagIds.includes(setupTagId));
  }
  if (filters.moodTagId) rows = rows.filter((t) => t.moodBeforeId === filters.moodTagId);
  if (filters.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter((t) =>
      [t.reasoning, t.notesAfter, t.newsNote].some((field) => field?.toLowerCase().includes(q)),
    );
  }

  if (sortBy !== "entryAt") {
    rows = [...rows].sort((a, b) => {
      const av = a[sortBy] ?? -Infinity;
      const bv = b[sortBy] ?? -Infinity;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }

  return rows;
}

/** All trade -> setup tag id associations, grouped by trade id — used by
 * bulk views (e.g. the CSV export) that need every trade's tags at once. */
export async function listSetupTagIdsByTradeId(): Promise<Map<string, string[]>> {
  const snapshot = await tradesCollection().get();
  const map = new Map<string, string[]>();
  for (const doc of snapshot.docs) {
    map.set(doc.id, doc.data().setupTagIds);
  }
  return map;
}

export async function getTradeById(id: string) {
  const doc = await tradesCollection().doc(id).get();
  if (!doc.exists) return null;
  const trade = doc.data()!;

  const imagesSnapshot = await tradeImagesCollection(id).get();
  const images = imagesSnapshot.docs.map((d) => d.data());

  return { trade, checks: trade.ruleChecks, images, setupTagIds: trade.setupTagIds };
}

async function buildRuleChecks(ruleChecks: TradeInput["ruleChecks"]): Promise<TradeRuleCheck[]> {
  if (ruleChecks.length === 0) return [];

  const rulesSnapshot = await rulesCollection().get();
  const ruleTextById = new Map(rulesSnapshot.docs.map((doc) => [doc.id, doc.data().text]));

  return ruleChecks
    .filter((c) => ruleTextById.has(c.ruleId))
    .map((c) => ({
      ruleId: c.ruleId,
      ruleTextSnapshot: ruleTextById.get(c.ruleId)!,
      status: c.status,
    }));
}

async function buildTradeRow(id: string, input: TradeInput, createdAt: string): Promise<Trade> {
  const riskRewardPlanned = plannedRiskReward(input);
  const riskRewardRealized = realizedRiskReward({
    direction: input.direction,
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    exitPrice: input.exitPrice ?? null,
  });
  const ruleChecks = await buildRuleChecks(input.ruleChecks);
  const setupTagIds = [...new Set(input.setupTagIds)];

  return {
    id,
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
    ruleChecks,
    setupTagIds,
    createdAt,
    updatedAt: new Date().toISOString(),
  };
}

// A single atomic document write — collapses what used to be 3-5 sequential,
// unguarded Drizzle statements (insert trade + insert rule checks + insert
// setup-tag links, or on update, update trade + delete-then-reinsert both)
// into one .set() call. ruleChecks/setupTagIds live as array fields on the
// trade doc itself, so there is no separate collection to keep in sync.
export async function createTrade(input: TradeInput): Promise<Trade> {
  const id = nanoid();
  const now = new Date().toISOString();
  const row = await buildTradeRow(id, input, now);
  await tradesCollection().doc(id).set(row);
  return row;
}

export async function updateTrade(id: string, input: TradeInput): Promise<Trade> {
  const ref = tradesCollection().doc(id);
  const existing = await ref.get();
  const createdAt = existing.exists ? existing.data()!.createdAt : new Date().toISOString();
  const row = await buildTradeRow(id, input, createdAt);
  await ref.set(row);
  return row;
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
  const [imagesSnapshot, badgeSnapshot] = await Promise.all([
    tradeImagesCollection(id).get(),
    badgeUnlocksCollection().where("tradeId", "==", id).get(),
  ]);

  // badgeUnlocks.tradeId is never cascade-deleted, so it must be detached
  // before the trade doc goes away — nullify rather than delete, since an
  // earned badge shouldn't be revoked just because its trade record was
  // removed. Images and the trade doc itself are removed in the same batch.
  await runBatch((batch) => {
    for (const doc of imagesSnapshot.docs) batch.delete(doc.ref);
    for (const doc of badgeSnapshot.docs) batch.update(doc.ref, { tradeId: null });
    batch.delete(tradesCollection().doc(id));
  });

  await Promise.all(
    imagesSnapshot.docs.map(async (doc) => {
      try {
        await unlink(path.join(UPLOADS_DIR, doc.data().filePath));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
    }),
  );
}
