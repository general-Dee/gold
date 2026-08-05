import { notFound } from "next/navigation";
import { CloseTradeForm } from "@/components/trades/CloseTradeForm";
import { updateTradeAction } from "@/server/actions/trades";
import { getTradeById } from "@/server/queries/trades";
import type { CheckStatus } from "@/lib/constants";
import type { TradeInput } from "@/lib/validation";

export default async function CloseTradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getTradeById(id);
  if (!result) notFound();
  const { trade, checks, setupTagIds } = result;

  const preservedTrade: TradeInput = {
    direction: trade.direction as TradeInput["direction"],
    instrument: trade.instrument,
    status: "closed",
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    stopLoss: trade.stopLoss,
    takeProfit: trade.takeProfit,
    positionSize: trade.positionSize,
    outcome: trade.outcome as TradeInput["outcome"],
    pnl: trade.pnl,
    setupTagIds,
    session: trade.session as TradeInput["session"],
    dxyBias: trade.dxyBias as TradeInput["dxyBias"],
    newsNearby: trade.newsNearby,
    newsNote: trade.newsNote,
    moodBeforeId: trade.moodBeforeId,
    moodAfterId: trade.moodAfterId,
    reasoning: trade.reasoning,
    notesAfter: trade.notesAfter,
    entryAt: trade.entryAt,
    exitAt: trade.exitAt,
    ruleChecks: checks.map((c) => ({ ruleId: c.ruleId, status: c.status as CheckStatus })),
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight capitalize">
          Close {trade.direction} {trade.instrument}
        </h1>
        <p className="text-sm text-muted-foreground">
          Entered {new Date(trade.entryAt).toLocaleString()}
        </p>
      </div>
      <CloseTradeForm trade={preservedTrade} onSubmitAction={updateTradeAction.bind(null, trade.id)} />
    </div>
  );
}
