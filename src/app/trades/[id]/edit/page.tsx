import { notFound } from "next/navigation";
import { TradeForm, toDatetimeLocal } from "@/components/trades/TradeForm";
import { updateTradeAction } from "@/server/actions/trades";
import { getCurrentBalance } from "@/server/queries/account";
import { listActiveMoodTags, listActiveRules, listActiveSetupTags } from "@/server/queries/rules";
import { getTradeById } from "@/server/queries/trades";
import type { CheckStatus } from "@/lib/constants";

export default async function EditTradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, rules, setupTags, moodTags, accountBalance] = await Promise.all([
    getTradeById(id),
    listActiveRules(),
    listActiveSetupTags(),
    listActiveMoodTags(),
    getCurrentBalance(),
  ]);
  if (!result) notFound();
  const { trade, checks, setupTagIds } = result;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit trade</h1>
      </div>
      <TradeForm
        rules={rules}
        setupTags={setupTags}
        moodTags={moodTags}
        initialTrade={{
          direction: trade.direction as "long" | "short",
          instrument: trade.instrument,
          status: trade.status as "open" | "closed",
          entryPrice: trade.entryPrice,
          exitPrice: trade.exitPrice,
          stopLoss: trade.stopLoss,
          takeProfit: trade.takeProfit,
          positionSize: trade.positionSize,
          outcome: trade.outcome as "win" | "loss" | "breakeven" | null,
          pnl: trade.pnl,
          setupTagIds,
          session: trade.session as never,
          dxyBias: trade.dxyBias as "up" | "down" | "flat" | null,
          newsNearby: trade.newsNearby,
          newsNote: trade.newsNote,
          moodBeforeId: trade.moodBeforeId,
          moodAfterId: trade.moodAfterId,
          reasoning: trade.reasoning,
          notesAfter: trade.notesAfter,
          entryAt: toDatetimeLocal(trade.entryAt),
          exitAt: toDatetimeLocal(trade.exitAt),
          ruleChecks: [],
        }}
        initialChecks={checks.map((c) => ({
          ruleId: c.ruleId,
          status: c.status as CheckStatus,
        }))}
        onSubmitAction={(input) => updateTradeAction(trade.id, input)}
        accountBalance={accountBalance}
      />
    </div>
  );
}
