import { NextResponse } from "next/server";
import { rowsToCsv } from "@/lib/csv";
import { localDateKey } from "@/lib/dates";
import { parseTradeFilters } from "@/lib/tradeFilters";
import { listActiveMoodTags, listActiveSetupTags } from "@/server/queries/rules";
import { listSetupTagIdsByTradeId, listTrades } from "@/server/queries/trades";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = parseTradeFilters(Object.fromEntries(searchParams));

  const [trades, setupTags, moodTags, setupTagIdsByTrade] = await Promise.all([
    listTrades(filters),
    listActiveSetupTags(),
    listActiveMoodTags(),
    listSetupTagIdsByTradeId(),
  ]);
  const tagName = new Map(setupTags.map((t) => [t.id, t.name]));
  const moodName = new Map(moodTags.map((m) => [m.id, m.name]));

  const headers = [
    "entryAt", "exitAt", "direction", "instrument", "status",
    "entryPrice", "exitPrice", "stopLoss", "takeProfit", "positionSize",
    "riskRewardPlanned", "riskRewardRealized", "outcome", "pnl",
    "setupTag", "session", "dxyBias", "newsNearby", "newsNote",
    "moodBefore", "moodAfter", "reasoning", "notesAfter",
  ];

  const rows = trades.map((t) => [
    t.entryAt,
    t.exitAt,
    t.direction,
    t.instrument,
    t.status,
    t.entryPrice,
    t.exitPrice,
    t.stopLoss,
    t.takeProfit,
    t.positionSize,
    t.riskRewardPlanned,
    t.riskRewardRealized,
    t.outcome,
    t.pnl,
    (setupTagIdsByTrade.get(t.id) ?? [])
      .map((tagId) => tagName.get(tagId))
      .filter((name): name is string => name != null)
      .join(", ") || null,
    t.session,
    t.dxyBias,
    t.newsNearby,
    t.newsNote,
    t.moodBeforeId ? (moodName.get(t.moodBeforeId) ?? null) : null,
    t.moodAfterId ? (moodName.get(t.moodAfterId) ?? null) : null,
    t.reasoning,
    t.notesAfter,
  ]);

  return new NextResponse(rowsToCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="trades-export-${localDateKey()}.csv"`,
    },
  });
}
